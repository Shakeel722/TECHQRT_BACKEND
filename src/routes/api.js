 import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import * as chrono from 'chrono-node'; 
import { understandPatient } from "../services/ai.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'clinical_matrix_secret_key_9988';

// Helper function to ask for missing fields
function buildReply(session, missingField) {
  switch (missingField) {
    case "specialization":
      if (session.city) {
        return `I can definitely find you a doctor in ${session.city}. What symptoms or medical concern are you experiencing?`;
      }
      return "Could you tell me a little more about your health concern or symptoms?";
      
    case "city": 
      return `I understand you're looking for a ${session.specialization}. Which city would you like the appointment in?`;
      
    case "date":
      return `Got it. You're looking for a ${session.specialization} in ${session.city}. What day would you like the appointment?`;
      
    case "time":
      return `Perfect. What time would be most convenient for your appointment?`;
      
    default:
      return "Could you tell me a little more about your health concern?";
  }
}

// =========================================================================
// 🏨 RECEPTIONIST STATE ENGINE: REFACTORED & BULLETPROOF
// =========================================================================
const conversationalSessions = {};

router.post('/voice/process', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Transcript input text is missing." });
    }

    // Identify user session
    const sessionId = req.user?.id || "global_reception_desk_session";

    if (!conversationalSessions[sessionId]) {
      conversationalSessions[sessionId] = {
        specialization: null,
        city: null,
        doctorName: null,
        date: null,
        time: null,
        symptoms: null,
        doctorId: null,
        awaitingConfirmation: false,
        history: []
      };
    }

    const session = conversationalSessions[sessionId];

    // Maintain history
    session.history.push({ role: "user", content: text });

    // Generate the context string from history
    const conversationContext = session.history
      .slice(-10)
      .map(h => `${h.role}: ${h.content}`)
      .join("\n");

    // Call LLM Intent extractor
    const aiData = await understandPatient(conversationContext);
    console.log("🤖 AI Extracted:", aiData);

    // ====================================================
    // SLOT FILLING STATE SYNC (Explicit overwriting fixes)
    // ====================================================
    
    // Always sync specialization. If the AI actively removed it because of a pivot, respect it.
    session.specialization = aiData.specialization ? aiData.specialization : null;

    if (aiData.doctorName) {
      if (session.doctorName && session.doctorName.toLowerCase() !== aiData.doctorName.toLowerCase()) {
        session.awaitingConfirmation = false;
        session.doctorId = null; 
      }
      session.doctorName = aiData.doctorName;
    } else {
      // If the user shifts back to explaining generic pain or symptoms, clear out the conflicting doctor name state
      const textLower = text.toLowerCase();
      if (textLower.includes("pain") || textLower.includes("sick") || textLower.includes("symptom") || aiData.specialization) {
        session.doctorName = null;
        session.doctorId = null;
        session.awaitingConfirmation = false;
      }
    }

    if (aiData.city) session.city = aiData.city.toLowerCase();
    if (aiData.date) session.date = aiData.date;
    if (aiData.time) session.time = aiData.time;
    if (!session.symptoms && text.length > 3) session.symptoms = text;

    // ====================
    // 1. CONFIRMATION STEP
    // ====================
    if (session.awaitingConfirmation && (text.toLowerCase().includes("no") || text.toLowerCase().includes("cancel") || text.toLowerCase().includes("change"))) {
      session.awaitingConfirmation = false;
      session.doctorName = null;
      session.doctorId = null;
      
      return res.json({
        reply: "No problem. Which doctor or specialization would you prefer to search for instead?"
      });
    }

    if (session.awaitingConfirmation && (text.toLowerCase().includes("yes") || text.toLowerCase().includes("confirm"))) {
      const doctorResult = await pool.query('SELECT * FROM doctors WHERE doctor_id = $1', [session.doctorId]);
      const doctor = doctorResult.rows[0];

      if (!doctor) {
        return res.json({ reply: "I'm sorry, I lost track of the doctor's details. Let's try finding them again." });
      }

      const appointmentDate = chrono.parseDate(`${session.date} ${session.time}`);
      const appointmentEnd = new Date(appointmentDate.getTime() + 60 * 60 * 1000); 

      await pool.query(
        `INSERT INTO appointments (patient_id, doctor_id, appointment_window, status, symptoms)
         VALUES ($1, $2, tstzrange($3, $4), 'confirmed', $5)`,
        [req.user?.id || 1, doctor.doctor_id, appointmentDate, appointmentEnd, session.symptoms]
      );

      delete conversationalSessions[sessionId];

      return res.json({
        reply: `Your appointment with Dr. ${doctor.name} has been booked successfully for ${session.date} at ${session.time}. Please login to your account using our web portal to review your appointment details, or to modify or cancel your booking manually from your user dashboard.`
      });
    }

    // ====================
    // 2. CHECK FOR MISSING FIELDS
    // ====================
    if (!session.specialization && !session.doctorName) return res.json({ reply: buildReply(session, "specialization") });
    if (!session.city) return res.json({ reply: buildReply(session, "city") });
    if (!session.date) return res.json({ reply: buildReply(session, "date") });
    if (!session.time) return res.json({ reply: buildReply(session, "time") });

    // ====================
    // 3. FIND MATCHING DOCTOR
    // ====================
    let doctor;

    if (session.doctorName) {
      const result = await pool.query(
        `SELECT * FROM doctors WHERE LOWER(name) LIKE LOWER($1) LIMIT 1`,
        [`%${session.doctorName}%`]
      );
      if (result.rows.length) doctor = result.rows[0];
    }

    if (!doctor && session.specialization) {
      const result = await pool.query(
        `SELECT d.* FROM doctors d
         JOIN specializations s ON d.specialization_id = s.id
         WHERE LOWER(s.name) = LOWER($1) AND LOWER(d.city) = LOWER($2)
         ORDER BY d.rating DESC LIMIT 1`,
        [session.specialization, session.city]
      );

      if (!result.rows.length) {
        session.specialization = null; 
        return res.json({
          reply: `Sorry, I couldn't find any available doctors for that specialty in ${session.city}. What other medical concern or symptom can I help you with?`
        });
      }
      doctor = result.rows[0];
    }

    if (!doctor) {
      return res.json({
        reply: `I couldn't find a doctor matched to your criteria in ${session.city || 'your area'}. Could you please specify your preferred specialty or doctor name again?`
      });
    }

    session.doctorId = doctor.doctor_id;
    session.awaitingConfirmation = true;

    return res.json({
      reply: `I found Dr. ${doctor.name} in ${session.city}. The consultation fee is ₹${doctor.fees}. Would you like me to confirm this appointment for ${session.date} at ${session.time}?`
    });

  } catch (err) {
    console.error("❌ Voice process error:", err);
    return res.status(500).json({ error: "Something went wrong while processing your request." });
  }
});

