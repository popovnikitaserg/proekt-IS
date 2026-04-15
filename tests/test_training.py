import asyncio

import pytest
from httpx import AsyncClient


def _fake_classification_metrics(**_: object) -> dict[str, object]:
    return {
        "task_type": "classification",
        "row_count": 2,
        "cleaned_row_count": 2,
        "feature_columns": ["f1", "f2"],
        "target_column": "label",
        "sample_summary": {},
        "test_metrics": {"accuracy": 1.0, "f1_macro": 1.0},
        "feature_importance": [{"feature": "f1", "importance": 0.6}],
        "confusion_matrix": {"labels": ["0", "1"], "matrix": [[1, 0], [0, 1]]},
        "correlation": {
            "columns": ["label", "f1", "f2"],
            "values": [[1.0, 0.5, 0.5], [0.5, 1.0, 0.9], [0.5, 0.9, 1.0]],
        },
        "regression_scatter": None,
        "model_file": "/tmp/model.joblib",
    }


def _fake_regression_metrics(**_: object) -> dict[str, object]:
    return {
        "task_type": "regression",
        "row_count": 3,
        "cleaned_row_count": 3,
        "feature_columns": ["f1"],
        "target_column": "y",
        "sample_summary": {},
        "test_metrics": {"rmse": 0.1, "mae": 0.05, "r2": 0.99},
        "feature_importance": [{"feature": "f1", "importance": 1.0}],
        "confusion_matrix": None,
        "correlation": {"columns": ["y", "f1"], "values": [[1.0, 0.99], [0.99, 1.0]]},
        "regression_scatter": {"actual": [10.0, 20.0], "predicted": [10.1, 19.9]},
        "model_file": "/tmp/model.joblib",
    }


@pytest.mark.anyio
async def test_train_job_lifecycle_classification(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.training.run_sklearn_training_pipeline", _fake_classification_metrics)

    content = b"f1,f2,label\n1,2,0\n3,4,1\n"
    upload = await client.post("/api/datasets/upload", files={"file": ("d.csv", content, "text/csv")})
    dataset_id = upload.json()["id"]

    train = await client.post(f"/api/datasets/{dataset_id}/train", params={"target_column": "label"})

    assert train.status_code == 200
    job_id = train.json()["id"]

    for _ in range(30):
        job = await client.get(f"/api/jobs/{job_id}")
        assert job.status_code == 200
        payload = job.json()

        if payload["status"] == "done":
            assert payload["metrics"]["task_type"] == "classification"
            assert payload["metrics"]["test_metrics"]["accuracy"] == 1.0

            return

        if payload["status"] == "failed":
            msg = payload.get("error_message", "")
            raise AssertionError(msg)

        await asyncio.sleep(0.05)

    msg = "timeout waiting for job"
    raise AssertionError(msg)


@pytest.mark.anyio
async def test_train_job_lifecycle_regression(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.training.run_sklearn_training_pipeline", _fake_regression_metrics)

    content = b"f1,y\n1.0,10.5\n2.0,20.0\n3.0,30.5\n"
    upload = await client.post("/api/datasets/upload", files={"file": ("r.csv", content, "text/csv")})
    dataset_id = upload.json()["id"]

    train = await client.post(f"/api/datasets/{dataset_id}/train", params={"target_column": "y"})

    assert train.status_code == 200
    job_id = train.json()["id"]

    for _ in range(30):
        job = await client.get(f"/api/jobs/{job_id}")
        assert job.status_code == 200
        payload = job.json()

        if payload["status"] == "done":
            assert payload["metrics"]["task_type"] == "regression"
            assert payload["metrics"]["test_metrics"]["r2"] == 0.99

            return

        if payload["status"] == "failed":
            msg = payload.get("error_message", "")
            raise AssertionError(msg)

        await asyncio.sleep(0.05)

    msg = "timeout waiting for job"
    raise AssertionError(msg)
