import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_upload_csv(client: AsyncClient) -> None:
    content = b"f1,f2,label\n1,2,0\n3,4,1\n"
    files = {"file": ("demo.csv", content, "text/csv")}
    response = await client.post("/api/datasets/upload", files=files)

    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["size_bytes"] == len(content)
