import dotenv from 'dotenv';
// Force dotenv to load before anything else
dotenv.config(); 

import pg from 'pg';

// Verification log to see what Node is reading
if (!process.env.DB_PASSWORD) {
  console.error("⚠️ Warning: DB_PASSWORD is not being read from the .env file!");
}

const pool = new pg.Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'medical_booking',
  // The String() wrapper prevents the SASL crash if the variable is blank
  password: String(process.env.DB_PASSWORD || ''), 
  port: parseInt(process.env.DB_PORT || '5432'),
});

pool.on('connect', () => {
  console.log('📌 Connected to PostgreSQL database cluster.');
});

export default pool;
