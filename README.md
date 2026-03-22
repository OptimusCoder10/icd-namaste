# NAMASTE-ICD11 Clinical Mapper

A full-stack mobile application that maps clinical symptoms and NAMASTE terminology to ICD-11 diagnostic codes using AI. Doctors can enter symptoms, receive ranked ICD-11 suggestions with confidence scores, set their own confidence level, and save diagnoses as FHIR records. Patients can view and search all confirmed diagnoses sorted by doctor confidence.

---

## Features

### Authentication & Roles
- **Role-based sign-up**: Users register as either a **Doctor** or a **Patient**
- **JWT authentication**: Secure login with tokens stored locally on the device
- **Session persistence**: Logged-in state is remembered across app restarts
- **Role-aware UI**: The entire app adapts its tabs, screens, and content based on whether the user is a doctor or patient

### Doctor Features
- **Symptom input**: Free-text entry of symptoms, NAMASTE terms, or clinical descriptions
- **Example chips**: Quick-fill buttons for common clinical queries (fever, chest pain, etc.)
- **AI-powered ICD-11 matching**: Sends symptoms to a BioBERT + FAISS vector search engine; falls back to keyword matching when BioBERT is unavailable
- **Ranked results**: ICD-11 code matches returned with AI confidence scores, ranked highest first
- **Doctor confidence control**: For each AI result, the doctor can adjust a 0–100% confidence score using +10 / +5 / -5 / -10 buttons; starts pre-filled from the AI score
- **Confirm & Save**: Saves the selected diagnosis as an FHIR Condition resource to the database, including both the AI score and the doctor's own confidence score
- **My Records tab**: View all their own saved FHIR records, with AI and doctor confidence bars shown on each card
- **FHIR detail modal**: Tap any record to see full FHIR JSON, confidence breakdown, and metadata

### Patient Features
- **Patient Portal tab**: Welcome screen explaining the patient-only role; no diagnosis input allowed
- **Diagnoses tab**: View all doctor-confirmed diagnoses across all doctors, sorted by doctor confidence (highest first); each card shows the doctor's name, ICD code, disease name, AI confidence bar, and doctor confidence bar
- **Search tab**: Search across all diagnoses in real time by disease name, ICD-11 code, or symptom text; results sorted by doctor confidence; tap any result to see full detail and FHIR JSON
- **Common search chips**: Quick-tap suggestions for frequent searches (fever, chest pain, diabetes, etc.)
- **Confidence ranking info**: Clear label explaining results are ordered by doctor confidence

---

## Architecture Overview

```
namaste-icd11/
├── artifacts/
│   ├── namaste-icd/          Expo React Native mobile app
│   └── api-server/           Express.js REST API backend
├── lib/
│   ├── db/                   Drizzle ORM schema + PostgreSQL client
│   ├── api-spec/             OpenAPI specification
│   ├── api-zod/              Auto-generated Zod validators
│   └── api-client-react/     Auto-generated React API client
├── ai-service/               Python FastAPI AI service (BioBERT + FAISS)
├── docker-compose.yml        Docker orchestration for all services
├── Dockerfile.api            Docker image for Express API
├── Dockerfile.expo           Docker image for Expo web app
└── entrypoint.api.sh         Startup script: waits for DB, runs migrations, starts API
```

---

## File-by-File Reference

### Mobile App — `artifacts/namaste-icd/`

#### `app/auth.tsx`
The login and registration screen. Renders email, password, and full name inputs. In register mode, shows a **Doctor / Patient role selector** (toggle buttons). On submit, calls the auth context login or register function and navigates to the main tabs. Displays inline error messages for failed attempts.

#### `app/(tabs)/_layout.tsx`
Defines the bottom tab navigation. Reads the logged-in user's role and renders tabs accordingly:
- **Doctor**: "Diagnose" tab + "My Records" tab (Search tab is hidden)
- **Patient**: "Portal" tab + "Diagnoses" tab + "Search" tab
Supports both iOS native tab bar (Liquid Glass) and the classic Expo tab bar.

#### `app/(tabs)/input.tsx`
The main doctor screen for entering symptoms and reviewing AI results.
- If the user is a **patient**, renders a patient portal message with a logout button instead
- If the user is a **doctor**: shows a text area, example chips, a Generate button, AI badge, and result cards
- Each result card includes the ICD code, description, AI confidence bar, and a **doctor confidence panel** with increment/decrement buttons and a fill bar
- Saving a result sends `confidence_score` (AI) and `doctor_confidence` (doctor-set) to the backend

