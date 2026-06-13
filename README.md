# AI Voice-Based Medical Appointment Booking System

A production-ready, open-source AI voice assistant and administrative dashboard that allows patients to search for medical specialists and schedule clinic appointments using natural speech patterns. 

This system runs completely **local-first with 100% free and open-source tools**, eliminating cloud dependencies by executing all Natural Language Processing (NLP) and intent categorization directly inside the server loop.

---
#Quick start

# Clone your specific repository
git clone https://github.com

# Enter the project folder
cd backend_project

# Install all the NLP, database, and express backend libraries
npm install

# stay at backend folder 
node src/server.js -->  start backend

#open public/index.html and view in live server --> start frontend


## 🚀 Core Product Capabilities

- **Natural Speech-to-Text Input**: Integrates with the browser's native Web Speech API to capture spoken patterns and convert user audio into text strings.
- **Local AI / NLP Pipeline**: Categorizes intent and parses conversational entities (specializations, cities, doctor names, future calendar dates) locally via JavaScript algorithms (`natural`, `compromise`, and `chrono-node`).
- **Conversational State Tracking**: Employs a state-machine session memory controller to manage dialogue loops and prompt users for missing data variables (e.g., asking for a location if it was omitted).
- **PostgreSQL Database Storage**: Checks slot availability, flags scheduling collisions, and writes confirmed appointments into relational database tables.
- **Relational Administrative Dashboard**: Automatically aggregates table data grids with SQL join functions and updates the UI instantly when a user makes a voice booking.
- **Synthesized Voice Responses**: Generates auditory confirmations using Text-to-Speech (TTS) voice modulation directly over the patient's system hardware speakers.

---

## 🛠️ Open-Source Tech Architecture

### Frontend Layer
- **HTML5 & Modern CSS3**: Minimalist layout design tailored for high scannability.
- **Native JavaScript ES6+**: Implements network state syncing and browser runtime hooks.
- **Web Speech API**: Handles local audio pattern capture (`SpeechRecognition`) and text audio rendering (`SpeechSynthesis`).

### Backend Layer
- **Node.js & Express.js**: Handles asynchronous system threading and route distribution management.
- **Natural Language Toolsuite (`natural`)**: Powers the trained Logistic Regression intent classifier.
- **Compromise Language Toolkit (`compromise`)**: Performs Entity Extraction (NER) parsing routines.
- **Chrono Node Component (`chrono-node`)**: Turns conversational phrases (e.g., *"tomorrow at 4pm"*) into standardized datetime strings.

### Storage Layer
- **PostgreSQL**: Relational database managing doctor availability and appointment slots.

---

## 📂 Structural Tree Layout

```text
voice-medical-booking/
├── database/
│   └── schema.sql        # Database tables initialization blueprint and mock seed data
├── public/
│   ├── index.html        # Front-facing patient interface and admin table grid dashboard
│   └── app.js            # Client-side audio processing controller and data fetching loop
├── src/
│   ├── config/
│   │   └── db.js         # PostgreSQL connection pool orchestration initialization 
│   ├── nlp/
│   │   └── processor.js  # Rule-engine entity picker and pre-trained intent routing matrix
│   ├── routes/
│   │   └── api.js        # Conversational session-state controller and service endpoint blocks
│   └── server.js         # Orchestration hub, entry point service loop, and static hosting link
├── .env                  # Isolated environment key registry (Excluded from GitHub repository)
├── .gitignore            # Version control filtering instructions (Blocks node_modules and .env)
└── package.json          # Standard project configuration manifest and library tracking dependencies
```

---

## ⚡ Step-by-Step Installation & Launch

### Prerequisites
- [Node.js](https://nodejs.org) (v16 or higher)
- [PostgreSQL](https://postgresql.org) (Running on local system)

### 1. Repository Setup & Dependencies
Clone the repository to your local system and step into the project folder root:
```bash
cd "ai-voice-medical-booking"
npm install
```

### 2. Relational Schema Initialisation
Open your database command-line shell or GUI terminal client application dashboard, construct the primary target database, and seed the baseline records layout configuration:
```bash
# Generate core data catalog layout environment
psql -U postgres -c "CREATE DATABASE medical_booking;"

# Execute script orchestration pipeline to format schema table layouts and populate mock records
npm run seed
```

### 3. Environment Variables Mapping Configuration
Create a file named **`.env`** in the absolute root path folder directory level layout and enter your environment settings (Replace database passwords matching your local PostgreSQL parameters configuration):
```env
PORT=3000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=medical_booking
DB_PASSWORD=your_secure_postgres_password_here
DB_PORT=5432
```

### 4. Boot Up the Server Loop
Launch your server application path thread execution command:
```bash
npm start
```
*Your terminal screen console stream logs will confirm: `🚀 Production server running locally at http://localhost:3000`.*

---

## 🧪 Conversational Dialogue Execution Walkthrough

1. Direct Google Chrome or Microsoft Edge to `http://localhost:3000`.
2. Approve browser microphonic tracking authorization alerts.
3. **Step 1 (Search Request)**: Tap the **🎙️ Button** and clearly state: *"I need a cardiologist in Delhi"*.
   - *System Auditory Response*: *"I found these options: Dr. Amit Sharma with a rating of 4.8. Please say: Book, followed by the doctor's name..."*
4. **Step 2 (Booking Request)**: Click the **🎙️ Button** again and state: *"Book Dr. Amit tomorrow at 4 PM"*.
   - *System Auditory Response*: *"Successfully booked! Your appointment with Dr. Amit Sharma for [Date] at [Time] is confirmed."*
5. Look at the lower section of your screen layout grid: the **Appointment Dashboard data grid automatically updates** with a fresh table entry row matching your voice instructions!
