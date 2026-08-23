-- ============================================================
-- MajiMonitor Database Schema
-- IoT-based Water Quality Monitoring & Alert Dashboard
-- Client: THIWASCO | Thika River Basin
-- ============================================================

CREATE DATABASE IF NOT EXISTS majimonitor;
USE majimonitor;

-- ------------------------------------------------------------
-- USERS
-- THIWASCO staff who log in: admins and field officers
-- ------------------------------------------------------------
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'field_officer') NOT NULL DEFAULT 'field_officer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- SITES
-- Monitoring locations along the Thika River basin
-- ------------------------------------------------------------
CREATE TABLE sites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    location_description VARCHAR(255),
    latitude DECIMAL(10, 6),
    longitude DECIMAL(10, 6),
    river_section VARCHAR(150),
    assigned_officer_id INT,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_officer_id) REFERENCES users(id)
        ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- PARAMETERS
-- Water quality metrics tracked, with threshold bands
-- Safe zone: safe_min - safe_max
-- Warning zone: warning_min - warning_max (outside safe, inside warning)
-- Critical: anything outside warning_min/warning_max
-- ------------------------------------------------------------
CREATE TABLE parameters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    safe_min DECIMAL(10, 3) NOT NULL,
    safe_max DECIMAL(10, 3) NOT NULL,
    warning_min DECIMAL(10, 3) NOT NULL,
    warning_max DECIMAL(10, 3) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- READINGS
-- Sensor data points (from simulator now, real hardware later)
-- ------------------------------------------------------------
CREATE TABLE readings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_id INT NOT NULL,
    parameter_id INT NOT NULL,
    value DECIMAL(10, 3) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
    FOREIGN KEY (parameter_id) REFERENCES parameters(id) ON DELETE CASCADE,
    INDEX idx_site_time (site_id, recorded_at),
    INDEX idx_parameter_time (parameter_id, recorded_at)
);

-- ------------------------------------------------------------
-- ALERTS
-- Triggered when a reading breaches a threshold.
-- triggered_value is a denormalized copy of the reading's value
-- so alert history remains readable even if readings are purged.
-- ------------------------------------------------------------
CREATE TABLE alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reading_id INT,
    site_id INT NOT NULL,
    parameter_id INT NOT NULL,
    triggered_value DECIMAL(10, 3) NOT NULL,
    severity ENUM('warning', 'critical') NOT NULL,
    status ENUM('active', 'acknowledged', 'resolved') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    resolved_by INT NULL,
    FOREIGN KEY (reading_id) REFERENCES readings(id) ON DELETE SET NULL,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
    FOREIGN KEY (parameter_id) REFERENCES parameters(id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status)
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default admin user (password: "admin123" — hash this properly in app, this is placeholder)
INSERT INTO users (name, email, password_hash, role) VALUES
('System Admin', 'admin@thiwasco.co.ke', '$2b$10$placeholderHashReplaceOnFirstRun', 'admin'),
('Field Officer - Jane Wanjiru', 'jwanjiru@thiwasco.co.ke', '$2b$10$placeholderHashReplaceOnFirstRun', 'field_officer');

-- Sample monitoring sites along Thika River basin
INSERT INTO sites (name, location_description, latitude, longitude, river_section, assigned_officer_id, status) VALUES
('Thika Falls Intake', 'Near Chania/Thika Falls water intake point', -1.0332, 37.0833, 'Upper Thika River', 2, 'active'),
('Makongeni Community Point', 'Community water collection point, Makongeni ward', -1.0396, 37.0900, 'Mid Thika River', 2, 'active'),
('Chania Bridge Station', 'Chania River confluence monitoring station', -1.0450, 37.0950, 'Chania Confluence', NULL, 'active'),
('Athi River Junction', 'Downstream junction monitoring point', -1.0500, 37.1050, 'Lower Thika Basin', NULL, 'active');

-- Water quality parameters with WHO/Kenya standards-based thresholds
INSERT INTO parameters (name, unit, safe_min, safe_max, warning_min, warning_max) VALUES
('pH', 'pH', 6.5, 8.5, 6.0, 9.0),
('Turbidity', 'NTU', 0, 5, 0, 10),
('TDS', 'ppm', 0, 500, 0, 1000),
('Temperature', '°C', 15, 25, 10, 30),
('Conductivity', 'µS/cm', 0, 800, 0, 1500),
('Dissolved Oxygen', 'mg/L', 5, 14, 3, 16);