#### `app/(tabs)/history.tsx`
Role-aware history/diagnoses screen.
- **Doctor view**: Lists their own FHIR records sorted by date (newest first); shows both AI and doctor confidence bars
- **Patient view**: Lists all doctors' records sorted by doctor confidence (highest first); shows doctor name badge and a confidence-ranked circle indicator
- Tapping any record opens a modal with full FHIR JSON, confidence breakdown, and doctor attribution

#### `app/(tabs)/search.tsx`
Patient-only search screen.
- Search bar with live debounced search (400ms delay, no submit button needed)
- Common search suggestion chips (fever, diabetes, hypertension, etc.)
- Results list sorted by doctor confidence, showing ICD code, disease name, doctor name, date, AI bar, and doctor confidence bar
- Tapping a result opens a full detail modal identical to the history screen modal
- Info box explaining the confidence-sorted ranking system

#### `context/AuthContext.tsx`
React context providing authentication state throughout the app. Stores `user` (id, email, name, role) and `token` in AsyncStorage for persistence. Exposes `login(email, password)`, `register(email, password, name, role)`, and `logout()` functions. Constructs the API base URL using `EXPO_PUBLIC_DOMAIN`, automatically switching between `http://` (localhost/Docker) and `https://` (Replit/production).

#### `context/ApiContext.tsx`
React context wrapping all API calls. Attaches the JWT Bearer token to every request automatically. Exposes:
- `predict(text)` — sends symptom text to get ICD-11 matches
- `saveRecord(data)` — saves a confirmed diagnosis with AI + doctor confidence
- `getHistory()` — fetches records (doctor: own records; patient: all records sorted by doctor confidence)
- `searchRecords(query)` — searches records by ICD code, description, or symptom text

#### `components/ScoreBar.tsx`
Reusable horizontal confidence bar component. Accepts a `score` between 0 and 1. Color transitions from red (low) through amber (medium) to green (high). Used throughout the app for AI confidence display.

#### `constants/colors.ts`
Centralised colour palette for the light theme. Defines text, background, border, tint (blue), success (green), warning (amber), danger (red), badge, and shadow colours used across all screens.

---

### API Backend — `artifacts/api-server/src/`

#### `index.ts`
Entry point. Creates the Express server, binds to `process.env.PORT` (default 8080), and starts listening.

#### `app.ts`
Configures the Express application. Applies CORS, JSON body parsing, and mounts all route modules under `/api`.

#### `routes/auth.ts`
Handles user authentication.
- `POST /api/auth/register` — accepts `email`, `password`, `name`, `role` (doctor/patient); hashes password with bcrypt; inserts user; returns JWT + user object including role
- `POST /api/auth/login` — verifies credentials; returns JWT + user object including role
- Role is embedded in the JWT payload so the backend can enforce permissions on every request

#### `routes/records.ts`
Manages FHIR diagnosis records.
- `POST /api/records` — **doctors only**; saves a diagnosis with `input_text`, `selected_icd`, `icd_description`, `confidence_score` (AI), and `doctor_confidence` (0–100 integer); builds and stores FHIR Condition JSON
- `GET /api/records` — returns records based on role: doctors get their own records sorted by date; patients get all records joined with doctor names, sorted by `doctor_confidence` descending
- `GET /api/records/search?q=...` — case-insensitive search across `selected_icd`, `icd_description`, and `input_text` columns; returns results sorted by `doctor_confidence` descending; accessible to both roles

#### `routes/predict.ts`
Proxies symptom text to the Python AI service.
- `POST /api/predict` — forwards the text to `AI_SERVICE_URL/predict`; if the AI service is down, falls back to keyword-based matching against a built-in ICD-11 dictionary; returns ranked results with confidence scores

#### `routes/health.ts`
- `GET /api/healthz` — returns `{ status: "ok" }` for health checks and uptime monitoring

#### `middlewares/auth.ts`
JWT verification middleware. Reads the `Authorization: Bearer <token>` header, verifies the token using `JWT_SECRET`, and attaches `userId` and `userRole` to the request object. Also exports `requireDoctor` which extends `requireAuth` and rejects non-doctor users with a 403.

---

