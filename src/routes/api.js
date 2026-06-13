import express from 'express';
import pool from '../config/db.js';
import { parseIntentAndEntities } from '../nlp/processor.js';

const router = express.Router();
const sessionState = {};

// 📋 Fixed Dashboard Data Endpoint with explicit logging
router.get('/appointments/list', async (req, res) => {
  console.log('📡 Frontend is fetching dashboard rows...');
  try {
    // Robust, universal formatting for Date and Time columns
    const query = `
      SELECT 
        a.appointment_id,
        p.name AS patient_name,
        d.name AS doctor_name,
        d.specialization,
        d.city,
        a.appointment_date::TEXT AS date,
        a.appointment_time::TEXT AS time,
        a.status
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN doctors d ON a.doctor_id = d.doctor_id
      ORDER BY a.appointment_date DESC, a.appointment_time DESC;
    `;
    const result = await pool.query(query);
    console.log(`✅ Success: Found ${result.rows.length} rows inside the database.`);
    return res.json(result.rows);
  } catch (err) {
    console.error('❌ SQL Execution Failure:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/doctors/search
router.get('/doctors/search', async (req, res) => {
  const { specialization, city } = req.query;
  try {
    let query = 'SELECT * FROM doctors WHERE is_available = true';
    const params = [];

    if (specialization) {
      params.push(specialization.toLowerCase());
      query += ` AND LOWER(specialization) = $${params.length}`;
    }
    if (city) {
      params.push(city.toLowerCase());
      query += ` AND LOWER(city) = $${params.length}`;
    }

    query += ' ORDER BY rating DESC';
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/voice/process
router.post('/voice/process', async (req, res) => {
  const { text, userId = 'default_user' } = req.body;
  if (!text) return res.status(400).json({ reply: "I didn't catch that. Could you repeat?" });

  const nlpResult = parseIntentAndEntities(text);
  
  if (!sessionState[userId]) {
    sessionState[userId] = { step: 'idle', context: {} };
  }
  
  const userSession = sessionState[userId];

  if (nlpResult && nlpResult.entities) {
    Object.keys(nlpResult.entities).forEach(key => {
      if (nlpResult.entities[key]) userSession.context[key] = nlpResult.entities[key];
    });
  }

  const currentIntent = nlpResult.intent || userSession.step;

  // 🩺 Find Doctor Flow
  if (currentIntent === 'find_doctor' || userSession.step === 'finding') {
    const { specialization, city } = userSession.context;
    
    if (!specialization) {
      userSession.step = 'finding';
      return res.json({ reply: "Which medical specialization are you looking for?" });
    }
    if (!city) {
      userSession.step = 'finding';
      return res.json({ reply: `In which city do you need a ${specialization}?` });
    }

    try {
      const docs = await pool.query(
        'SELECT * FROM doctors WHERE LOWER(specialization) = $1 AND LOWER(city) = $2 AND is_available = true ORDER BY rating DESC',
        [specialization.toLowerCase(), city.toLowerCase()]
      );

      if (!docs.rows || docs.rows.length === 0) {
        userSession.context = {}; 
        userSession.step = 'idle';
        return res.json({ reply: `I found no available ${specialization}s in ${city}. Try another combination.` });
      }

      const doctorList = docs.rows.map(d => `${d.name} with a rating of ${d.rating}`).join(', and ');
      userSession.step = 'awaiting_selection';
      
      return res.json({ 
        reply: `I found these options: ${doctorList}. Please say: Book, followed by the doctor's name, along with your preferred date and time.`
      });
    } catch (err) {
      return res.status(500).json({ reply: `Database error occurred while searching: ${err.message}` });
    }
  }

  // 📅 Book Appointment Flow
  if (currentIntent === 'book_appointment' || userSession.step === 'awaiting_selection' || userSession.step === 'booking') {
    let { doctorName, appointmentDate, appointmentTime } = userSession.context;

    if (!doctorName) {
      userSession.step = 'booking';
      return res.json({ reply: "Please mention the name of the doctor you want to book." });
    }
    if (!appointmentDate) {
      userSession.step = 'booking';
      return res.json({ reply: `What day would you like to see ${doctorName}?` });
    }
    if (!appointmentTime) {
      userSession.step = 'booking';
      return res.json({ reply: `What time would you prefer for your appointment on ${appointmentDate}?` });
    }

    try {
      const cleanSearchName = doctorName.toLowerCase().replace('dr.', '').trim();
      const docSearch = await pool.query('SELECT * FROM doctors WHERE LOWER(name) LIKE $1', [`%${cleanSearchName}%`]);
      
      if (!docSearch.rows || docSearch.rows.length === 0) {
        return res.json({ reply: `I could not find a doctor named ${doctorName} in our records.` });
      }
      
      const targetDoctor = docSearch.rows[0]; // Targeted first row cleanly

      // Check slot collisions
      const collisionCheck = await pool.query(
        'SELECT * FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3',
        [targetDoctor.doctor_id, appointmentDate, appointmentTime]
      );

      if (collisionCheck.rows && collisionCheck.rows.length > 0) {
        return res.json({ reply: `Sorry, ${targetDoctor.name} is already booked at ${appointmentTime} on ${appointmentDate}.` });
      }

      const defaultPatientId = 1;

      // Record appointment directly in PostgreSQL
      await pool.query(
        'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status) VALUES ($1, $2, $3, $4, $5)',
        [defaultPatientId, targetDoctor.doctor_id, appointmentDate, appointmentTime, 'confirmed']
      );

      const confirmationMessage = `Your appointment with ${targetDoctor.name} for ${appointmentDate} at ${appointmentTime} is confirmed.`;
      sessionState[userId] = { step: 'idle', context: {} };

      return res.json({ 
        reply: `Successfully booked! ${confirmationMessage}`
      });

    } catch (err) {
      return res.status(500).json({ reply: `Database error occurred during booking: ${err.message}` });
    }
  }

  return res.json({ reply: "I can help you find medical specialists or schedule an appointment. Try saying, 'I need a cardiologist in Delhi'." });
});

export default router;
