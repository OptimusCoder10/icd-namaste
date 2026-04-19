# NAMASTE-ICD11 Clinical Mapper

A full-stack AI-powered mobile application that maps clinical symptoms and NAMASTE terminology to ICD-11 diagnostic codes. Doctors can enter symptoms manually or **scan a clinical image** to extract text via OCR, receive ranked ICD-11 suggestions with confidence scores, link diagnoses to specific patients, and save records as FHIR R4 Condition resources. Patients can view and search all diagnoses linked to them by their doctors.

---

## Table of Contents

1. [Features](#features)
2. [Architecture Overview](#architecture-overview)
3. [File-by-File Reference](#file-by-file-reference)
   - [Mobile App](#mobile-app--artifactsnamaste-icd)
   - [API Backend](#api-backend--artifactsapi-serversrc)
   - [Database](#database--libdbsrc)
   - [AI Service](#ai-service--ai-service)
   - [Docker](#docker--project-root)
4. [Database](#database-access)
5. [Environment Variables](#environment-variables)
6. [Running Locally with Docker](#running-locally-with-docker)
7. [Running in Development (Replit)](#running-in-development-replit)
8. [Tech Stack](#tech-stack)

---

## Features

### Authentication & Roles
- **Role-based sign-up** — users register as either a **Doctor** or a **Patient**
- **JWT authentication** — secure login with tokens stored locally on the device
- **Session persistence** — logged-in state is remembered across app restarts
- **Role-aware UI** — the entire app adapts its tabs, screens, and content based on the user's role

### Doctor Features

#### Symptom Input & ICD-11 Mapping
- **Free-text symptom entry** — type symptoms, NAMASTE terminology, or clinical descriptions
- **Example chips** — quick-fill buttons for common clinical queries (fever, chest pain, dengue, etc.)
- **AI-powered ICD-11 matching** — sends symptoms to a BioBERT + FAISS vector search engine; automatically falls back to keyword matching when BioBERT is unavailable
- **Ranked results** — up to 5 ICD-11 code matches returned with AI confidence scores, ranked highest first
- **Doctor confidence control** — for each AI result, the doctor can adjust a 0–100% confidence score using +10 / +5 / -5 / -10 buttons, pre-filled from the AI score
- **Confirm & Save** — saves the selected diagnosis as an FHIR R4 Condition resource to the database, including AI score, doctor confidence, and the linked patient

#### Clinical Image Scanning (OCR)
- **Scan Clinical Image card** — in the Diagnose screen, doctors can scan a physical clinical note or prescription to auto-fill the symptom input
- **Gallery picker** — choose any image from the device photo library
- **Camera capture** — photograph a document or clinical note live using the device camera
- **In-process OCR** — the image is sent to the API server where `tesseract.js` extracts text directly (no external service dependency); works on web and native
- **Auto-fill** — extracted text is placed directly into the symptom input field, ready for ICD mapping
- **File name badge** — shows which image was scanned underneath the input

#### Patient Linking
- **Patient search autocomplete** — while filling out a diagnosis, doctors can type a patient's name and select from a live-filtered dropdown of registered patients
- **Diagnosis attribution** — saved records include the linked `patient_id`, so patients can see diagnoses linked to them
- **Privacy enforced** — the patient search API returns only patient ID and name (no email or sensitive data)

#### Records & History
- **My Records tab** — view all their own saved FHIR records, with AI and doctor confidence bars shown on each card
- **FHIR detail modal** — tap any record to see full FHIR JSON, confidence breakdown, linked patient name, and metadata

### Patient Features
- **Diagnoses tab** — view all doctor-confirmed diagnoses linked to them specifically, sorted by doctor confidence (highest first); each card shows the doctor's name, ICD code, disease name, and confidence bars
- **Search tab** — search across all their linked diagnoses in real time by disease name, ICD-11 code, or symptom text; results sorted by doctor confidence
- **Common search chips** — quick-tap suggestions for frequent searches (fever, chest pain, diabetes, etc.)
- **Full detail modal** — tap any result to see complete FHIR JSON and confidence breakdown

---

## Architecture Overview

```
namaste-icd11/
├── artifacts/
│   ├── namaste-icd/          Expo React Native mobile app (web + iOS + Android)
│   └── api-server/           Express.js REST API backend
│       └── dist/index.cjs    Production bundle (esbuild)
├── lib/
│   ├── db/                   Drizzle ORM schema + PostgreSQL client
│   ├── api-spec/             OpenAPI specification
│   ├── api-zod/              Auto-generated Zod validators
│   └── api-client-react/     Auto-generated React API client
├── ai-service/               Python FastAPI AI service (BioBERT + FAISS keyword fallback)
├── docker-compose.yml        Docker orchestration for all services
├── Dockerfile.api            Docker image for Express API
├── Dockerfile.expo           Multi-stage Docker image for Expo web app (build + nginx)
├── Dockerfile.ai             Docker image for Python AI service
├── entrypoint.api.sh         Startup: waits for DB, runs Drizzle migrations, starts API
└── .dockerignore             Excludes node_modules, build artifacts from Docker build context
```

### Service Map

| Service | Port (Dev) | Port (Docker) | Technology |
|---|---|---|---|
| Expo Web App | 20284 | 3000 | Expo React Native, Metro / nginx |
| Express API | 8080 | 8080 | Node.js, Express, TypeScript |
| Python AI Service | 8001 | 8001 | Python, FastAPI, FAISS |
| PostgreSQL | 5432 | 5433 | PostgreSQL 16 |

> **Note:** In the published (deployed) version, the Python AI service is not deployed. The Express API uses its built-in keyword fallback for ICD prediction and `tesseract.js` for OCR — both running in the same Node.js process.

---

## File-by-File Reference

### Mobile App — `artifacts/namaste-icd/`

#### `app/auth.tsx`
The login and registration screen. Renders email, password, and full name inputs. In register mode, shows a **Doctor / Patient role selector** (toggle buttons). On submit, calls the auth context login or register function and navigates to the main tabs. Displays inline error messages for failed attempts.

#### `app/(tabs)/_layout.tsx`
Defines the bottom tab navigation. Reads the logged-in user's role and renders tabs accordingly:
- **Doctor**: "Diagnose" tab + "My Records" tab
- **Patient**: "Portal" tab + "Diagnoses" tab + "Search" tab

#### `app/(tabs)/input.tsx`
The main doctor screen. Contains three major sections:

**1. Scan Clinical Image card**
A card UI with two buttons — "Gallery" and "Camera". Tapping either:
- Requests the appropriate permission (media library or camera)
- Opens `expo-image-picker` with `base64: true` so the image data is returned directly without needing to fetch blob URLs
- Calls `extractText(base64, mimeType)` from ApiContext which sends the data to `/api/extract-text`
- Displays a loading spinner while OCR is in progress
- Auto-fills the symptom input with the extracted text
- Shows the image file name as a badge below the input

**2. Symptom input**
- Free-text area with animated shake effect on empty submission
- Example chips that fill the input on tap
- Patient search autocomplete — as the doctor types a patient name, a dropdown appears with matching patients fetched from `/api/patients/search`; selecting a patient sets the `patient_id` for the saved record

**3. Results panel**
- "Generate" button triggers `/api/predict`
- Results show ICD code, description, AI score, and doctor confidence controls (+10/+5/-5/-10)
- "Confirm & Save" saves the record with both confidence values and the linked patient

If the logged-in user is a **patient**, this screen renders a patient portal message instead.

#### `app/(tabs)/history.tsx`
Role-aware history/diagnoses screen.
- **Doctor view**: lists their own FHIR records sorted by date (newest first); shows patient name badge when a diagnosis is linked to a patient; both AI and doctor confidence bars shown
- **Patient view**: lists all records where `patient_id` matches the logged-in patient, sorted by doctor confidence; shows doctor name badge and confidence indicators
- Tapping any record opens a modal with full FHIR JSON, confidence breakdown, and attribution

#### `app/(tabs)/search.tsx`
Patient-only search screen.
- Live debounced search (400ms delay)
- Common search suggestion chips
- Results sorted by doctor confidence, showing ICD code, disease name, doctor name, date, and confidence bars
- Detail modal identical to the history screen

#### `context/AuthContext.tsx`
React context providing authentication state throughout the app. Stores `user` (id, email, name, role) and `token` in AsyncStorage for persistence. Exposes `login`, `register`, and `logout`. Constructs the API base URL from `EXPO_PUBLIC_DOMAIN`, automatically switching between `http://` (localhost/Docker) and `https://` (Replit/production).

#### `context/ApiContext.tsx`
React context wrapping all API calls. Attaches the JWT Bearer token to every request automatically. Exposes:
- `predict(text)` — sends symptom text; returns ranked ICD-11 matches
- `saveRecord(data)` — saves a confirmed diagnosis with AI + doctor confidence and optional `patient_id`
- `getHistory()` — fetches records (doctor: own records; patient: records where `patient_id` matches)
- `searchRecords(query)` — searches records by ICD code, description, or symptom text
- `searchPatients(query)` — searches registered patients by name; used for doctor autocomplete
- `extractText(base64, mimeType)` — sends a base64-encoded image to `/api/extract-text`; returns extracted text string

#### `components/ScoreBar.tsx`
Reusable horizontal confidence bar. Accepts a `score` between 0 and 1. Colour transitions from red → amber → green based on value.

#### `constants/colors.ts`
Centralised colour palette for the light theme used across all screens.

---

### API Backend — `artifacts/api-server/src/`

#### `index.ts`
Entry point. Reads `PORT` from the environment and starts the Express server.

#### `app.ts`
Configures the Express application:
- Applies CORS (all origins)
- JSON body parsing with a **20MB limit** (required for base64-encoded images)
- URL-encoded body parsing with a 20MB limit
- Mounts all route modules under `/api`

#### `routes/auth.ts`
Handles user authentication.
- `POST /api/auth/register` — hashes password with bcrypt; inserts user; returns JWT + user object including role
- `POST /api/auth/login` — verifies credentials; returns JWT + user object

#### `routes/records.ts`
Manages FHIR diagnosis records.
- `POST /api/records` — **doctors only**; accepts `input_text`, `selected_icd`, `icd_description`, `confidence_score` (AI, 0–1), `doctor_confidence` (0–100), and optional `patient_id`; builds and stores FHIR R4 Condition JSON
- `GET /api/records` — role-aware: doctors get their own records (joined with patient name); patients get only records where `patient_id = userId` (joined with doctor name), sorted by `doctor_confidence` descending
- `GET /api/records/search?q=...` — case-insensitive search across `selected_icd`, `icd_description`, `input_text`; doctors search their own records, patients search their linked records

#### `routes/patients.ts`
Patient search for the doctor autocomplete.
- `GET /api/patients/search?q=...` — **doctors only**; returns a list of `{ id, name }` for registered patients whose name matches the query; email and other sensitive fields are excluded

#### `routes/predict.ts`
ICD-11 prediction with graceful fallback.
- `POST /api/predict` — forwards symptom text to the Python AI service (`AI_SERVICE_URL/predict`); if the AI service is unreachable or returns an error, automatically falls back to the built-in keyword matching function
- The fallback maps symptom keywords to a curated list of ~15 common ICD-11 codes with scored relevance

#### `routes/extract.ts`
Clinical image OCR endpoint.
- `POST /api/extract-text` — **doctors only**; accepts `{ image_b64: string, mime_type: string }` as JSON
- Decodes the base64 image into a `Buffer`
- Creates a `tesseract.js` worker, runs English OCR recognition on the buffer, terminates the worker
- Returns `{ text: string, chars: number }`
- `tesseract.js` runs entirely within the Node.js process — no external Python service or system Tesseract installation required

#### `routes/health.ts`
- `GET /api/healthz` — returns `{ status: "ok" }` for health checks

#### `middlewares/auth.ts`
JWT verification middleware. Reads `Authorization: Bearer <token>`, verifies against `JWT_SECRET`, attaches `userId` and `userRole` to the request. `requireDoctor` extends `requireAuth` and rejects non-doctor requests with 403.

#### `build.ts`
esbuild configuration for the production bundle. Bundles most dependencies inline for fast cold starts. `tesseract.js` is intentionally kept **external** (not bundled) so that its worker thread scripts can be resolved correctly from `node_modules` at runtime. The output is `dist/index.cjs`.

---

### Database — `lib/db/src/`

#### `schema/index.ts`
Defines all PostgreSQL tables using Drizzle ORM:

- **`users`** — `id`, `email` (unique), `name`, `password_hash`, `role` (`doctor` | `patient`), `created_at`
- **`records`** — `id`, `user_id` (FK → users, the doctor), `patient_id` (FK → users, nullable — the linked patient), `input_text`, `selected_icd`, `icd_description`, `confidence_score` (float, AI score 0–1), `doctor_confidence` (integer 0–100, nullable), `fhir_json` (JSONB), `created_at`
- **`icd_codes`** — `code` (PK), `description` — reference table

#### `index.ts`
Creates and exports the Drizzle database client using `pg.Pool` and `DATABASE_URL`. Re-exports schema for easy import via `@workspace/db`.

#### `drizzle.config.ts`
Drizzle Kit configuration. Used by `pnpm run push` to sync schema changes to PostgreSQL.

---

### AI Service — `ai-service/`

#### `main.py`
Python FastAPI service running on port 8001. Used for ICD-11 prediction only (OCR has moved to the API server).

- On startup, attempts to load `dmis-lab/biobert-v1.1` from HuggingFace and build a FAISS vector index over ~50 ICD-11 codes
- Falls back to keyword-based matching if BioBERT / transformers are unavailable
- `POST /predict` — accepts `{ text }`, returns `{ results: [{ code, description, score }], ai_available }`
- `POST /extract-text` — accepts `{ image_b64, filename }`, runs Tesseract OCR via `pytesseract`; used only in local development (not in production deployment)
- `GET /health` — returns service status and whether BioBERT is loaded

#### `Dockerfile`
Installs `tesseract-ocr` system package, `pytesseract`, `Pillow`, `faiss-cpu`, `fastapi`, and `uvicorn`. PyTorch and transformers are optional — the service runs fine without them using keyword fallback.

#### `requirements.txt`
Pinned Python dependencies: `fastapi`, `uvicorn`, `pydantic`, `numpy`, `faiss-cpu`, `pytesseract`, `Pillow`.

---

### Docker — project root

#### `docker-compose.yml`
Orchestrates four containers:

| Container | Image | Host Port | Notes |
|---|---|---|---|
| `postgres` | postgres:16-alpine | 5433 | Data in named volume; health-checked with `pg_isready` |
| `ai-service` | ./ai-service | 8001 | BioBERT + FAISS; falls back to keyword matching |
| `api-server` | Dockerfile.api | 8080 | Waits for DB health, runs migrations, then starts |
| `expo-web` | Dockerfile.expo | 3000 | Static web build served by nginx |

`EXPO_PUBLIC_DOMAIN=localhost:8080` is baked into the Expo web bundle at build time so the browser can reach the API.

#### `Dockerfile.api`
Builds the Express API image:
1. Installs `pnpm` and `netcat-openbsd` (for the DB readiness check)
2. Copies workspace manifests and installs dependencies (layer-cached)
3. Copies source files
4. Uses `entrypoint.api.sh` as the container entry point

#### `entrypoint.api.sh`
Shell script that runs inside the api-server container at startup:
1. Polls `nc -z postgres 5432` until PostgreSQL is accepting connections
2. Runs `pnpm run push` (Drizzle schema migration) to create/update tables
3. Starts the Express API server

#### `Dockerfile.expo`
Two-stage build:
- **Stage 1 (builder)** — installs pnpm, installs dependencies, runs `expo export --platform web` with `EXPO_PUBLIC_DOMAIN=localhost:8080` baked into the bundle
- **Stage 2 (serve)** — copies the exported `dist/` folder into an `nginx:alpine` image; nginx is configured with an SPA fallback (`try_files $uri /index.html`) so page refreshes work correctly

#### `.dockerignore`
Excludes `node_modules`, `**/node_modules`, `.git`, `.env`, `*.log`, `dist`, `build`, `.expo`, `static-build`, metro cache, and `.local` from the Docker build context to keep builds fast.

---

## Database Access

The application uses PostgreSQL. You can inspect the data in several ways:

### Inside Replit
Open the **Database** panel in the left sidebar for a visual table browser.

### With Docker (no extra tools needed)
```bash
docker compose exec postgres psql -U namaste -d namaste_icd
```
Then run standard SQL:
```sql
SELECT * FROM users;
SELECT * FROM records ORDER BY created_at DESC;
SELECT u1.name AS doctor, u2.name AS patient, r.selected_icd, r.doctor_confidence
FROM records r
JOIN users u1 ON r.user_id = u1.id
LEFT JOIN users u2 ON r.patient_id = u2.id;
```

### With a GUI (TablePlus, DBeaver, pgAdmin)
| Field | Value |
|---|---|
| Host | `localhost` |
| Port | `5433` |
| Database | `namaste_icd` |
| Username | `namaste` |
| Password | `namaste123` |

### With psql on your machine
```bash
psql -h localhost -p 5433 -U namaste -d namaste_icd
```

---

## Environment Variables

| Variable | Service | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | API Server | — | PostgreSQL connection string |
| `JWT_SECRET` | API Server | `namaste-icd11-local-secret-change-me` | Secret key for signing JWTs — change in production |
| `PORT` | API Server | `8080` | Port the Express server listens on |
| `AI_SERVICE_URL` | API Server | `http://localhost:8001` | URL of the Python AI service for prediction |
| `NODE_ENV` | API Server | `development` | Set to `production` in deployed builds |
| `EXPO_PUBLIC_DOMAIN` | Expo App | — | API host (e.g. `localhost:8080`); controls `http://` vs `https://` automatically |
| `AI_SERVICE_PORT` | AI Service | `8001` | Port the Python FastAPI service listens on |

---

## Running Locally with Docker

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Start everything
```bash
docker compose up --build
```

On first run, the entrypoint script automatically creates all database tables. No manual migration step needed.

### Access the app
| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| API health check | http://localhost:8080/api/healthz |
| AI service health | http://localhost:8001/health |
| PostgreSQL | localhost:5433 |

### Stop everything
```bash
docker compose down
```

### Stop and delete all data
```bash
docker compose down -v
```

### Rebuild after code changes
```bash
docker compose up --build
```

### Using a remote API server
If your API server is hosted elsewhere, override the domain when building:
```bash
EXPO_PUBLIC_DOMAIN=my-server.example.com docker compose up --build
```

---

## Running in Development (Replit)

Three workflows run in parallel:

| Workflow | Command | Port |
|---|---|---|
| AI Service | `python3 ai-service/main.py` | 8001 |
| API Server | `PORT=8080 pnpm --filter @workspace/api-server run dev` | 8080 |
| NAMASTE-ICD11 App | `pnpm exec expo start --localhost --port 20284` | 20284 |

The Expo app is served by Metro bundler in development and auto-reloads on file changes.
The API server runs via `tsx` (TypeScript execute) and also auto-reloads.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | Expo 54, React Native, Expo Router, TypeScript |
| UI Components | React Native StyleSheet, Expo vector icons, BlurView, Haptics |
| State Management | React Context (AuthContext, ApiContext), AsyncStorage |
| API Backend | Node.js, Express 5, TypeScript, tsx (dev), esbuild (prod) |
| Authentication | JWT (jsonwebtoken), bcryptjs |
| Database ORM | Drizzle ORM, Drizzle Kit (migrations) |
| Database | PostgreSQL 16 |
| OCR (in-process) | tesseract.js (pure JavaScript/WASM — no system install needed) |
| Image Picker | expo-image-picker (Gallery + Camera, base64 mode) |
| AI / ML | Python, FastAPI, BioBERT (HuggingFace), FAISS, keyword fallback |
| OCR (AI service) | pytesseract, Pillow, Tesseract OCR (local dev only) |
| FHIR | FHIR R4 Condition resource stored as JSONB |
| Containerisation | Docker, docker-compose, nginx (static web serving) |
| Monorepo | pnpm workspaces |
