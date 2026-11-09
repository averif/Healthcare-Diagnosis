from types import SimpleNamespace

import anthropic
import httpx
import httpx2
import openai
import pytest

from app.services.assistant import ClaudeProvider, ClinicalAssistant

from .conftest import auth


def ask(client, user, message, prediction_id=None):
    body = {"message": message}
    if prediction_id is not None:
        body["prediction_id"] = prediction_id
    return client.post("/api/assistant/chat", json=body, headers=auth(user))


def test_rules_assistant_answers_common_questions(client, patient, make_prediction):
    pred = make_prediction(patient)
    why = ask(client, patient, "Why is my risk high?", pred["id"]).get_json()
    assert why["provider"] == "rules"
    assert "Plasma glucose" in why["reply"]["content"]
    assert "not a diagnosis" in why["reply"]["content"]

    meds = ask(client, patient, "What dose of metformin should I take?", pred["id"]).get_json()
    assert "can't advise on medicines" in meds["reply"]["content"]

    nxt = ask(client, patient, "What should I do next?", pred["id"]).get_json()
    assert "HbA1c" in nxt["reply"]["content"]


def test_emergency_messages_bypass_the_model(client, patient, db, make_prediction):
    pred = make_prediction(patient)
    body = ask(client, patient, "I have crushing chest pain right now", pred["id"]).get_json()
    assert body["emergency"] is True and body["provider"] == "safety"
    assert "emergency" in body["reply"]["content"]


def test_history_is_private_and_ordered(client, patient, other_patient, doctor, make_prediction):
    pred = make_prediction(patient)
    ask(client, patient, "Why?", pred["id"])
    ask(client, patient, "How reliable is this?", pred["id"])
    history = client.get(
        f"/api/assistant/history?prediction_id={pred['id']}", headers=auth(patient)
    ).get_json()
    assert [m["role"] for m in history] == ["user", "assistant", "user", "assistant"]

    # the assigned doctor has their own (empty) thread; other patients get 404
    doc_history = client.get(
        f"/api/assistant/history?prediction_id={pred['id']}", headers=auth(doctor)
    )
    assert doc_history.get_json() == []
    assert ask(client, other_patient, "Why?", pred["id"]).status_code == 404


def test_message_validation_and_status(client, patient, admin):
    assert ask(client, patient, "").status_code == 422
    assert ask(client, patient, "x" * 1001).status_code == 422
    assert ask(client, admin, "hello").status_code == 403
    status = client.get("/api/assistant/status", headers=auth(patient)).get_json()
    assert status["provider"] == "rules"
    assert "rules" in status["detail"]


# --------------------------------------------------------------------------------------------
# Claude provider, with the SDK client replaced by a fake (no network, no cost)
# --------------------------------------------------------------------------------------------


class FakeMessages:
    def __init__(self, outcome):
        self.outcome = outcome
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


def claude_assistant(monkeypatch, outcome) -> tuple[ClinicalAssistant, FakeMessages]:
    fake = FakeMessages(outcome)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    assistant = ClinicalAssistant("claude", "claude-opus-5-5")
    assistant.llm.client = SimpleNamespace(beta=SimpleNamespace(messages=fake))
    return assistant, fake


def text_response(text, stop_reason="end_turn"):
    return SimpleNamespace(
        stop_reason=stop_reason, content=[SimpleNamespace(type="text", text=text)]
    )


def test_claude_reply_is_grounded_in_the_prediction(app, monkeypatch, patient, make_prediction, db):
    from app.models import Prediction

    pred = db.session.get(Prediction, make_prediction(patient)["id"])
    assistant, fake = claude_assistant(monkeypatch, text_response("Your glucose was high."))
    reply = assistant.answer("Why?", pred, [{"role": "user", "content": "hi"}])

    assert reply.provider == "claude"
    assert reply.text.startswith("Your glucose was high.")
    call = fake.calls[0]
    assert call["model"] == "claude-opus-5-5"
    assert call["fallbacks"] == "default"
    assert "Plasma glucose" in call["messages"][0]["content"]
    assert call["messages"][-1] == {"role": "user", "content": "Why?"}


