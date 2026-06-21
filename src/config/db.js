 import dotenv from 'dotenv';
  dotenv.config();

// PostgreSQL database configuration

// import pg from 'pg';

// const { Pool } = pg;

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false,
//   },
// });

// pool.on('connect', () => {
//   console.log('📌 Connected to Neon PostgreSQL database.');
// });

// export default pool;



// local PostgreSQL database configuration


import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'appointment_db',
    password: process.env.DB_PASSWORD, 
    port: process.env.DB_PORT || 5432,
});

pool.connect()
    .then(() => {
        console.log('PostgreSQL Connected Successfully');
    })
    .catch((err) => {
        console.error('Database Connection Error:', err);
    });

export default pool;