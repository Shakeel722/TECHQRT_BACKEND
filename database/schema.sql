-- Drop tables if they exist
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;

-- Create Doctors Table
CREATE TABLE doctors (
    doctor_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    rating NUMERIC(2,1) CHECK (rating >= 0 AND rating <= 5),
    is_available BOOLEAN DEFAULT TRUE
);

-- Create Patients Table
CREATE TABLE patients (
    patient_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- Create Appointments Table
CREATE TABLE appointments (
    appointment_id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES patients(patient_id) ON DELETE CASCADE,
    doctor_id INT REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed',
    symptoms TEXT,
    CONSTRAINT unique_doctor_slot UNIQUE (doctor_id, appointment_date, appointment_time)
);

-- Seed Seed Data
INSERT INTO doctors (name, specialization, city, rating, is_available) VALUES
('Dr. Amit Sharma', 'cardiologist', 'delhi', 4.8, true),
('Dr. Priya Patel', 'dermatologist', 'delhi', 4.6, true),
('Dr. Rohan Mehta', 'cardiologist', 'mumbai', 4.9, true),
('Dr. Ananya Iyer', 'pediatrician', 'mumbai', 4.7, true),
('Dr. Vikram Singh', 'orthopedist', 'delhi', 4.5, true);

INSERT INTO patients (name) VALUES 
('Default Test Patient');
