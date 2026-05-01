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
    return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

// Fetch Patients
async function fetchPatients(search = '') {
    try {
        const response = await axios.get(`${API_URL}/patients?search=${encodeURIComponent(search)}`);
        const patients = response.data;
        renderPatients(patients);
    } catch (error) {
        console.error('Error fetching patients:', error);
    }
}

function renderPatients(patients) {
    const list = document.getElementById('patientsList');
    if (patients.length === 0) {
        list.innerHTML = `<p class="text-center" style="grid-column: 1 / -1; color: var(--text-muted); margin-top: 2rem;">لا يوجد مرضى مطابقين.</p>`;
        return;
    }

    list.innerHTML = patients.map(p => `
        <a href="/doctor/patient.html?id=${p.id}" class="card" style="text-decoration: none; color: inherit; display: block;">
            <div class="d-flex align-center gap-2 mb-4" style="gap: 1rem;">
                <div class="avatar" style="width: 50px; height: 50px; font-size: 1.5rem;">
                    ${p.name.charAt(0)}
                </div>
                <div>
                    <h3 style="color: var(--primary-dark); font-size: 1.125rem;">${p.name}</h3>
                    <p style="color: var(--text-muted); font-size: 0.875rem;">العمر: ${p.age}</p>
                </div>
            </div>
            <p style="color: var(--text-muted); font-size: 0.875rem; display: flex; justify-content: space-between;">
                <span><i class="fa-solid fa-phone"></i> ${p.phone || '-'}</span>
                <span>تاريخ التسجيل: ${formatDate(p.created_at).split(' ')[0]}</span>
            </p>
        </a>
    `).join('');
}

// Search
let searchTimeout;
function searchPatients() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const val = document.getElementById('searchInput').value;
        fetchPatients(val);
    }, 300);
}

// Add Patient
document.getElementById('addPatientForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        name: document.getElementById('patientName').value,
        age: document.getElementById('patientAge').value,
        phone: document.getElementById('patientPhone').value,
        history: document.getElementById('patientHistory').value
    };

    try {
        const submitBtn = e.target.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> حفظ...';

        await axios.post(`${API_URL}/patients`, data);

        closeModal('addPatientModal');
        e.target.reset();
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'حفظ بيانات المريض';
        fetchPatients();
    } catch (error) {
        alert('حدث خطأ أثناء حفظ البيانات');
        console.error(error);
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchPatients();
});
