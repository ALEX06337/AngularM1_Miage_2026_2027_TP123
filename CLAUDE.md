# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Student repo ("Guitar Practice Cloud") for a 3-session TD/TP series: an Express/Mongoose API (`backend/`) and an Angular 22 standalone app (`frontend-starter/`). The two are separate npm projects with no shared root `package.json` — always `cd` into one before running its scripts. Mission briefs live in `SUJET_ETUDIANT_TP1.md`, `TP2.md`, `TP3.md`; the canonical HTTP contract is `API_CONTRACT.md`.

## Commands

Backend (`backend/`):
```bash
cp .env.example .env   # first time only; needs MONGODB_URI and JWT_SECRET, see ATLAS_SETUP.md
npm install
npm start               # node --env-file=.env src/server.js, listens on :3000 (or $PORT)
npm test                # node --test, runs backend/test/api.test.js
```

Frontend (`frontend-starter/`):
```bash
npm install
npm start               # ng serve --proxy-config proxy.conf.json, serves on :4200
npm run build
npm test                # ng test --watch=false
```

Note: `frontend-starter/proxy.conf.json` currently proxies `/api` to `http://localhost:3001`, but the backend's default port is `3000` (`backend/src/server.js`). Check/align these before assuming the proxy "just works."

There is no linter configured in either project.

## Architecture

Request flow end to end:
```
Angular component → Angular service (AuthService/TrackService) → HttpClient
   → Express route → auth middleware → handler → Mongoose model → MongoDB Atlas
```
Angular never talks to MongoDB directly. `API_CONTRACT.md` is the source of truth for routes, auth requirements, and payload/response shapes — it must be kept in sync with `backend/src/app.js` and the frontend services any time a route changes, in the same commit/mission.

### Backend (`backend/src/`)

- `app.js` — everything: builds the Express app (`createApp()`, exported without opening a port so tests reuse it), all routes, the `auth` JWT middleware, and Multer config for uploads. This is the file to read to understand the whole API surface.
- `server.js` — the runtime entrypoint: connects Mongoose to `MONGODB_URI`, seeds the demo user (`demo@example.com` / `Demo1234!`) if missing, then calls `createApp().listen(port)`.
- `models/User.js`, `models/Track.js` — Mongoose schemas. Passwords are hashed via a `pre('validate')` hook and never selected by default (`+passwordHash` must be requested explicitly, as in the login handler). `toPublic()` is the method used to shape what's ever sent back to clients.
- Auth: JWT signed with `{ sub: user.id, email }`, `Bearer <token>` header, 2h expiry. `req.auth.sub` is the trusted identity for all ownership checks (tracks are always scoped to `ownerId: req.auth.sub`).
- Uploads: `multipart/form-data` → Multer (`diskStorage`, random UUID filename, 25MB limit, MIME allowlist) → files land in `data/uploads/` → metadata (not bytes) goes to MongoDB via the `Track` model. On a DB failure after a successful disk write, the handler unlinks the orphaned file.
- Errors: a centralized error-handling middleware at the bottom of `createApp()` maps `MulterError`/format errors and Mongoose `ValidationError`/`CastError` to `400`/`404`; everything else falls through.

### Frontend (`frontend-starter/src/app/`)

- `components/` — one folder per page/route (`login-page`, `register-page`, `profile-page`, `tracks-page`), each with its own `.ts`/`.html`/`.css`. `components/app/` is the root shell.
- `shared/` — cross-cutting concerns: `services/` (`AuthService`, `TrackService` — the only things allowed to call `HttpClient`), `guards/auth.guard.ts` (route protection), `interceptors/auth.interceptor.ts` (attaches the JWT to protected requests, and is where 401 handling / logout-on-expiry lives), `models/` (DTOs matching `API_CONTRACT.md`).
- `routes.ts` — route table; `profile` and `tracks` are guarded by `authGuard`, `login`/`register` are public.
- Components must not call `HttpClient` directly — they go through a service. State (e.g. `currentUser`) is held in Signals, not just `localStorage`.

## Conventions specific to this repo

- Never put secrets (JWT secret, Mongo URI, tokens, passwords) in Angular code, logs, commits, screenshots, or prompts to an AI assistant. `backend/.env` is gitignored; only `.env.example` is committed.
- Any new/changed backend route must be reflected in `API_CONTRACT.md` in the same change (method, URL, auth, params, body, responses, errors) — this is enforced by convention across `backend/AGENTS.md`, `backend/CLAUDE.md`, and `frontend-starter/CLAUDE.md`.
- `frontend-starter/` must never modify `backend/`, and vice versa is discouraged — each side treats `API_CONTRACT.md` as the boundary.
- Backend: `async`/`await` everywhere, no empty `catch`, log start/success/failure of each operation but never log passwords/tokens/URIs, validate `req.params`/`req.query`/`req.body`/`req.file`, use `mongoose.isValidObjectId` before lookups by id.
- Frontend: Angular 22 standalone (no explicit `standalone: true`), no explicit `ChangeDetectionStrategy.OnPush` (both are defaults), `inject()` over constructor injection, Signals for local/derived state, native `@if`/`@for`/`@switch`, Reactive Forms, explicit `subscribe({ next, error })` at HTTP call sites so behavior is traceable in the console.
- This is coursework: each mission's `RAPPORT_IA_MODELE.md` entry must be updated with evidence (text/screenshots) whenever an AI assistant is used — see `SUJET_ETUDIANT_TP*.md` and `CONSEILS_POUR_UTIISER_ASSISTANT_AI.md` for the expected process and level of understanding required.
