from types import SimpleNamespace

import anthropic
import httpx2
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
    assert status == {"provider": "rules"}


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
    assistant.claude.client = SimpleNamespace(beta=SimpleNamespace(messages=fake))
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


def test_auto_mode_without_key_uses_rules(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert ClinicalAssistant("auto", "claude-opus-5-5").provider_name == "rules"
    assert ClaudeProvider  # imported for type reference
