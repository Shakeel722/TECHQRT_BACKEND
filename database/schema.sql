 -- =========================================================================
-- 🗄️ FINAL UNIFIED CLINIC DATABASE SCHEMA (pgAdmin Compatible)
-- Includes: Authentication, Range Constraints, Availability Slots & Seed Data
-- =========================================================================

-- Step 1: Clean up existing data definitions securely
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.doctor_availability CASCADE;
DROP TABLE IF EXISTS public.doctors CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.specialization_synonyms CASCADE;
DROP TABLE IF EXISTS public.specializations CASCADE;

-- Step 2: Enable the essential spatial indexing engine extension
-- (Crucial for computing '&&' overlapping operations on appointment/availability ranges)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ==========================================
-- 🏢 TABLES CREATION LAYER
-- ==========================================

-- 🧬 1. Medical Specializations Master List
CREATE TABLE public.specializations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 🏷️ 2. Specialization Synonyms Table (Maps colloquial speech/symptoms to medical fields)
CREATE TABLE public.specialization_synonyms (
    synonym_id SERIAL PRIMARY KEY,
    specialization_id INT REFERENCES public.specializations(id) ON DELETE CASCADE,
    synonym_name VARCHAR(100) UNIQUE NOT NULL
);

-- 🩺 3. Doctors Registry Profile Table (With Authentication Fields)
CREATE TABLE public.doctors (
    doctor_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    specialization_id INT REFERENCES public.specializations(id) ON DELETE SET NULL,
    city VARCHAR(100) NOT NULL,
    hospital_address TEXT DEFAULT 'Main Medical Plaza',
    fees INT DEFAULT 500 CHECK (fees >= 0),
    rating NUMERIC(2,1) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 🧑‍🤝‍🧑 4. Patients Account Profile Table (With Authentication Fields)
CREATE TABLE public.patients (
    patient_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 🗓️ 5. Doctor Availability Management Table (Doctor-Defined Open Slots)
CREATE TABLE public.doctor_availability (
    slot_id SERIAL PRIMARY KEY,
    doctor_id INT REFERENCES public.doctors(doctor_id) ON DELETE CASCADE,
    
    -- The time block during which the doctor is physically open for bookings
    available_window TSTZRANGE NOT NULL, 
    
    is_booked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- PREVENT DUPLICATE OPEN SLOTS: A doctor cannot publish overlapping available times
    CONSTRAINT no_overlapping_availability_entries EXCLUDE USING gist (
        doctor_id WITH =,
        available_window WITH &&
    )
);

-- 📅 6. Appointments Atomic Matrix Table
CREATE TABLE public.appointments (
    appointment_id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES public.patients(patient_id) ON DELETE CASCADE,
    doctor_id INT REFERENCES public.doctors(doctor_id) ON DELETE CASCADE,
    
    -- Combines appointment date, start time, and end time into an immutable math window
    appointment_window TSTZRANGE NOT NULL, 
    
    status VARCHAR(50) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
    symptoms TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- PREVENT DOUBLE BOOKINGS: A doctor cannot be booked for two overlapping appointments
    CONSTRAINT no_overlapping_doctor_appointments EXCLUDE USING gist (
        doctor_id WITH =,
        appointment_window WITH &&
    )
);

-- ==========================================
-- 🌱 CORE META DATA SEED HYDRATION
-- ==========================================

-- 🌾 Seed Specialization Fields
INSERT INTO public.specializations (name) VALUES 
('cardiologist'), ('dermatologist'), ('pediatrician'), ('orthopedist'), ('general physician'), ('dentist');

-- 🌾 Seed Colloquial Speech Mapping Synonyms to assist processor.js
INSERT INTO public.specialization_synonyms (specialization_id, synonym_name) VALUES
((SELECT id FROM public.specializations WHERE name='cardiologist'), 'chest pain'),
((SELECT id FROM public.specializations WHERE name='cardiologist'), 'heart attack'),
((SELECT id FROM public.specializations WHERE name='cardiologist'), 'palpitations'),
((SELECT id FROM public.specializations WHERE name='dermatologist'), 'skin rash'),
((SELECT id FROM public.specializations WHERE name='dermatologist'), 'acne'),
((SELECT id FROM public.specializations WHERE name='dermatologist'), 'pimple'),
((SELECT id FROM public.specializations WHERE name='pediatrician'), 'baby'),
((SELECT id FROM public.specializations WHERE name='pediatrician'), 'child'),
((SELECT id FROM public.specializations WHERE name='pediatrician'), 'kid'),
((SELECT id FROM public.specializations WHERE name='orthopedist'), 'bone fracture'),
((SELECT id FROM public.specializations WHERE name='orthopedist'), 'joint pain'),
((SELECT id FROM public.specializations WHERE name='general physician'), 'fever'),
((SELECT id FROM public.specializations WHERE name='general physician'), 'headache'),
((SELECT id FROM public.specializations WHERE name='dentist'), 'toothache');

-- 🌾 Seed Sample Doctors Profiles 
-- (Note: Plain text hashes are placeholders. Real entries via registration endpoints use bcrypt)
INSERT INTO public.doctors (name, email, password_hash, specialization_id, city, hospital_address, fees, rating) VALUES
('Dr. Amit Sharma', 'amit.sharma@clinic.com', 'hashed_placeholder_123', (SELECT id FROM public.specializations WHERE name='cardiologist'), 'delhi', 'Max Healthcare, Saket, Delhi', 800, 4.8),
('Dr. Priya Patel', 'priya.patel@clinic.com', 'hashed_placeholder_123', (SELECT id FROM public.specializations WHERE name='dermatologist'), 'delhi', 'Fortis Hospital, Vasant Kunj, Delhi', 700, 4.6),
('Dr. Rohan Mehta', 'rohan.mehta@clinic.com', 'hashed_placeholder_123', (SELECT id FROM public.specializations WHERE name='cardiologist'), 'mumbai', 'Kokilaben Hospital, Andheri, Mumbai', 1000, 4.9);

-- 🌾 Seed Default Global Test Patient Profile
INSERT INTO public.patients (name, email, password_hash, phone_number) VALUES 
('Default Test Patient', 'test.patient@gmail.com', 'hashed_placeholder_123', '+919999999999');

-- 🌾 Seed Sample Doctor Availability Slots for Testing (Dr. Amit Sharma on June 16, 2026)
INSERT INTO public.doctor_availability (doctor_id, available_window) VALUES 
(1, tstzrange('2026-06-16 09:00:00+05:30', '2026-06-16 12:00:00+05:30')),
(1, tstzrange('2026-06-16 14:00:00+05:30', '2026-06-16 17:00:00+05:30'));