// ==========================================
// 🛡️ AUTHENTICATION MIDDLEWARE
// ==========================================
function verifyAuthToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; 

  if (!token) return res.status(401).json({ error: "Access Denied. Session token missing." });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified; 
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired session token." });
  }
}

// ==========================================
// 🧑‍🤝‍🧑 PATIENT AUTHENTICATION ENDPOINTS
// ==========================================

router.post('/auth/patient/register', async (req, res) => {
  const { name, email, phone_number, password } = req.body;
  if (!name || !email || !phone_number || !password) {
    return res.status(400).json({ error: "Missing required profile parameters." });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO public.patients (name, email, phone_number, password_hash) 
       VALUES ($1, $2, $3, $4) RETURNING patient_id, name, email`,
      [name, email, phone_number, passwordHash]
    );

    return res.status(201).json({ message: "Patient registered successfully", user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: "Email or Phone Number is already registered." });
    return res.status(500).json({ error: err.message });
  }
});

router.post('/auth/patient/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing login details." });

  try {
    const result = await pool.query('SELECT * FROM public.patients WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Invalid email or password." });

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: "Invalid email or password." });

    const token = jwt.sign({ id: user.patient_id, role: 'patient' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, user: { id: user.patient_id, name: user.name, role: 'patient' } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 🩺 DOCTOR AUTHENTICATION & SLOT CREATION
// ==========================================

router.post('/auth/doctor/register', async (req, res) => {
  const { name, email, specialization_id, city, password, hospital_address, fees } = req.body;
  if (!name || !email || !specialization_id || !city || !password) {
    return res.status(400).json({ error: "Missing core clinic parameters." });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO public.doctors (name, email, specialization_id, city, password_hash, hospital_address, fees) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING doctor_id, name, email`,
      [name, email, specialization_id, city, passwordHash, hospital_address || 'Main Medical Plaza', fees || 500]
    );

    return res.status(201).json({ message: "Doctor registered successfully", doctor: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: "Email address is already in use." });
    return res.status(500).json({ error: err.message });
  }
});