### Database — `lib/db/src/`

#### `schema/index.ts`
Defines all PostgreSQL tables using Drizzle ORM:

- **`users`** — `id`, `email` (unique), `name`, `password_hash`, `role` (`doctor` | `patient`), `created_at`
- **`icd_codes`** — `code` (PK), `description` — reference table for ICD-11 codes
- **`records`** — `id`, `user_id` (FK → users), `input_text`, `selected_icd`, `icd_description`, `confidence_score` (float, AI score 0–1), `doctor_confidence` (integer 0–100, nullable), `fhir_json` (JSONB), `created_at`

Also exports Zod insert schemas and TypeScript types inferred from the table definitions.

#### `index.ts`
Creates and exports the Drizzle database client using `pg.Pool` and `DATABASE_URL`. Re-exports everything from the schema so routes can import tables and types from a single `@workspace/db` alias.

#### `drizzle.config.ts`
Drizzle Kit configuration pointing to the schema file and database URL. Used by `pnpm run push` to sync schema changes to the PostgreSQL database.

---

### AI Service — `ai-service/`

#### `main.py`
Python FastAPI service running on port 8001.
- On startup, attempts to load the `dmis-lab/biobert-v1.1` model from HuggingFace and build a FAISS vector index over ~50 common ICD-11 codes
- If BioBERT / transformers are not available (e.g., in Replit's limited environment), falls back to keyword-based TF-IDF matching using the same ICD-11 code list
- `POST /predict` — accepts `{ text }`, returns ranked `{ results: [{ code, description, score }], ai_available }` with up to 5 matches
- `GET /health` — returns service status and whether BioBERT is loaded

---

### Docker — project root

#### `docker-compose.yml`
Orchestrates four containers:
- **postgres** — PostgreSQL 16; health-checked with `pg_isready -U namaste -d namaste_icd`; data persisted in a named volume; exposed on host port **5433** (avoids conflicts with local Postgres installations)
- **ai-service** — Python FastAPI AI service; exposed on port **8001**
- **api-server** — Express API; depends on postgres being healthy; exposed on port **8080**
- **expo-web** — Expo web build; depends on api-server; exposed on port **3000**

#### `Dockerfile.api`
Builds the Express API image. Installs pnpm, copies workspace files, runs `pnpm install`, copies source, and copies the entrypoint script.

#### `entrypoint.api.sh`
Shell script that runs inside the api-server container at startup:
1. Uses `nc` (netcat) to wait for PostgreSQL to accept connections on port 5432
2. Runs `pnpm run push` (Drizzle schema migration) to create/update tables
3. Starts the Express API server

This ensures migrations always run against a live database, solving the race condition of running migrations at image build time.

#### `Dockerfile.expo`
Builds the Expo web image. Installs pnpm, copies workspace files and the Expo app source, then starts the Expo web server on port 3000 with `expo start --web`, bound correctly for Docker networking.

---

## Environment Variables

| Variable | Service | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | API Server | — | PostgreSQL connection string |
| `JWT_SECRET` | API Server | `namaste-icd11-secret-key-2024` | Secret key for signing JWTs |
| `PORT` | API Server | `8080` | Port the Express server listens on |
| `AI_SERVICE_URL` | API Server | `http://localhost:8001` | URL of the Python AI service |
| `EXPO_PUBLIC_DOMAIN` | Expo App | — | API host (e.g. `localhost:8080`); controls http vs https automatically |

---

## Running Locally with Docker

```bash
# Start all services
docker-compose up --build

# Access the app
# Mobile web app:  http://localhost:3000
# API backend:     http://localhost:8080/api/healthz
# AI service:      http://localhost:8001/health
```

On first run the entrypoint script will create all database tables automatically. No manual migration step is needed.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | Expo (React Native), Expo Router, TypeScript |
| UI | React Native StyleSheet, Feather Icons, BlurView |
| State | React Context (AuthContext, ApiContext), AsyncStorage |
| API Backend | Node.js, Express, TypeScript, tsx |
| Authentication | JWT (jsonwebtoken), bcryptjs |
| Database | PostgreSQL 16, Drizzle ORM |
| AI / ML | Python, FastAPI, BioBERT (HuggingFace), FAISS, keyword fallback |
| FHIR | FHIR R4 Condition resource (stored as JSONB) |
| DevOps | Docker, docker-compose |
