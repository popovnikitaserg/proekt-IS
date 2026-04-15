from pathlib import Path

from fastapi import FastAPI, Response
from fastapi.staticfiles import StaticFiles
from prometheus_client import make_asgi_app

from app.container import Container
from app.handlers.datasets import datasets_router
from app.handlers.training import jobs_router
from app.handlers.web import web_router


def build_app() -> FastAPI:
    app_container = Container()
    application = app_container.app()
    application.include_router(router=datasets_router)
    application.include_router(router=jobs_router)
    application.include_router(router=web_router)

    static_dir = Path(__file__).resolve().parent / "static"
    static_dir.mkdir(parents=True, exist_ok=True)
    application.mount(path="/static", app=StaticFiles(directory=str(static_dir)), name="static")

    application.mount(path="/metrics", app=make_asgi_app())

    @application.get(path="/health", tags=["Health"])
    async def health_check() -> Response:
        return Response()

    return application


app = build_app()