router.post('/auth/doctor/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing login details." });

  try {
    const result = await pool.query('SELECT * FROM public.doctors WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Invalid email or password." });

    const doctor = result.rows[0];
    const isMatch = await bcrypt.compare(password, doctor.password_hash);
    if (!isMatch) return res.status(401).json({ error: "Invalid email or password." });

    const token = jwt.sign({ id: doctor.doctor_id, role: 'doctor' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, user: { id: doctor.doctor_id, name: doctor.name, role: 'doctor' } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 📋 DASHBOARD MANAGEMENT DATA ENDPOINTS
// ==========================================

router.get('/appointments/list', async (req, res) => {
  try {
    const query = `
      SELECT 
        a.appointment_id,
        p.name AS patient_name,
        p.phone_number AS patient_phone,
        d.name AS doctor_name,
        s.name AS specialization,
        d.hospital_address,
        TO_CHAR(LOWER(a.appointment_window), 'YYYY-MM-DD') AS date,
        TO_CHAR(LOWER(a.appointment_window), 'HH24:MI') AS time,
        a.status
      FROM public.appointments a
      JOIN public.patients p ON a.patient_id = p.patient_id
      JOIN public.doctors d ON a.doctor_id = d.doctor_id
      LEFT JOIN public.specializations s ON d.specialization_id = s.id
      ORDER BY LOWER(a.appointment_window) DESC;
    `;
    const result = await pool.query(query);
    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Dashboard sync query failure:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ✅ FIXED: Completely rewritten to fix syntax corruption
router.get('/appointments/my-list', verifyAuthToken, async (req, res) => {
  try {
    let query = '';
    let queryParams = [req.user.id];

    if (req.user.role === 'patient') {
      query = `
        SELECT 
          a.appointment_id,
          p.name AS patient_name,
          d.name AS doctor_name,
          s.name AS specialization,
          d.hospital_address,
          TO_CHAR(LOWER(a.appointment_window), 'YYYY-MM-DD') AS date,
          TO_CHAR(LOWER(a.appointment_window), 'HH24:MI') AS time,
          a.status
        FROM public.appointments a
        JOIN public.patients p ON a.patient_id = p.patient_id
        JOIN public.doctors d ON a.doctor_id = d.doctor_id
        LEFT JOIN public.specializations s ON d.specialization_id = s.id
        WHERE a.patient_id = $1
        ORDER BY LOWER(a.appointment_window) DESC;
      `;
    } else if (req.user.role === 'doctor') {
      query = `
        SELECT 
          a.appointment_id,
          p.name AS patient_name,
          d.name AS doctor_name,
          s.name AS specialization,
          d.hospital_address,
          TO_CHAR(LOWER(a.appointment_window), 'YYYY-MM-DD') AS date,
          TO_CHAR(LOWER(a.appointment_window), 'HH24:MI') AS time,
          a.status
        FROM public.appointments a
        JOIN public.patients p ON a.patient_id = p.patient_id
        JOIN public.doctors d ON a.doctor_id = d.doctor_id
        LEFT JOIN public.specializations s ON d.specialization_id = s.id
        WHERE a.doctor_id = $1
        ORDER BY LOWER(a.appointment_window) DESC;
      `;
    } else {
      return res.status(400).json({ error: "Invalid role signature profile." });
    }

    const result = await pool.query(query, queryParams);
    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Personal dashboard sync query failure:", err.message);
    return res.status(500).json({ error: err.message });
  }
});


// ==========================================
// ❌ PATIENT APPOINTMENT CANCELLATION ENDPOINT
// ==========================================
router.patch('/appointments/cancel/:id', verifyAuthToken, async (req, res) => {
  const appointmentId = req.params.id;
  const patientId = req.user.id; // Extracted safely from the JWT token signature

  // Guard clause: Only patients should use this cancellation loop
  if (req.user.role !== 'patient') {
    return res.status(403).json({ error: "Unauthorized. Only patients can cancel appointments via this portal." });
  }

  try {
    // 1. Check if the appointment exists and belongs to this patient
    const verificationQuery = `
      SELECT * FROM public.appointments 
      WHERE appointment_id = $1 AND patient_id = $2
    `;
    const verificationResult = await pool.query(verificationQuery, [appointmentId, patientId]);

    if (verificationResult.rows.length === 0) {
      return res.status(404).json({ error: "Appointment not found, or you do not have permission to alter this record." });
    }

    // 2. Perform the cancellation update
    const updateQuery = `
      UPDATE public.appointments 
      SET status = 'cancelled' 
      WHERE appointment_id = $1 
      RETURNING appointment_id, status;
    `;
    const result = await pool.query(updateQuery, [appointmentId]);

    return res.json({ 
      message: "Appointment successfully cancelled.", 
      appointment: result.rows[0] 
    });

  } catch (err) {
    console.error("❌ Cancellation engine failure:", err.message);
    return res.status(500).json({ error: "Internal server error occurred while processing your cancellation request." });
  }
});

export default router;