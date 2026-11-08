"""Inactive Emergent scaffold. PantryFlow uses Supabase directly.

This health-only app deliberately exposes no database or status CRUD endpoints.
"""
from fastapi import FastAPI

app = FastAPI()


@app.get("/api/")
async def root():
    return {"message": "PantryFlow uses Supabase; this scaffold is inactive."}
