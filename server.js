const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('./database');
const multer = require('multer');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-1234'; // Replace with a strong env variable in production

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to verify token and role
const authenticateRole = (allowedRoles) => {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (!allowedRoles.includes(decoded.role)) {
                return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
            }
            req.user = decoded; // Attach user info to request
            next();
        } catch (err) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
    };
};

// API Routes

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(401).json({ error: 'Invalid username or password' });

        // Generate JWT token
        const token = jwt.sign(
            { id: row.id, username: row.username, role: row.role },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: row.id,
                username: row.username,
                role: row.role
            }
        });
    });
});

// Get all patients or search (Doctor only for full list)
app.get('/api/patients', authenticateRole(['doctor']), (req, res) => {
    const search = req.query.search || '';
    const query = `SELECT * FROM patients WHERE name LIKE ? OR phone LIKE ? ORDER BY created_at DESC`;
    db.all(query, [`%${search}%`, `%${search}%`], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get a single patient (Doctor only)
app.get('/api/patients/:id', authenticateRole(['doctor']), (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM patients WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Patient not found' });
        res.json(row);
    });
});

// Add a new patient (Doctor or Receptionist)
app.post('/api/patients', authenticateRole(['doctor', 'receptionist']), (req, res) => {
    const { name, age, phone, history, dob, blood_type, allergies, chronic_diseases } = req.body;
    db.run(
        `INSERT INTO patients (name, age, phone, history, dob, blood_type, allergies, chronic_diseases) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, age, phone, history, dob, blood_type, allergies, chronic_diseases],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, name, age, phone, history, dob, blood_type, allergies, chronic_diseases });
        }
    );
});

// Get documents for a patient (Doctor only)
app.get('/api/patients/:id/documents', authenticateRole(['doctor']), (req, res) => {
    const patientId = req.params.id;
    db.all(`SELECT * FROM medical_documents WHERE patient_id = ? ORDER BY upload_date DESC`, [patientId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Upload a document for a patient (Doctor only)
app.post('/api/patients/:id/documents', authenticateRole(['doctor']), upload.single('document'), (req, res) => {
    const patientId = req.params.id;
    const title = req.body.title || 'Untitled Document';
    
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = '/uploads/' + req.file.filename;

    db.run(
        `INSERT INTO medical_documents (patient_id, title, file_path) VALUES (?, ?, ?)`,
        [patientId, title, filePath],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, patient_id: patientId, title, file_path: filePath });
        }
    );
});

// Delete a document (Doctor only)
app.delete('/api/documents/:id', authenticateRole(['doctor']), (req, res) => {
    const docId = req.params.id;
    db.get(`SELECT file_path FROM medical_documents WHERE id = ?`, [docId], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Document not found' });
        
        const fullPath = path.join(__dirname, 'public', row.file_path);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }

        db.run(`DELETE FROM medical_documents WHERE id = ?`, [docId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Document deleted' });
        });
    });
});

// Get vitals for a patient (Doctor only)
app.get('/api/patients/:id/vitals', authenticateRole(['doctor']), (req, res) => {
    const patientId = req.params.id;
    db.all(`SELECT * FROM vitals WHERE patient_id = ? ORDER BY date DESC, created_at DESC`, [patientId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Add vitals for a patient (Doctor only)
app.post('/api/patients/:id/vitals', authenticateRole(['doctor']), (req, res) => {
    const patientId = req.params.id;
    const { date, blood_pressure, blood_sugar, weight, temperature, heart_rate, notes } = req.body;
    
    db.run(
        `INSERT INTO vitals (patient_id, date, blood_pressure, blood_sugar, weight, temperature, heart_rate, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [patientId, date, blood_pressure, blood_sugar, weight, temperature, heart_rate, notes],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, patient_id: patientId, date, blood_pressure, blood_sugar, weight, temperature, heart_rate, notes });
        }
    );
});

