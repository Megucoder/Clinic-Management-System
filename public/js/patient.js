const API_URL = '/api'; // Use relative path for production readiness

// Global Axios Interceptor for Doctor Authentication
axios.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
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

if (!patientId && !urlParams.get('phone')) {
    window.location.href = '/doctor/appointments.html';
}

// Fetch Patient Data
async function fetchPatientDetails() {
    try {
        let pid = patientId;
        if (!pid) {
            const phone = urlParams.get('phone');
            if (phone) {
                // Fetch patient by phone to get their ID
                const searchResp = await axios.get(`${API_URL}/records/patients?search=${phone}`);
                if (searchResp.data.data && searchResp.data.data.length > 0) {
                    pid = searchResp.data.data[0].id;
                    // Properly reload the page with the ID to ensure all functions (like fetchPrescriptions) work using the ID
                    window.location.href = `/doctor/patient.html?id=${pid}`;
                    return;
                }
            }
            throw new Error('Patient not completely registered with an ID');
        }

        const response = await axios.get(`${API_URL}/patients/${pid}`);
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
        document.getElementById('pChronic').textContent = p.chronic_diseases || 'لا يوجد';
        document.getElementById('pHistory').textContent = p.history || 'لا توجد ملاحظات عامة مسجلة.';
        document.getElementById('avatarText').textContent = p.name.charAt(0);

        document.title = `${p.name} | ملف المريض`;
        document.title = `${p.name} | ملف المريض`;
        return true; // Indicate success
    } catch (error) {
        console.error('Error fetching patient:', error);
        alert('المريض غير متوفر، جاري العودة لقائمة المواعيد.');
        window.location.href = '/doctor/appointments.html';
        return false;
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
        const editBtn = isArchived ? '' : `<button class="btn btn-secondary" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;" onclick="editPrescription(${index})"><i class="fa-solid fa-pen"></i> تعديل الزيارة</button>`;
        
        // Safety check for medications string
        let medsStr = '';
        if (pr.medications !== null && pr.medications !== undefined) {
             medsStr = String(pr.medications);
        }
        const medsHtml = medsStr.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');

        return `
            <div class="card ${isArchived ? 'opacity-75' : ''}" style="margin-bottom: 1.5rem; border-right: 4px solid ${isArchived ? '#9ca3af' : 'var(--primary-color)'}; border-left: 1px solid #eee; border-top: 1px solid #eee; border-bottom: 1px solid #eee; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                <div class="d-flex justify-between align-center mb-1">
                    <div class="d-flex align-center gap-2">
                        <span style="color: #64748b; font-size: 0.8rem; font-weight: bold;"><i class="fa-regular fa-calendar"></i> ${formatDate(pr.date)}</span>
                        ${archiveBadge}
                    </div>
                    <div class="d-flex gap-2">
                        ${editBtn}
                        <button class="btn btn-secondary" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;" onclick="clonePrescription(${index})">
                            <i class="fa-solid fa-copy"></i> نسخ
                        </button>
                        <button class="btn btn-secondary" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;" onclick="openPrintModal(${index})">
                            <i class="fa-solid fa-print"></i> الوصفة (OR)
                        </button>
                    </div>
                </div>
                
                <div class="visit-content mt-3" style="border-top: 1px solid #f8fafc; padding-top: 10px;">
                    <div class="grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div>
                            <h4 style="margin:0; font-size: 0.9rem; color: #1e293b;"><i class="fa-solid fa-comment-medical text-indigo-500"></i> سبب الزيارة:</h4>
                            <p style="margin: 4px 0 10px; color: #475569;">${pr.motif || 'غير مسجل'}</p>
                        </div>
                        <div>
                            <h4 style="margin:0; font-size: 0.9rem; color: #1e293b;"><i class="fa-solid fa-stethoscope text-green-500"></i> التشخيص:</h4>
                            <p style="margin: 4px 0 10px; color: #0f172a; font-weight: bold;">${pr.diagnosis || 'غير محدد'}</p>
                        </div>
                    </div>
                    
                    <div class="mt-2">
                        <h4 style="margin:0; font-size: 0.9rem; color: #1e293b;"><i class="fa-solid fa-clipboard-check text-blue-500"></i> الفحص السريري:</h4>
                        <p style="margin: 4px 0 10px; color: #475569; font-style: italic;">${pr.examination || 'لا توجد ملاحظات فحص.'}</p>
                    </div>

                    <div class="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <h4 style="margin:0 0 10px; font-size: 0.9rem; color: #1e293b;"><i class="fa-solid fa-pills text-red-500"></i> الأدوية الموصوفة:</h4>
                        <div class="medication-list" style="color: #334155; line-height: 1.6; font-weight: 500;">${medsHtml || '<span style="color:#aaa;">لا توجد أدوية مكتوبة</span>'}</div>
                    </div>
                </div>
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
        qrContainer.innerHTML = ''; // Clear previous QR Code completely

        // Generate exactly once, size layout is handled natively by the CSS
        // Removed the patient name from the payload to avoid code length overflow with Arabic text
        const safeQrText = unescape(encodeURIComponent(`RX-${prescription.id} | Date: ${new Date(prescription.date).toLocaleDateString('fr-FR')}`));
        new QRCode(qrContainer, {
            text: safeQrText,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L
        });

        // Give the modal a tiny delay to ensure the canvas is attached before triggering the print script
        setTimeout(() => {
            openModal('printPrescriptionModal');
        }, 50);

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
    document.getElementById('motifTitle').value = '';
    document.getElementById('diagTitle').value = '';
    document.getElementById('examDetail').value = '';
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
    document.getElementById('motifTitle').value = pr.motif || '';
    document.getElementById('diagTitle').value = pr.diagnosis || '';
    document.getElementById('examDetail').value = pr.examination || '';

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
    document.getElementById('motifTitle').value = pr.motif || '';
    document.getElementById('diagTitle').value = pr.diagnosis || '';
    document.getElementById('examDetail').value = pr.examination || '';

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

// Initialize Page
document.addEventListener('DOMContentLoaded', async () => {
    // Role-based access control for Prescriptions
    const userRole = localStorage.getItem('role');
    const isDoctor = localStorage.getItem('doctor_session') === 'true';
    const canSeeMedicalRecords = userRole === 'doctor' || isDoctor;

    // First: Fetch Patient Details. If it redirects or fails, we halt execution.
    const isPatientLoaded = await fetchPatientDetails();
    if (!isPatientLoaded) return;

    // Next: Handle Prescriptions Visibility & Fetching
    const header = document.getElementById('prescriptionsHeader');
    const card = document.getElementById('prescriptionsCard');
    const historySection = document.getElementById('medicalHistorySection');

    if (canSeeMedicalRecords) {
        if (patientId) {
            await fetchPrescriptions();
        }
    } else {
        // Hide sensitive info from Receptionists/others
        if (header) header.style.display = 'none';
        if (card) card.style.display = 'none';
        if (historySection) historySection.style.display = 'none';

        const mainContainer = document.querySelector('main.container');
        if (mainContainer) {
            const warning = document.createElement('div');
            warning.className = 'bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-800 mt-4';
            warning.innerHTML = '<p class="font-bold flex items-center gap-2"><i class="fa-solid fa-shield-halved"></i> تم إخفاء السجل الطبي</p><p>السجلات والوصفات الطبية مشفرة ومتاحة فقط للطبيب المعالج للحفاظ على سرية المرضى.</p>';
            mainContainer.appendChild(warning);
        }
    }

    // Finally: Attach form submit listener
    const addPrescriptionForm = document.getElementById('addPrescriptionForm');
    if (addPrescriptionForm) {
        addPrescriptionForm.addEventListener('submit', async (e) => {
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
                motif: document.getElementById('motifTitle').value,
                examination: document.getElementById('examDetail').value,
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
                // Refresh list
                await fetchPrescriptions();
            } catch (error) {
                alert('حدث خطأ أثناء حفظ الوصفة');
                console.error(error);
                const submitBtn = e.target.querySelector('button');
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'حفظ الوصفة';
            }
        });
    }

    // Vitals Form Submit
    const addVitalsForm = document.getElementById('addVitalsForm');
    if(addVitalsForm) {
        addVitalsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';

            const data = {
                date: document.getElementById('vitalDate').value,
                blood_pressure: document.getElementById('vitalBp').value,
                blood_sugar: document.getElementById('vitalSugar').value,
                weight: document.getElementById('vitalWeight').value,
                temperature: document.getElementById('vitalTemp').value,
                heart_rate: document.getElementById('vitalHeart').value,
                notes: document.getElementById('vitalNotes').value
            };

            try {
                await axios.post(`${API_URL}/patients/${patientId}/vitals`, data);
                closeModal('addVitalsModal');
                e.target.reset();
                fetchVitals();
            } catch(error) {
                alert('خطأ في الحفظ');
            }
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'حفظ القياسات';
        });
    }

    // Document Form Submit
    const addDocumentForm = document.getElementById('addDocumentForm');
    if(addDocumentForm) {
        addDocumentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('docFile');
            if(!fileInput.files[0]) return;

            const submitBtn = e.target.querySelector('button');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الرفع...';

            const formData = new FormData();
            formData.append('title', document.getElementById('docTitle').value);
            formData.append('document', fileInput.files[0]);

            try {
                await axios.post(`${API_URL}/patients/${patientId}/documents`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
                closeModal('addDocumentModal');
                e.target.reset();
                fetchDocuments();
            } catch(error) {
                alert('خطأ في الرفع');
            }
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'رفع الملف <i class="fa-solid fa-cloud-arrow-up"></i>';
        });
    }
});

// --- Tabs Logic ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.style.color = '#64748b';
        el.style.borderBottomColor = 'transparent';
    });

    document.getElementById(tabId).style.display = 'block';
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if(activeBtn) {
        activeBtn.style.color = 'var(--primary-color)';
        activeBtn.style.borderBottomColor = 'var(--primary-color)';
    }

    if (tabId === 'vitalsTab') fetchVitals();
    if (tabId === 'documentsTab') fetchDocuments();
}

// --- Vitals Logic ---
function openAddVitalsModal() {
    document.getElementById('addVitalsForm').reset();
    
    // Set default date to now
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - offset)).toISOString().slice(0, 16);
    document.getElementById('vitalDate').value = localISOTime;

    openModal('addVitalsModal');
}

async function fetchVitals() {
    try {
        const response = await axios.get(`${API_URL}/patients/${patientId}/vitals`);
        const vitals = response.data;
        const list = document.getElementById('vitalsList');
        
        if (vitals.length === 0) {
            list.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 1rem; color: #64748b;">لا توجد قياسات مسجلة</td></tr>';
            return;
        }

        list.innerHTML = vitals.map(v => `
            <tr style="border-bottom: 1px solid #e2e8f0; background: white;">
                <td style="padding: 1rem; direction: ltr; text-align: right;">${formatDate(v.date)}</td>
                <td style="padding: 1rem; direction: ltr;">${v.blood_pressure || '-'}</td>
                <td style="padding: 1rem;">${v.blood_sugar ? v.blood_sugar + ' g/L' : '-'}</td>
                <td style="padding: 1rem;">${v.weight ? v.weight + ' Kg' : '-'}</td>
                <td style="padding: 1rem;">${v.temperature ? v.temperature + ' °C' : '-'}</td>
                <td style="padding: 1rem;">${v.heart_rate ? v.heart_rate + ' bpm' : '-'}</td>
                <td style="padding: 1rem;">
                    <button class="btn" style="background: #fee2e2; color: #ef4444; padding: 0.25rem 0.5rem;" onclick="deleteVital(${v.id})" title="حذف">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
            ${v.notes ? `<tr><td colspan="7" style="padding: 0.5rem 1rem 1rem; color: #64748b; font-size: 0.85rem; background: #fafafa;"><i class="fa-solid fa-note-sticky"></i> ${v.notes}</td></tr>` : ''}
        `).join('');
    } catch (e) {
        console.error(e);
    }
}

async function deleteVital(id) {
    if(!confirm('هل أنت متأكد من حذف هذا القياس؟')) return;
    try {
        await axios.delete(`${API_URL}/vitals/${id}`);
        fetchVitals();
    } catch (e) {
        alert('حدث خطأ');
    }
}

// --- Documents Logic ---
async function fetchDocuments() {
    try {
        const response = await axios.get(`${API_URL}/patients/${patientId}/documents`);
        const docs = response.data;
        const list = document.getElementById('documentsList');
        
        if (docs.length === 0) {
            list.innerHTML = '<p class="text-center" style="color: var(--text-muted); grid-column: 1 / -1;">لا توجد ملفات مرفقة.</p>';
            return;
        }

        list.innerHTML = docs.map(d => {
            const isImage = d.file_path.match(/\\.(jpeg|jpg|png|gif)$/i);
            const icon = isImage ? '<i class="fa-regular fa-image fa-3x text-blue-400"></i>' : '<i class="fa-solid fa-file-pdf fa-3x text-red-400"></i>';
            
            return `
            <div class="card" style="text-align: center; padding: 1.5rem;">
                <div style="margin-bottom: 1rem;">
                    <a href="${d.file_path}" target="_blank" style="text-decoration: none;">${icon}</a>
                </div>
                <h4 style="margin: 0.5rem 0; font-size: 1rem; color: #1e293b;">${d.title}</h4>
                <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 1rem;">${new Date(d.upload_date).toLocaleDateString()}</p>
                <div class="d-flex justify-center gap-2">
                    <a href="${d.file_path}" target="_blank" class="btn btn-secondary" style="padding: 0.3rem 0.6rem;"><i class="fa-solid fa-eye"></i> عرض</a>
                    <button class="btn" style="background: #fee2e2; color: #ef4444; padding: 0.3rem 0.6rem;" onclick="deleteDocument(${d.id})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
    }
}

