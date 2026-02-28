const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// Get all patients or search
app.get('/api/patients', (req, res) => {
    const search = req.query.search || '';
    const query = `SELECT * FROM patients WHERE name LIKE ? OR phone LIKE ? ORDER BY created_at DESC`;
    db.all(query, [`%${search}%`, `%${search}%`], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get a single patient
app.get('/api/patients/:id', (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM patients WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Patient not found' });
        res.json(row);
    });
});

// Add a new patient
app.post('/api/patients', (req, res) => {
    const { name, age, phone, history, dob, blood_type, allergies } = req.body;
    db.run(
        `INSERT INTO patients (name, age, phone, history, dob, blood_type, allergies) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, age, phone, history, dob, blood_type, allergies],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, name, age, phone, history, dob, blood_type, allergies });
        }
    );
});

// Get prescriptions for a patient (only active ones by default)
app.get('/api/patients/:id/prescriptions', (req, res) => {
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

// Add a new prescription
app.post('/api/prescriptions', (req, res) => {
    const { patient_id, diagnosis, medications } = req.body;
    db.run(
        `INSERT INTO prescriptions (patient_id, diagnosis, medications, status, parent_id) VALUES (?, ?, ?, 'active', NULL)`,
        [patient_id, diagnosis, medications],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, patient_id, diagnosis, medications, status: 'active' });
        }
    );
});

// Edit/Version a prescription (Archive old, insert new)
app.post('/api/prescriptions/:id/edit', (req, res) => {
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
                `INSERT INTO prescriptions (patient_id, diagnosis, medications, status, parent_id) VALUES (?, ?, ?, 'active', ?)`,
                [patientId, diagnosis, medications, oldId],
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
            // Patient exists, update basic info if provided (receptionist can edit these)
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

// List appointments
app.get('/api/appointments', (req, res) => {
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

// Update appointment status
app.put('/api/appointments/:id/status', (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    db.run(`UPDATE appointments SET status = ? WHERE id = ?`, [status, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id, status });
    });
});

// Records: Get paginated patients with advanced search
app.get('/api/records/patients', (req, res) => {
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
