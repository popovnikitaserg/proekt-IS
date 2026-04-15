import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_index_page(client: AsyncClient) -> None:
    response = await client.get("/")

    assert response.status_code == 200
    assert "scikit-learn" in response.text
