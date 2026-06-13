 import express from 'express';
import pool from '../config/db.js';
import { parseIntentAndEntities } from '../nlp/processor.js';

const router = express.Router();
const sessionState = {};

// Dashboard List Endpoint
router.get('/appointments/list', async (req, res) => {
  try {
    const query = `
      SELECT a.appointment_id, p.name AS patient_name, d.name AS doctor_name, d.specialization, d.city,
             a.appointment_date::TEXT AS date, a.appointment_time::TEXT AS time, a.status
      FROM appointments a JOIN patients p ON a.patient_id = p.patient_id JOIN doctors d ON a.doctor_id = d.doctor_id
      ORDER BY a.appointment_date DESC, a.appointment_time DESC;
    `;
    const result = await pool.query(query);
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/voice/process
router.post('/voice/process', async (req, res) => {
  const { text, userId = 'default_user' } = req.body;
  if (!text) return res.status(400).json({ reply: "I didn't quite catch that. Could you repeat it for me?" });

  try {
    // 🌍 Dynamic Entity System Fetching Layer
    const cityFetch = await pool.query('SELECT DISTINCT LOWER(city) as city FROM doctors WHERE is_available = true');
    const specFetch = await pool.query('SELECT DISTINCT LOWER(specialization) as spec FROM doctors WHERE is_available = true');
    const docFetch = await pool.query('SELECT name FROM doctors WHERE is_available = true');

    const systemEntities = {
      cities: cityFetch.rows.map(r => r.city),
      specializations: specFetch.rows.map(r => r.spec),
      doctors: docFetch.rows.map(r => r.name)
    };

    const nlpResult = parseIntentAndEntities(text, systemEntities);
    
    if (!sessionState[userId]) {
      sessionState[userId] = { step: 'idle', context: {} };
    }
    const userSession = sessionState[userId];

    // Merge parameters dynamically into the conversational context
    if (nlpResult && nlpResult.entities) {
      Object.keys(nlpResult.entities).forEach(key => {
        if (nlpResult.entities[key]) userSession.context[key] = nlpResult.entities[key];
      });
    }

    // 1. Intent: Goodbye acknowledgment
    if (nlpResult.intent === 'goodbye') {
      sessionState[userId] = { step: 'idle', context: {} };
      return res.json({ reply: "You are most welcome! Take great care of your health. Goodbye!" });
    }

    // 2. Intent: Greeting acknowledgment
    if (nlpResult.intent === 'greeting' && userSession.step === 'idle') {
      return res.json({ reply: "Hello! I am your clinic's assistant. Tell me, what symptoms are you experiencing, or which doctor are you looking for?" });
    }

    // 🎯 SMART STEP EVALUATOR: Forces doctor recommendation list if doctorName is blank
    let activeStep = userSession.step;
    
    if (userSession.context.specialization && !userSession.context.doctorName) {
      activeStep = 'finding';
    } else if (userSession.context.doctorName) {
      activeStep = 'booking';
    }

    // 🩺 FLOW A: Dynamic Doctor Discovery
    if (activeStep === 'finding') {
      const { specialization, city } = userSession.context;

      if (!specialization) {
        userSession.step = 'finding';
        return res.json({ reply: "I understand. Could you tell me a little more about what symptoms you are having so I can find the best specialist for you?" });
      }
      if (!city) {
        userSession.step = 'finding';
        return res.json({ reply: `Got it, a ${specialization}. And in which city are you looking to visit the clinic?` });
      }

      const docs = await pool.query(
        'SELECT * FROM doctors WHERE LOWER(specialization) = $1 AND LOWER(city) = $2 AND is_available = true ORDER BY rating DESC',
        [specialization.toLowerCase(), city.toLowerCase()]
      );

      if (!docs.rows || docs.rows.length === 0) {
        userSession.context = {}; 
        userSession.step = 'idle';
        return res.json({ reply: `I checked, but we don't have an available ${specialization} in ${city} right now. Would you like to try another city?` });
      }

      const doctorList = docs.rows.map(d => `${d.name} (rated ${d.rating} stars)`).join(', and ');
      userSession.step = 'awaiting_selection'; // Lock step to expect doctor selection next
      
      return res.json({ 
        reply: `Excellent. I found these choices in ${city}: we have ${doctorList}. Which doctor would you prefer, and what day or time works best for you?`
      });
    }

    // 📅 FLOW B: Dynamic Slot Validation and Booking
    if (activeStep === 'booking') {
      let { doctorName, appointmentDate, appointmentTime } = userSession.context;

      if (!doctorName) {
        return res.json({ reply: "Which doctor would you like me to book your slot with?" });
      }
      if (!appointmentDate) {
        return res.json({ reply: `Sure, let's get you scheduled with ${doctorName}. What date or day would you like to come in?` });
      }
      if (!appointmentTime) {
        return res.json({ reply: `Understood, ${appointmentDate}. And what time should I reserve for your visit with ${doctorName}?` });
      }

      const cleanSearchName = doctorName.toLowerCase().replace('dr.', '').trim();
      const docSearch = await pool.query('SELECT * FROM doctors WHERE LOWER(name) LIKE $1', [`%${cleanSearchName}%`]);
      
      if (!docSearch.rows || docSearch.rows.length === 0) {
        userSession.context.doctorName = null;
        return res.json({ reply: `I searched our roster, but I couldn't find ${doctorName}. Could you say the doctor's name again for me?` });
      }
      
      // ✅ FIX: Extract the FIRST doctor row item object out of the query array
      const targetDoctor = docSearch.rows[0]; 

      // Collision handling execution block
      const collisionCheck = await pool.query(
        'SELECT * FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3',
        [targetDoctor.doctor_id, appointmentDate, appointmentTime]
      );

      if (collisionCheck.rows && collisionCheck.rows.length > 0) {
        userSession.context.appointmentTime = null; 
        return res.json({ reply: `Oh, it looks like ${targetDoctor.name} is already booked at ${appointmentTime} on ${appointmentDate}. Is there another time slot that works?` });
      }

      const defaultPatientId = 1;

      // Commit appointment slot row into PostgreSQL database
      await pool.query(
        'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status) VALUES ($1, $2, $3, $4, $5)',
        [defaultPatientId, targetDoctor.doctor_id, appointmentDate, appointmentTime, 'confirmed']
      );

      sessionState[userId] = { step: 'idle', context: {} };

      return res.json({ 
        reply: `All done! I have successfully scheduled your appointment with ${targetDoctor.name} for ${appointmentDate} at ${appointmentTime}. We look forward to seeing you then!`
      });
    }

    return res.json({ reply: "I'm here to guide you. Tell me what symptoms you are experiencing, or ask to book a specific doctor directly." });

  } catch (err) {
    console.error("System Error caught execution exception:", err);
    return res.status(500).json({ reply: "I ran into a server error processing that request." });
  }
});

export default router;
