# 🩺 Clinical Matrix Voice AI Receptionist

Clinical Matrix is an advanced, AI-driven medical receptionist and appointment booking engine. It combines a conversational voice-processing pipeline (powered by Groq Cloud APIs and LLMs) with a secure, role-based backend architecture to automate slot-filling and appointment orchestration natively in PostgreSQL.

---

## 🚀 Key System Features

* **🎙️ Contextual Voice Booking Engine:** Evaluates natural patient utterances, dynamically maps physical symptoms directly to clinical specializations (e.g., *chest pain* ➔ *cardiologist*), and resolves date parameters intelligently.
* **🧠 State Machine Deadlock Prevention:** Intelligently tracks state history to allow patients to pivot to new doctors or specialties mid-session, safely overriding historical loops.
* **🔐 Dual-Role Authentication Suite:** Secure, password-hashed (`bcryptjs`) registration and login flows providing independent access signatures for both **Patients** and **Doctors**.
* **🛡️ Row-Level Protected Dashboards:** Implements JSON Web Token (`JWT`) middleware authorization to serve custom database views dynamically depending on the authenticated role.
* **❌ Secure Mutation Pipelines:** Dedicated cancellation endpoint ensuring patients can only modify or invalidate their own upcoming medical slots.

---

## 🛠️ Tech Stack & Dependencies

* **Backend Runtime:** Node.js, Express.js
* **Database Tier:** PostgreSQL (utilizes `tstzrange` for advanced appointment windows)
* **Artificial Intelligence:** Groq Cloud SDK / Llama-3 (Contextual Slot Extraction)
* **Natural Language Date Parsing:** `chrono-node`
* **Security & Hashing:** `jsonwebtoken` (JWT), `bcryptjs`

---

## 📂 Project Architecture

```text
├── config/
│   └── db.js                 # PostgreSQL connection pool configuration
├── public/
│   ├── app.js                # Testing workbench core logic scripts
│   └── test-workbench.html   # HTML UI suite for live routing tests
├── services/
│   └── ai.js                 # Groq LLM integration & prompt optimization rules
├── src/
│   ├── routes/
│   │   └── api.js            # Core state engine, auth handlers, and CRUD routes
│   └── server.js             # Express application entrypoint
├── .env                      # Environment configurations (ignored)
└── package.json




⚙️ Initial Installation & Environment Setup
1. Clone the Repository & Install Dependencies
Bash
git clone [https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git)
cd YOUR_REPOSITORY_NAME
npm install


2. Configure Environment Variables
Create a .env file at the root of your project directory:
PORT=3000
DATABASE_URL=postgresql://username:password@localhost:5432/clinical_matrix_db
JWT_SECRET=clinical_matrix_secret_key_9988
GROQ_API_KEY=your_groq_cloud_api_key_here


Core API Routing Reference
🔐 Authentication Endpoints
POST /api/auth/patient/register - Registers a new user seeking consultation.

POST /api/auth/patient/login - Authenticates a patient and returns a Bearer token.

POST /api/auth/doctor/register - Adds a practicing physician to the hospital roster.

POST /api/auth/doctor/login - Authenticates a physician workspace session.

Conversational Engine
POST /api/voice/process - Processes chat transcripts. Persists slots over a 10-turn rolling context and executes database slot finder logic.

🛡️ Secure Dashboard & Control Endpoints
GET /api/appointments/my-list - [Protected] Returns personalized records. Adapts responses automatically based on whether a Doctor or Patient token is supplied.

PATCH /api/appointments/cancel/:id - [Protected] Updates target appointment status flags to cancelled. Verifies record ownership before mutation.



🎛️ Local API Verification Suite
The project includes an embedded graphical testing workbench. You can verify every single backend network route locally without external tooling (like Postman).

Spin up your server instance locally:

Bash:
node src/server.js

Open a standard browser tab and navigate to:
testing:
http://localhost:3000/test-workbench.html
