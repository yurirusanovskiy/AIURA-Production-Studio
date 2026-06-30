from fastapi import APIRouter
from api.v1.routes import characters, dictionary, processing, projects, scenes, settings, system

v1_router = APIRouter()

v1_router.include_router(characters.router)
v1_router.include_router(dictionary.router)
v1_router.include_router(processing.router)
v1_router.include_router(projects.router)
v1_router.include_router(scenes.router)
v1_router.include_router(settings.router)
v1_router.include_router(system.router)