// Delete vitals (Doctor only)
app.delete('/api/vitals/:id', authenticateRole(['doctor']), (req, res) => {
    const id = req.params.id;
    db.run(`DELETE FROM vitals WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Vitals deleted' });
    });
});

// Get prescriptions for a patient (Doctor only)
app.get('/api/patients/:id/prescriptions', authenticateRole(['doctor']), (req, res) => {
    const patientId = req.params.id;
    const includeArchived = req.query.all === 'true';

    let query = `SELECT * FROM prescriptions WHERE patient_id = ? AND status = 'active' ORDER BY date DESC`;
    if (includeArchived) {
        query = `SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY date DESC`;
    }

    db.all(query, [patientId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Add a new prescription/visit (Doctor only)
app.post('/api/prescriptions', authenticateRole(['doctor']), (req, res) => {
    const { patient_id, diagnosis, medications, motif, examination } = req.body;
    db.run(
        `INSERT INTO prescriptions (patient_id, diagnosis, medications, status, parent_id, motif, examination) VALUES (?, ?, ?, 'active', NULL, ?, ?)`,
        [patient_id, diagnosis, medications, motif, examination],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, patient_id, diagnosis, medications, status: 'active', motif, examination });
        }
    );
});

// Edit/Version a prescription (Doctor only)
app.post('/api/prescriptions/:id/edit', authenticateRole(['doctor']), (req, res) => {
    const oldId = req.params.id;
    const { diagnosis, medications } = req.body;

    // First fetch the old one to get patient_id
    db.get(`SELECT patient_id FROM prescriptions WHERE id = ?`, [oldId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Prescription not found' });

        const patientId = row.patient_id;

        db.serialize(() => {
            db.run(`UPDATE prescriptions SET status = 'archived' WHERE id = ?`, [oldId]);
            db.run(
                `INSERT INTO prescriptions (patient_id, diagnosis, medications, status, parent_id, motif, examination) VALUES (?, ?, ?, 'active', ?, ?, ?)`,
                [patientId, diagnosis, medications, oldId, req.body.motif || null, req.body.examination || null],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, newId: this.lastID });
                }
            );
        });
    });
});

// Create a new appointment
app.post('/api/appointments', (req, res) => {
    const { patient_name, phone, type, notes, date, time, dob, blood_type, allergies } = req.body;

    // First, check if the patient exists in the patients table
    db.get(`SELECT id FROM patients WHERE phone = ?`, [phone], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (!row) {
            // Patient doesn't exist, create them
            db.run(`INSERT INTO patients (name, phone, history, dob, blood_type, allergies) VALUES (?, ?, ?, ?, ?, ?)`,
                [patient_name, phone, notes, dob || null, blood_type || null, allergies || null], function (err) {
                    if (err) console.error("Could not auto-create patient", err.message);
                });
        } else {
            // Patient exists, update basic info if provided (Both can edit these)
            let updates = ['name = ?'];
            let params = [patient_name];

            if (dob) { updates.push('dob = ?'); params.push(dob); }
            if (blood_type) { updates.push('blood_type = ?'); params.push(blood_type); }
            if (allergies) { updates.push('allergies = ?'); params.push(allergies); }

            params.push(row.id);
            db.run(`UPDATE patients SET ${updates.join(', ')} WHERE id = ?`, params, function (err) {
                if (err) console.error("Could not update patient info", err.message);
            });
        }
    });

    // Then, create the appointment
    db.run(
        `INSERT INTO appointments (patient_name, phone, type, notes, date, time) VALUES (?, ?, ?, ?, ?, ?)`,
        [patient_name, phone, type, notes, date, time],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, patient_name, phone, type, notes, date, time, status: 'pending' });
        }
    );
});

// Get patient summary by phone (for auto-fill)
app.get('/api/patient/info', (req, res) => {
    const phone = req.query.phone;
    if (!phone) return res.status(400).json({ error: 'Phone is required' });

    db.get(`SELECT name, history as notes, dob, blood_type, allergies FROM patients WHERE phone = ?`, [phone], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            // Found in patients table
            res.json({ name: row.name, notes: row.notes || '', dob: row.dob || '', blood_type: row.blood_type || '', allergies: row.allergies || '' });
        } else {
            // Fallback: check if they only exist in appointments table
            db.get(`SELECT patient_name as name, notes FROM appointments WHERE phone = ? ORDER BY created_at DESC LIMIT 1`, [phone], (err, apptRow) => {
                if (err) return res.status(500).json({ error: err.message });
                if (apptRow) {
                    res.json({ name: apptRow.name, notes: apptRow.notes || '' });
                } else {
                    res.json(null); // No previous record found
                }
            });
        }
    });
});

// Get all appointments for a specific phone number (Patient Portal)
app.get('/api/patient/appointments', (req, res) => {
    const phone = req.query.phone;
    if (!phone) return res.status(400).json({ error: 'Phone is required' });

    db.all(`SELECT * FROM appointments WHERE phone = ? ORDER BY date DESC, time DESC`, [phone], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// List appointments (Receptionist & Doctor)
app.get('/api/appointments', authenticateRole(['doctor', 'receptionist']), (req, res) => {
    const date = req.query.date;
    let query = `SELECT * FROM appointments ORDER BY date ASC, time ASC`;
    let params = [];
    if (date) {
        query = `SELECT * FROM appointments WHERE date = ? ORDER BY time ASC`;
        params.push(date);
    }
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get available slots for a given date
app.get('/api/available-slots', (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    db.all(`SELECT time FROM appointments WHERE date = ? AND status != 'cancelled'`, [date], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Let's assume clinic hours are 09:00 to 17:00 with 20-min slots
        const allSlots = [];
        let startHour = 9;
        let startMin = 0;
        const endHour = 17;

        while (startHour < endHour) {
            const timeString = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;
            allSlots.push(timeString);
            startMin += 20;
            if (startMin >= 60) {
                startMin -= 60;
                startHour += 1;
            }
        }

        const bookedSlots = rows.map(r => r.time);
        const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));
        res.json(availableSlots);
    });
});

// Update appointment status (Receptionist & Doctor)
app.put('/api/appointments/:id/status', authenticateRole(['doctor', 'receptionist']), (req, res) => {
    const id = req.params.id;
    const { status, price } = req.body;

    // Additional Logic: Receptionist can only confirm or mark as paid
    if (req.user && req.user.role === 'receptionist' && !['confirmed', 'in_progress', 'cancelled', 'paid'].includes(status)) {
        return res.status(403).json({ error: 'Receptionists can only confirm, call next (in_progress), cancel, or mark appointments as paid.' });
    }

    if (!['pending', 'confirmed', 'in_progress', 'cancelled', 'completed', 'paid'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    let query = `UPDATE appointments SET status = ? WHERE id = ?`;
    let params = [status, id];

    if (price !== undefined) {
        query = `UPDATE appointments SET status = ?, price = ? WHERE id = ?`;
        params = [status, price, id];
    }

    db.run(query, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id, status, price });
    });
});

// Records: Get paginated patients with advanced search (Doctor only)
app.get('/api/records/patients', authenticateRole(['doctor']), (req, res) => {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const searchTerm = `%${search}%`;
    let query = `SELECT * FROM patients `;
    let countQuery = `SELECT COUNT(*) as total FROM patients `;
    let params = [];

    if (search) {
        const whereClause = `WHERE name LIKE ? OR phone LIKE ? OR id = ? `;
        query += whereClause;
        countQuery += whereClause;
        // Search by ID strictly if it's a number, otherwise just pass 0 to fail the ID check harmlessly
        const idSearch = isNaN(parseInt(search)) ? 0 : parseInt(search);
        params = [searchTerm, searchTerm, idSearch];
    }

    query += `ORDER BY id DESC LIMIT ? OFFSET ?`;

    db.get(countQuery, params, (err, countRow) => {
        if (err) return res.status(500).json({ error: err.message });

        const total = countRow ? countRow.total : 0;
        const totalPages = Math.ceil(total / limit);

        db.all(query, [...params, limit, offset], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                data: rows,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages
                }
            });
        });
    });
});

// --- Finances API (Doctor Only) ---
app.get('/api/finances', authenticateRole(['doctor']), (req, res) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-%`;

    db.serialize(() => {
        let stats = {
            today: 0,
            month: 0,
            total: 0,
            recent: [],
            totalExpenses: 0,
            netProfit: 0
        };

        db.get(`SELECT SUM(price) as m FROM appointments WHERE status = 'paid' AND date = ?`, [todayStr], (err, row) => {
            if (row && row.m) stats.today = row.m;

            db.get(`SELECT SUM(price) as m FROM appointments WHERE status = 'paid' AND date LIKE ?`, [monthStr], (err, row2) => {
                if (row2 && row2.m) stats.month = row2.m;

                db.get(`SELECT SUM(price) as m FROM appointments WHERE status = 'paid'`, [], (err, row3) => {
                    if (row3 && row3.m) stats.total = row3.m;

                    db.all(`SELECT id, patient_name, date, time, price FROM appointments WHERE status = 'paid' ORDER BY date DESC, time DESC LIMIT 20`, [], (err, rows) => {
                        if (rows) stats.recent = rows;

                        db.get(`SELECT SUM(amount) as exp FROM expenses`, [], (err, expRow) => {
                            if (expRow && expRow.exp) stats.totalExpenses = expRow.exp;
                            
                            db.get(`SELECT SUM(amount) as pay FROM payments`, [], (err, payRow) => {
                                if (payRow && payRow.pay) stats.totalExpenses += payRow.pay;
                                
                                stats.netProfit = stats.total - stats.totalExpenses;
                                res.json(stats);
                            });
                        });
                    });
                });
            });
        });
    });
});

// --- Expenses API (Doctor Only) ---
app.get('/api/expenses', authenticateRole(['doctor']), (req, res) => {
    const query = `
        SELECT id, date, category, amount, description, created_at, 'expense' as type 
        FROM expenses
        UNION ALL
        SELECT p.id, 
               date(p.payment_date) as date, 
               'رواتب (' || u.role || ')' as category, 
               p.amount, 
               'دفع راتب لـ ' || u.username || ' لشهر ' || p.month || '/' || p.year as description, 
               p.payment_date as created_at, 
               'payroll' as type
        FROM payments p
        JOIN users u ON p.user_id = u.id
        ORDER BY date DESC, created_at DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/expenses', authenticateRole(['doctor']), (req, res) => {
    const { date, category, amount, description } = req.body;
    db.run(`INSERT INTO expenses (date, category, amount, description) VALUES (?, ?, ?, ?)`, 
        [date, category, amount, description], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, date, category, amount, description });
    });
});

app.delete('/api/expenses/:id', authenticateRole(['doctor']), (req, res) => {
    db.run(`DELETE FROM expenses WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- Inventory API (Doctor Only) ---
app.get('/api/inventory', authenticateRole(['doctor']), (req, res) => {
    db.all(`SELECT * FROM inventory ORDER BY item_name ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/inventory', authenticateRole(['doctor']), (req, res) => {
    const { item_name, quantity, unit, min_threshold, last_restocked } = req.body;
    db.run(`INSERT INTO inventory (item_name, quantity, unit, min_threshold, last_restocked) VALUES (?, ?, ?, ?, ?)`, 
        [item_name, quantity, unit, min_threshold, last_restocked], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, item_name, quantity, unit, min_threshold, last_restocked });
    });
});

app.put('/api/inventory/:id', authenticateRole(['doctor']), (req, res) => {
    const { quantity, last_restocked } = req.body;
    db.run(`UPDATE inventory SET quantity = ?, last_restocked = ? WHERE id = ?`, 
        [quantity, last_restocked, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/inventory/:id', authenticateRole(['doctor']), (req, res) => {
    db.run(`DELETE FROM inventory WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- Payroll & Attendance API ---

// Get all workers (Doctor Only)
app.get('/api/workers', authenticateRole(['doctor']), (req, res) => {
    db.all(`SELECT id, username, role, daily_rate FROM users WHERE role != 'doctor'`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Add/Update Worker (Doctor Only)
app.post('/api/workers', authenticateRole(['doctor']), (req, res) => {
    const { username, password, role, daily_rate } = req.body;
    db.get(`SELECT id FROM users WHERE username = ?`, [username], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            // Update
            let query = `UPDATE users SET role = ?, daily_rate = ?`;
            let params = [role, daily_rate || 0];
            if (password) {
                query += `, password = ?`;
                params.push(password);
            }
            query += ` WHERE username = ?`;
            params.push(username);
            db.run(query, params, function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: 'Worker updated' });
            });
        } else {
            // Insert
            db.run(`INSERT INTO users (username, password, role, daily_rate) VALUES (?, ?, ?, ?)`, 
                [username, password, role, daily_rate || 0], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, id: this.lastID });
            });
        }
    });
});

// Delete Worker (Doctor Only)
app.delete('/api/workers/:id', authenticateRole(['doctor']), (req, res) => {
    const userId = req.params.id;
    // Delete attendance and payroll for this user as well to avoid foreign key or orphan constraints issues
    db.run(`DELETE FROM attendance WHERE user_id = ?`, [userId], () => {
        db.run(`DELETE FROM payments WHERE user_id = ?`, [userId], () => {
            // Don't delete the doctor!
            db.run(`DELETE FROM users WHERE id = ? AND role != 'doctor'`, [userId], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: 'Worker deleted successfully' });
            });
        });
    });
});


