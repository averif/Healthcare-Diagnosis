from app.models import Prediction, PredictionStatus, Role, User


def test_seed_is_idempotent_and_demo_data_is_realistic(app, db):
    runner = app.test_cli_runner()
    first = runner.invoke(args=["seed", "--demo"])
    assert first.exit_code == 0, first.output
    assert "seed complete" in first.output

    users = db.session.scalar(db.select(db.func.count(User.id)))
    predictions = db.session.scalars(db.select(Prediction)).all()
    assert len(predictions) >= 40
    assert {p.risk_level.value for p in predictions} == {"low", "moderate", "high"}
    assert {p.disease.value for p in predictions} == {"diabetes", "heart", "liver", "symptom"}
    assert any(p.status == PredictionStatus.REVIEWED for p in predictions)
    assert db.session.scalar(db.select(db.func.count(User.id)).filter_by(role=Role.DOCTOR)) == 2

    second = runner.invoke(args=["seed", "--demo"])
    assert second.exit_code == 0
    assert db.session.scalar(db.select(db.func.count(User.id))) == users
    assert len(db.session.scalars(db.select(Prediction)).all()) == len(predictions)
