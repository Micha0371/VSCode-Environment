# PantryFlow

The application lives in [`pantry-flow/`](pantry-flow/README.md): an Expo / React
Native / TypeScript client backed directly by Supabase Auth, PostgreSQL, and RLS.
See its README for setup, migrations, architecture, and verification.

- `docs/`: original product requirements and phased implementation plans.
- `frontend/`: unused Emergent React web starter; not the PantryFlow application.
- `backend/`: unused health-only FastAPI starter. Its former unauthenticated
  database/status endpoints have been removed. Do not deploy it for PantryFlow.

The intended Supabase project is `pantryflow_emergent`, project reference
`oiqteedkfwmcertgxqga`. Local app credentials belong in the ignored
`pantry-flow/.env`, never in source control.
