# constroman-web

React + Vite + TypeScript front end for [constroman-api](../constroman-api). Screens follow the
"ConstroMan v1 Screens" design: sign in, projects, files, dashboard, ask.

```
cp .env.example .env     # API URL + Supabase URL and publishable key
npm install
npm run dev              # http://localhost:5173 (the origin the API's CORS and S3 CORS allow)
npm run build
```

Run the API alongside it (`uvicorn app.api.main:app --reload`, port 8000).

## How it maps to the API
| Screen | Endpoints |
| --- | --- |
| Sign in | Supabase email and password (`signInWithPassword` / `signUp`, email confirmation on); the access token is sent as the bearer token, then `GET /me`; `POST /auth/register` or `/auth/join` for new users |
| Projects | `GET/POST /projects` |
| Files | `GET /projects/{id}/files`, signed-URL upload (`POST .../uploads` → PUT to S3 → `POST /file-versions/{id}/complete`), `GET /file-versions/{id}/download`, `DELETE .../files/{id}` |
| Dashboard | `GET /projects/{id}/dashboard/charts`, `DELETE /charts/{id}/pin` |
| Ask | `GET /projects/{id}/prompts` only; chat is not built in the API yet |
