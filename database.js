const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./clinic.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to SQLite database.');

        db.run(`CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            age INTEGER,
            phone TEXT,
            history TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error("Error creating patients table", err.message);
            } else {
                // Add new columns for E-Prescription module (ignore errors if they already exist)
                db.run(`ALTER TABLE patients ADD COLUMN dob TEXT`, () => { });
                db.run(`ALTER TABLE patients ADD COLUMN blood_type TEXT`, () => { });
                db.run(`ALTER TABLE patients ADD COLUMN allergies TEXT`, () => { });
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS prescriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            diagnosis TEXT,
            medications TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
        )`, (err) => {
            if (err) {
                console.error("Error creating prescriptions table", err.message);
            } else {
                // Add columns for versioning
                db.run(`ALTER TABLE prescriptions ADD COLUMN parent_id INTEGER DEFAULT NULL`, () => { });
                db.run(`ALTER TABLE prescriptions ADD COLUMN status TEXT DEFAULT 'active'`, () => { });
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            type TEXT,
            notes TEXT,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error("Error creating appointments table", err.message);
        });
    }
});

module.exports = db;
