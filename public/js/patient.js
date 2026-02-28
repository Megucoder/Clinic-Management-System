const API_URL = 'http://localhost:3000/api';

// Utilities
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

// Get Patient ID from URL
const urlParams = new URLSearchParams(window.location.search);
const patientId = urlParams.get('id');

if (!patientId) {
    window.location.href = '/';
}

// Fetch Patient Data
async function fetchPatientDetails() {
    try {
        const response = await axios.get(`${API_URL}/patients/${patientId}`);
        const p = response.data;

        let age = p.age;
        if (p.dob) {
            const birthDate = new Date(p.dob);
            const today = new Date();
            let calculatedAge = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                calculatedAge--;
            }
            age = calculatedAge;
        }

        document.getElementById('pName').textContent = p.name;
        document.getElementById('pAge').textContent = age || '-';
        document.getElementById('pPhone').textContent = p.phone || 'غير متوفر';
        document.getElementById('pBloodType').textContent = p.blood_type || 'غير مسجل';
        document.getElementById('pAllergies').textContent = p.allergies || 'لا يوجد';
        document.getElementById('pHistory').textContent = p.history || 'لا يوجد تاريخ مرضي مسجل.';
        document.getElementById('avatarText').textContent = p.name.charAt(0);

        document.title = `${p.name} | ملف المريض`;
    } catch (error) {
        console.error('Error fetching patient:', error);
        alert('المريض غير موجد، جاري الرجوع.');
        window.location.href = '/';
    }
}

// Fetch Prescriptions
async function fetchPrescriptions() {
    try {
        const prResponse = await axios.get(`${API_URL}/patients/${patientId}/prescriptions?all=true`);
        const prescriptions = prResponse.data;
        renderPrescriptions(prescriptions);
    } catch (error) {
        console.error('Error fetching prescriptions:', error);
    }
}

function renderPrescriptions(prescriptions) {
    const list = document.getElementById('prescriptionsList');
    if (prescriptions.length === 0) {
        list.innerHTML = `<p class="text-center" style="color: var(--text-muted);">لا توجد وصفات طبية سابقة.</p>`;
        return;
    }

    // Attach patient data globally for printing
    window.currentPatientData = {
        name: document.getElementById('pName').textContent,
        age: document.getElementById('pAge').textContent
    };

    // Store prescriptions globally to avoid inline JSON syntax errors with newlines
    window.patientPrescriptions = prescriptions;

    list.innerHTML = window.patientPrescriptions.map((pr, index) => {
        const isArchived = pr.status === 'archived';
        const archiveBadge = isArchived ? `<span style="background: var(--text-muted); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-right: 10px;">أرشيف</span>` : '';
        const editBtn = isArchived ? '' : `<button class="btn btn-secondary" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;" onclick="editPrescription(${index})"><i class="fa-solid fa-pen"></i> تعديل</button>`;

        return `
            <div class="card ${isArchived ? 'opacity-75' : ''}" style="margin-bottom: 1.5rem; border-right: 4px solid ${isArchived ? '#9ca3af' : 'var(--primary-color)'};">
                <div class="d-flex justify-between align-center mb-4">
                    <h4 style="margin:0;">${archiveBadge}${pr.diagnosis || 'غير محدد'}</h4>
                    <div class="d-flex gap-2">
                        ${editBtn}
                        <button class="btn btn-secondary" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;" onclick="clonePrescription(${index})">
                            <i class="fa-solid fa-copy"></i> نسخ
                        </button>
                        <button class="btn btn-secondary" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;" onclick="openPrintModal(${index})">
                            <i class="fa-solid fa-print"></i> PDF
                        </button>
                    </div>
                </div>
                <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.5rem;">الأدوية الموصوفة:</p>
                <div class="medication-list">${pr.medications.replace(/\\n/g, '<br>')}</div>
            </div>
        `;
    }).join('');
}

// PDF Print Logic
let currentPrintPrescription = null;
let currentPdfFilename = "";

function openPrintModal(index) {
    try {
        const prescription = window.patientPrescriptions[index];
        currentPrintPrescription = prescription;

        // Fill the printable modal with data
        document.getElementById('printDate').textContent = new Date(prescription.date).toLocaleDateString('fr-FR');
        document.getElementById('printId').textContent = "RX-" + prescription.id.toString().padStart(4, '0');
        document.getElementById('printName').textContent = window.currentPatientData.name;
        document.getElementById('printAge').textContent = window.currentPatientData.age;
        // Diagnosis is omitted from the printable Ordonnance for patient confidentiality

        // Build the ordered list for medications (Algerian standard requires Rp/ structured list)
        const medicationsList = document.getElementById('printMedications');
        medicationsList.innerHTML = '';

        const lines = prescription.medications.split(/\\n|\n/);
        lines.forEach(line => {
            if (!line.trim()) return;
            // The format saved is typically: - Name | Dose | Duration (Instructions)
            let clean = line.replace(/^- /, '').trim();
            if (clean) {
                let li = document.createElement('li');
                li.style.marginBottom = '10px';
                // Optional: Format the parts nicely if needed, or just display the whole line
                li.textContent = clean;
                medicationsList.appendChild(li);
            }
        });

        // Generate QR Code
        const qrContainer = document.getElementById('printQRCode');
        qrContainer.innerHTML = '';
        setTimeout(() => {
            new QRCode(qrContainer, {
                text: `RX-${prescription.id} | ${window.currentPatientData.name} | ${new Date(prescription.date).toLocaleDateString('fr-FR')}`,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.L
            });
        }, 50);

        // Simple confirmation modal logic is now native in HTML
        openModal('printPrescriptionModal');
    } catch (e) {
        console.error("Print Error:", e);
        alert("انتهت العملية بخطأ فني (تأكد من تحديث الصفحة Ctrl+F5): " + e.message);
    }
}