@pytest.mark.parametrize(
    "outcome",
    [
        text_response("", stop_reason="refusal"),
        anthropic.APIConnectionError(request=httpx2.Request("POST", "https://api.anthropic.com")),
    ],
)
def test_claude_failures_fall_back_to_rules(
    app, monkeypatch, patient, make_prediction, db, outcome
):
    from app.models import Prediction

    pred = db.session.get(Prediction, make_prediction(patient)["id"])
    assistant, _ = claude_assistant(monkeypatch, outcome)
    reply = assistant.answer("How reliable is this?", pred, [])
    assert reply.provider == "rules"
    assert "statistical estimate" in reply.text


# --------------------------------------------------------------------------------------------
# NVIDIA provider (OpenAI-compatible), with the SDK client replaced by a fake
# --------------------------------------------------------------------------------------------


def nvidia_assistant(monkeypatch, outcome) -> tuple[ClinicalAssistant, FakeMessages]:
    fake = FakeMessages(outcome)
    monkeypatch.setenv("NVIDIA_API_KEY", "nvapi-test")
    assistant = ClinicalAssistant("nvidia", nvidia_model="nvidia/test-model")
    assistant.llm.client = SimpleNamespace(chat=SimpleNamespace(completions=fake))
    return assistant, fake


def chat_completion(content):
    message = SimpleNamespace(content=content)
    return SimpleNamespace(choices=[SimpleNamespace(message=message, finish_reason="stop")])


def test_nvidia_reply_is_grounded_and_strips_reasoning(
    app, monkeypatch, patient, make_prediction, db
):
    from app.models import Prediction

    pred = db.session.get(Prediction, make_prediction(patient)["id"])
    assistant, fake = nvidia_assistant(
        monkeypatch, chat_completion("<think>internal notes</think>Glucose drove the result.")
    )
    reply = assistant.answer("Why?", pred, [])

    assert reply.provider == "nvidia"
    assert reply.text.startswith("Glucose drove the result.")
    assert "internal notes" not in reply.text
    call = fake.calls[0]
    assert call["model"] == "nvidia/test-model"
    assert call["messages"][0]["role"] == "system"
    assert "Plasma glucose" in call["messages"][1]["content"]
    assert call["messages"][-1] == {"role": "user", "content": "Why?"}
    assert call["extra_body"] == {"chat_template_kwargs": {"enable_thinking": False}}


@pytest.mark.parametrize(
    "outcome",
    [
        chat_completion(""),
        openai.APITimeoutError(request=httpx.Request("POST", "https://integrate.api.nvidia.com")),
    ],
)
def test_nvidia_failures_fall_back_to_rules(
    app, monkeypatch, patient, make_prediction, db, outcome
):
    from app.models import Prediction

    pred = db.session.get(Prediction, make_prediction(patient)["id"])
    assistant, _ = nvidia_assistant(monkeypatch, outcome)
    reply = assistant.answer("How reliable is this?", pred, [])
    assert reply.provider == "rules"
    assert "statistical estimate" in reply.text


def test_plain_text_strips_markdown_emphasis_and_headings():
    from app.services.assistant import plain_text

    raw = "## Summary\nYour result is **low-risk** and __not__ urgent.\n- keep bullets"
    expected = "Summary\nYour result is low-risk and not urgent.\n- keep bullets"
    assert plain_text(raw) == expected


def test_auto_mode_prefers_nvidia_then_claude_then_rules(monkeypatch):
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert ClinicalAssistant("auto").provider_name == "rules"

    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    assert ClinicalAssistant("auto").provider_name == "claude"

    monkeypatch.setenv("NVIDIA_API_KEY", "nvapi-test")
    assert ClinicalAssistant("auto").provider_name == "nvidia"

    monkeypatch.delenv("NVIDIA_API_KEY")
    assert ClinicalAssistant("nvidia").provider_name == "rules"  # forced but no key
    assert ClaudeProvider  # imported for type reference