async function deleteDocument(id) {
    if(!confirm('هل أنت متأكد من حذف هذا الملف؟')) return;
    try {
        await axios.delete(`${API_URL}/documents/${id}`);
        fetchDocuments();
    } catch (e) {
        alert('حدث خطأ');
    }
}

// --- Certificates Logic ---
function openCertModal() {
    document.getElementById('certDays').value = '';
    document.getElementById('certSpeciality').value = '';
    document.getElementById('certContent').value = '';
    certTypeChanged();
    openModal('certModal');
}

function certTypeChanged() {
    const type = document.getElementById('certType').value;
    document.querySelectorAll('.cert_repos_field, .lettre_orientation_field').forEach(el => el.style.display = 'none');
    
    if(type === 'cert_repos') {
        document.querySelectorAll('.cert_repos_field').forEach(el => el.style.display = 'block');
    } else if(type === 'lettre_orientation') {
        document.querySelectorAll('.lettre_orientation_field').forEach(el => el.style.display = 'block');
    }
}

function generateAndPrintCert() {
    const type = document.getElementById('certType').value;
    const pName = window.currentPatientData.name;
    const pAge = window.currentPatientData.age;
    
    document.getElementById('certDocDate').textContent = new Date().toLocaleDateString('fr-FR');
    const titleObj = document.getElementById('certMainTitle');
    const bodyObj = document.getElementById('certBodyContent');
    
    // Hide standard prescription
    document.getElementById('printablePrescription').style.display = 'none';
    const certUI = document.getElementById('printableCertificate');
    certUI.style.display = 'block';

    if (type === 'cert_repos') {
        titleObj.textContent = "CERTIFICAT MEDICAL";
        const days = document.getElementById('certDays').value || 3;
        bodyObj.innerHTML = `
            Je soussigné, Docteur en médecine, certifie avoir examiné ce jour:<br>
            M / Mme : <strong>${pName}</strong>, âgé(e) de <strong>${pAge} ans</strong>.<br><br>
            L’état de santé nécessite un repos absolu de <strong>${days} jours</strong>, sauf complication, à dater du <strong>${new Date().toLocaleDateString('fr-FR')}</strong>.<br><br>
            Certificat délivré pour servir et valoir ce que de droit.
        `;
    } else if (type === 'cert_aptitude') {
        titleObj.textContent = "CERTIFICAT DE BONNE SANTE";
        bodyObj.innerHTML = `
            Je soussigné, Docteur en médecine, certifie avoir examiné ce jour:<br>
            M / Mme : <strong>${pName}</strong>, âgé(e) de <strong>${pAge} ans</strong>.<br><br>
            Et déclare que son état de santé actuel <strong>ne présente aucune contre-indication</strong> apparente à la pratique du sport / vie en collectivité.<br><br>
            Certificat délivré pour servir et valoir ce que de droit.
        `;
    } else if (type === 'lettre_orientation') {
        titleObj.textContent = "LETTRE D'ORIENTATION";
        const spec = document.getElementById('certSpeciality').value || "...";
        const content = document.getElementById('certContent').value.replace(/\n/g, '<br>') || "Merci de bien vouloir examiner et prendre en charge ce patient pour avis spécialisé et traitement.";
        bodyObj.innerHTML = `
            <strong>Confrère (Spécialité):</strong> ${spec}<br><br>
            Cher confrère, je vous adresse le patient:<br>
            M / Mme : <strong>${pName}</strong>, âgé(e) de <strong>${pAge} ans</strong>.<br><br>
            <strong>Motif:</strong><br>
            ${content}<br><br>
            Merci pour votre collaboration et confraternité.
        `;
    }

    closeModal('certModal');
    
    // Slight delay to render then print
    setTimeout(() => {
        window.print();
        // Restore prescription view just in case
        setTimeout(() => {
            certUI.style.display = 'none';
            document.getElementById('printablePrescription').style.display = 'block';
        }, 1000);
    }, 100);
}

