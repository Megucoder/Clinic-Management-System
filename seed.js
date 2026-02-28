const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./clinic.db');

const patients = [
    {
        name: 'أحمد محمود',
        phone: '0555123456',
        history: 'ارتفاع طفيف في ضغط الدم',
        dob: '1985-05-15',
        blood_type: 'O+',
        allergies: 'لا يوجد'
    },
    {
        name: 'سارة خالد',
        phone: '0555987654',
        history: 'ربو تحسسي',
        dob: '1992-11-20',
        blood_type: 'A-',
        allergies: 'البنسلين'
    },
    {
        name: 'عمر سعيد',
        phone: '0555112233',
        history: 'سكري النوع الثاني',
        dob: '1970-02-05',
        blood_type: 'B+',
        allergies: 'أسبرين'
    }
];

const prescriptionsData = [
    {
        diagnosis: 'التهاب اللوزتين',
        medications: "- Amoxicillin 500mg (أموكسيسيلين) | 1x3 | لمدة 5 يوم (بعد الأكل)\\n- Paracetamol 500mg (باراسيتامول) | عند اللزوم | لمدة 3 يوم"
    },
    {
        diagnosis: 'نوبة ربو خفيفة',
        medications: "- طارد للبلغم | 1x3 | لمدة 5 يوم\\n- Loratadine 10mg (لوراتادين) | 1x1 | لمدة 7 يوم (قبل النوم)"
    },
    {
        diagnosis: 'متابعة سكري',
        medications: "- Metformin 500mg (ميتفورمين) | 1x2 | لمدة 30 يوم (بعد الأكل)\\n- Vitamin B12 | 1x1 | لمدة 30 يوم"
    }
];

db.serialize(() => {
    // We'll use age=0 since we calculate age from DOB now on the frontend
    const stmtPat = db.prepare("INSERT INTO patients (name, age, phone, history, dob, blood_type, allergies) VALUES (?, ?, ?, ?, ?, ?, ?)");
    const stmtPresc = db.prepare("INSERT INTO prescriptions (patient_id, diagnosis, medications) VALUES (?, ?, ?)");

    patients.forEach((p, index) => {
        stmtPat.run(p.name, 0, p.phone, p.history, p.dob, p.blood_type, p.allergies, function (err) {
            if (err) {
                console.error("Error inserting patient", err);
                return;
            }
            const patientId = this.lastID;
            console.log(`Inserted patient: ${p.name} with ID: ${patientId}`);

            // Add a prescription for this patient
            const rx = prescriptionsData[index];
            stmtPresc.run(patientId, rx.diagnosis, rx.medications, function (err) {
                if (err) {
                    console.error("Error inserting prescription", err);
                    return;
                }
                console.log(`Inserted prescription for patient ${patientId}`);
            });
        });
    });

    stmtPat.finalize();
    setTimeout(() => {
        stmtPresc.finalize();
        db.close(() => {
            console.log("Database connection closed.");
        });
    }, 1000);
});