function downloadPDF() {
    if (!currentPrintPrescription) return;

    // Trigger Native Browser Print
    // The @media print CSS rules will automatically hide everything else and style the Ordonnance.
    window.print();
}

// Remove obsolete html2pdf functions
// getPdfOptions and generatePDFPreview are no longer needed for native printing

let editingPrescriptionId = null;

// Add Prescription Modal Logic
function openAddPrescriptionModal() {
    editingPrescriptionId = null;
    document.getElementById('diagTitle').value = ''; // Changed from prescriptionDiagnosis to diagTitle
    document.getElementById('medicationsList').innerHTML = ''; // Clear list
    addMedicationRow(); // Add one empty row
    openModal('addPrescriptionModal');
}

function addMedicationRow(name = '', dose = '', duration = '', instructions = '') {
    const list = document.getElementById('medicationsList');
    const row = document.createElement('div');
    row.className = 'd-flex gap-2 align-center medication-row';
    row.innerHTML = `
        <input type="text" class="form-control med-name" placeholder="اسم الدواء (اختر أو اكتب)" list="drugsList" required style="flex:2;" value="${name}">
        <input type="text" class="form-control med-dose" placeholder="الجرعة (مثال 1x3)" style="flex:1;" value="${dose}">
        <input type="text" class="form-control med-duration" placeholder="المدة (أيام)" style="flex:1;" value="${duration}">
        <input type="text" class="form-control med-instructions" placeholder="ملاحظات" style="flex:1.5;" value="${instructions}">
        <button type="button" class="btn btn-secondary" onclick="this.parentElement.remove()" style="padding: 0.5rem; background: #fee2e2; color: #dc2626; border: none;">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;
    list.appendChild(row);
}

function clonePrescription(index) {
    editingPrescriptionId = null;
    const pr = window.patientPrescriptions[index];
    document.getElementById('diagTitle').value = pr.diagnosis || ''; // Changed from prescriptionDiagnosis to diagTitle

    const list = document.getElementById('medicationsList');
    list.innerHTML = '';

    const lines = pr.medications.split('\\n');
    lines.forEach(line => {
        if (!line.trim()) return;
        let clean = line.replace(/^- /, '');
        let parts = clean.split(' | ');
        let name = parts[0] || '';
        let dose = parts[1] || '';
        let dur = parts[2] ? parts[2].replace('لمدة ', '').replace(' يوم', '') : '';
        let inst = '';
        if (dur.includes('(')) {
            let s = dur.split('(');
            dur = s[0].trim();
            inst = s[1].replace(')', '').trim();
        }
        addMedicationRow(name.trim(), dose.trim(), dur, inst);
    });

    if (list.children.length === 0) {
        addMedicationRow();
    }
    openModal('addPrescriptionModal');
}

function editPrescription(index) {
    const pr = window.patientPrescriptions[index];
    editingPrescriptionId = pr.id;
    document.getElementById('diagTitle').value = pr.diagnosis || '';

    const list = document.getElementById('medicationsList');
    list.innerHTML = '';

    const lines = pr.medications.split('\\n');
    lines.forEach(line => {
        if (!line.trim()) return;
        let clean = line.replace(/^- /, '');
        let parts = clean.split(' | ');
        let name = parts[0] || '';
        let dose = parts[1] || '';
        let dur = parts[2] ? parts[2].replace('لمدة ', '').replace(' يوم', '') : '';
        let inst = '';
        if (dur.includes('(')) {
            let s = dur.split('(');
            dur = s[0].trim();
            inst = s[1].replace(')', '').trim();
        }
        addMedicationRow(name.trim(), dose.trim(), dur, inst);
    });

    if (list.children.length === 0) {
        addMedicationRow();
    }
    openModal('addPrescriptionModal');
}

// Add Prescription
document.getElementById('addPrescriptionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const rows = document.querySelectorAll('.medication-row');
    let medicationsArray = [];
    rows.forEach(r => {
        const name = r.querySelector('.med-name').value;
        const dose = r.querySelector('.med-dose').value;
        const duration = r.querySelector('.med-duration').value;
        const instructions = r.querySelector('.med-instructions').value;
        let line = `- ${name}`;
        if (dose) line += ` | ${dose}`;
        if (duration) line += ` | لمدة ${duration} يوم`;
        if (instructions) line += ` (${instructions})`;
        medicationsArray.push(line);
    });

    const data = {
        patient_id: patientId,
        diagnosis: document.getElementById('diagTitle').value,
        medications: medicationsArray.join('\\n')
    };

    try {
        const submitBtn = e.target.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';

        if (editingPrescriptionId) {
            await axios.post(`${API_URL}/prescriptions/${editingPrescriptionId}/edit`, {
                diagnosis: data.diagnosis,
                medications: data.medications
            });
        } else {
            await axios.post(`${API_URL}/prescriptions`, data);
        }

        closeModal('addPrescriptionModal');
        e.target.reset();
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'حفظ الوصفة';
        fetchPrescriptions();
    } catch (error) {
        alert('حدث خطأ أثناء حفظ الوصفة');
        console.error(error);
        const submitBtn = e.target.querySelector('button');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'حفظ الوصفة';
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchPatientDetails();
    fetchPrescriptions();
});
