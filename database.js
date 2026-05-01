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
                db.run(`ALTER TABLE patients ADD COLUMN chronic_diseases TEXT`, () => { });
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
                db.run(`ALTER TABLE prescriptions ADD COLUMN motif TEXT`, () => { });
                db.run(`ALTER TABLE prescriptions ADD COLUMN examination TEXT`, () => { });
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
            if (err) {
                console.error("Error creating appointments table", err.message);
            } else {
                db.run(`ALTER TABLE appointments ADD COLUMN price INTEGER DEFAULT 0`, () => { });
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT
        )`, (err) => {
            if (err) {
                console.error("Error creating users table", err.message);
            } else {
                db.run(`ALTER TABLE users ADD COLUMN daily_rate INTEGER DEFAULT 0`, () => { });
                // Insert default doctor if not exists
                db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`,
                    ['doctor', 'admin123', 'doctor']);
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            date DATE,
            status TEXT DEFAULT 'Confirmed',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, date) 
        )`, (err) => {
            if (err) console.error("Error creating attendance table", err.message);
        });

        db.run(`CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount INTEGER,
            month TEXT,
            year TEXT,
            payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`, (err) => {
            if (err) console.error("Error creating payments table", err.message);
        });

        db.run(`CREATE TABLE IF NOT EXISTS medical_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            title TEXT,
            file_path TEXT,
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
        )`, (err) => {
            if (err) console.error("Error creating medical_documents table", err.message);
        });

        db.run(`CREATE TABLE IF NOT EXISTS vitals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            date TEXT,
            blood_pressure TEXT,
            blood_sugar TEXT,
            weight REAL,
            temperature REAL,
            heart_rate INTEGER,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
        )`, (err) => {
            if (err) console.error("Error creating vitals table", err.message);
        });

        db.run(`CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            category TEXT,
            amount INTEGER,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error("Error creating expenses table", err.message);
        });

        db.run(`CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_name TEXT,
            quantity INTEGER DEFAULT 0,
            unit TEXT,
            min_threshold INTEGER DEFAULT 0,
            last_restocked TEXT
        )`, (err) => {
            if (err) console.error("Error creating inventory table", err.message);
        });

        db.run(`CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE,
            value TEXT
        )`, (err) => {
            if (err) console.error("Error creating settings table", err.message);
        });
    }
});

module.exports = db;
