const API_URL = '/api'; // Use relative path for production readiness

// Global Axios Interceptor for Doctor Authentication
axios.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
let currentPage = 1;
let currentSearch = '';
let isLastPage = false;
let isLoading = false;

const searchInput = document.getElementById('searchInput');
const patientsContainer = document.getElementById('patientsContainer');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const statsBanner = document.getElementById('statsBanner');
const loadingIndicator = document.getElementById('loadingIndicator');

// Calculate Age Helper
function calculateAge(ageField, dobField) {
    let age = ageField;
    if (dobField) {
        const birthDate = new Date(dobField);
        const today = new Date();
        let calculatedAge = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            calculatedAge--;
        }
        age = calculatedAge;
    }
    return age || '-';
}

function renderPatients(patients, append = false) {
    if (!append) {
        patientsContainer.innerHTML = '';
    }

    if (patients.length === 0 && !append) {
        patientsContainer.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #6b7280; background: white; border-radius: 12px; margin-top: 1rem;">
                <i class="fa-solid fa-folder-open fa-3x" style="color: #d1d5db; margin-bottom: 1rem;"></i>
                <p style="font-size: 1.1rem;">لم يتم العثور على أي مرضى يطابقون بحثك.</p>
            </div>
        `;
        return;
    }

    const html = patients.map(p => {
        const age = calculateAge(p.age, p.dob);
        return `
            <a href="/doctor/patient.html?id=${p.id}" class="patient-card">
                <div class="patient-info">
                    <h3><i class="fa-solid fa-user-circle" style="color: var(--primary-color);"></i> ${p.name}</h3>
                    <p>
                        <span title="رقم الملف"><i class="fa-solid fa-id-card"></i> ID: ${p.id}</span>
                        <span title="رقم الهاتف"><i class="fa-solid fa-phone"></i> ${p.phone || 'غير مسجل'}</span>
                        <span title="العمر"><i class="fa-solid fa-cake-candles"></i> ${age} سنة</span>
                        <span title="تاريخ آخر زيارة / تسجيل"><i class="fa-regular fa-calendar"></i> ${new Date(p.created_at).toLocaleDateString('ar-EG')}</span>
                    </p>
                </div>
                <div style="color: var(--primary-color);">
                    <i class="fa-solid fa-chevron-left"></i>
                </div>
            </a>
        `;
    }).join('');

    if (append) {
        patientsContainer.insertAdjacentHTML('beforeend', html);
    } else {
        patientsContainer.innerHTML = html;
    }
}

async function fetchPatients(page = 1, append = false) {
    if (isLoading) return;
    isLoading = true;

    if (!append) {
        loadingIndicator.style.display = 'block';
        patientsContainer.style.display = 'none';
        statsBanner.textContent = 'جاري البحث...';
        loadMoreBtn.style.display = 'none';
    } else {
        loadMoreBtn.disabled = true;
        loadMoreBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحميل...';
    }

    try {
        const response = await axios.get(`${API_URL}/records/patients`, {
            params: {
                page: page,
                search: currentSearch
            }
        });

        const { data, pagination } = response.data;

        renderPatients(data, append);

        currentPage = pagination.page;
        isLastPage = currentPage >= pagination.totalPages;

        statsBanner.textContent = `تم العثور على ${pagination.total} مريض (يعرض الصفحة ${currentPage} من ${pagination.totalPages || 1})`;

        if (!isLastPage && pagination.total > 0) {
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.disabled = false;
            loadMoreBtn.innerHTML = 'تحميل المزيد من السجلات <i class="fa-solid fa-chevron-down"></i>';
        } else {
            loadMoreBtn.style.display = 'none';
        }

    } catch (error) {
        console.error('Error fetching patients:', error);
        statsBanner.textContent = 'حدث خطأ أثناء جلب البيانات. يرجى المحاولة مرة أخرى.';
    } finally {
        isLoading = false;
        loadingIndicator.style.display = 'none';
        patientsContainer.style.display = 'block';
    }
}

window.loadNextPage = function () {
    if (!isLastPage && !isLoading) {
        fetchPatients(currentPage + 1, true);
    }
}

// Debounce logic for real-time search
let debounceTimer;
searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
        const val = e.target.value.trim();
        // Only trigger search if value changed
        if (val !== currentSearch) {
            currentSearch = val;
            fetchPatients(1, false);
        }
    }, 300); // 300ms delay
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchPatients(1, false);
});