// Worker Check-In
app.post('/api/attendance/checkin', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;
        if (decoded.role === 'doctor') return res.status(403).json({ error: 'Doctors do not check in' });

        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        db.run(`INSERT INTO attendance (user_id, date, status) VALUES (?, ?, 'Pending')`, [userId, dateStr], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Already requested attendance for today' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, message: 'Attendance request sent to doctor' });
        });
    } catch(err) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Get own attendance
app.get('/api/attendance/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;
        
        db.all(`SELECT date, status FROM attendance WHERE user_id = ? ORDER BY date DESC`, [userId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    } catch(err) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Get worker's attendance (Doctor Only)
app.get('/api/attendance/worker/:id', authenticateRole(['doctor']), (req, res) => {
    const userId = req.params.id;
    db.all(`SELECT date, status FROM attendance WHERE user_id = ? ORDER BY date DESC`, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get Payroll (Doctor Only)
app.get('/api/payroll', authenticateRole(['doctor']), (req, res) => {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'Month and year required' });
    
    const likeDate = `${year}-${String(month).padStart(2, '0')}-%`;
    
    const query = `
        SELECT 
            u.id as user_id, 
            u.username, 
            u.role, 
            u.daily_rate,
            COUNT(a.id) as days_attended,
            (COUNT(a.id) * u.daily_rate) as calculated_salary,
            EXISTS(SELECT 1 FROM payments p WHERE p.user_id = u.id AND p.month = ? AND p.year = ?) as is_paid
        FROM users u
        LEFT JOIN attendance a ON u.id = a.user_id AND a.date LIKE ? AND a.status = 'Confirmed'
        WHERE u.role != 'doctor'
        GROUP BY u.id
    `;
    
    db.all(query, [month, year, likeDate], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Confirm/Approve Attendance (Doctor Only)
app.post('/api/attendance/approve', authenticateRole(['doctor']), (req, res) => {
    const { user_id, date, status } = req.body; // status: 'Confirmed' or 'Rejected'
    db.run(`UPDATE attendance SET status = ? WHERE user_id = ? AND date = ?`, 
        [status, user_id, date], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: `Attendance ${status}` });
    });
});

// Delete Attendance Record (Doctor Only)
app.delete('/api/attendance/:userId/:date', authenticateRole(['doctor']), (req, res) => {
    const { userId, date } = req.params;
    db.run(`DELETE FROM attendance WHERE user_id = ? AND date = ?`, [userId, date], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Confirm Payment (Doctor Only)
app.post('/api/payroll/pay', authenticateRole(['doctor']), (req, res) => {
    const { user_id, amount, month, year } = req.body;
    db.run(`INSERT INTO payments (user_id, amount, month, year) VALUES (?, ?, ?, ?)`, 
        [user_id, amount, month, year], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Payment confirmed' });
    });
});

// --- Settings & Database ---
app.get('/api/backup-db', authenticateRole(['doctor']), (req, res) => {
    const dbPath = path.join(__dirname, 'clinic.db');
    if(fs.existsSync(dbPath)) {
        res.download(dbPath, `clinic_backup_${new Date().toISOString().split('T')[0]}.db`);
    } else {
        res.status(404).json({ error: 'Database not found' });
    }
});

// Catch-all route for unhandled requests (404 Page Not Found)
app.get('*', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
