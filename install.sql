-- Elegancia Dental — Hostinger MySQL
-- In phpMyAdmin: select your database → Import this file.

CREATE TABLE IF NOT EXISTS appointments (
  id VARCHAR(32) NOT NULL,
  patient_name VARCHAR(160) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  phone_key VARCHAR(10) NOT NULL,
  email VARCHAR(190) NOT NULL,
  message TEXT,
  treatment_id VARCHAR(64) NOT NULL DEFAULT '',
  treatment_name VARCHAR(160) NOT NULL DEFAULT 'Consultation',
  appt_date DATE NOT NULL,
  appt_time VARCHAR(16) NOT NULL,
  doctor VARCHAR(160) NOT NULL DEFAULT '',
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_date (appt_date),
  KEY idx_phone_key (phone_key),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
