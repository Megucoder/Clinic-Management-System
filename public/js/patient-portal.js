document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const loginForm = document.getElementById('loginForm');
    const loginPhoneInput = document.getElementById('loginPhone');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const welcomeName = document.getElementById('welcomeName');

    const loading = document.getElementById('loading');
    const noData = document.getElementById('noData');
    const appointmentsList = document.getElementById('appointmentsList');

    let currentPhone = localStorage.getItem('clinic_patient_phone');

    // Check if simple session exists
    if (currentPhone) {
        showDashboard(currentPhone);
    }

    // Login Action
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = loginPhoneInput.value;
        const phoneRegex = /^[0-9+() -]{9,15}$/;

        if (!phoneRegex.test(phone)) {
            Swal.fire('تنبيه', 'رجاءً أدخل رقم هاتف صحيح', 'warning');
            return;
        }

        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الدخول...';

        try {
            // First check if phone exists
            const infoRes = await axios.get(`/api/patient/info?phone=${encodeURIComponent(phone)}`);

            if (infoRes.data) {
                // Save to simple local storage session
                localStorage.setItem('clinic_patient_phone', phone);
                localStorage.setItem('clinic_patient_name', infoRes.data.name);
                currentPhone = phone;
                showDashboard(currentPhone, infoRes.data.name);
            } else {
                Swal.fire({
                    icon: 'info',
                    title: 'غير مسجل',
                    text: 'لم يتم العثور على أي مواعيد مسجلة برقم الهاتف هذا. تأكد من الرقم أو قم بحجز موعد جديد.',
                    confirmButtonText: 'حسناً',
                    confirmButtonColor: '#2563eb'
                });
            }
        } catch (error) {
            Swal.fire('خطأ', 'حدث خطأ في الاتصال بالخادم', 'error');
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = 'دخول';
        }
    });

    // Logout Action
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('clinic_patient_phone');
        localStorage.removeItem('clinic_patient_name');
        currentPhone = null;
        loginPhoneInput.value = '';
        dashboardSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
    });

    async function showDashboard(phone, name = null) {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');

        const ptName = name || localStorage.getItem('clinic_patient_name') || 'أهلاً بك';
        welcomeName.textContent = `أهلاً ${ptName.split(' ')[0]}`; // First name only

        appointmentsList.innerHTML = '';
        noData.classList.add('hidden');
        loading.classList.remove('hidden');

        try {
            const response = await axios.get(`/api/patient/appointments?phone=${encodeURIComponent(phone)}`);
            const apps = response.data;
            loading.classList.add('hidden');

            if (apps.length === 0) {
                noData.classList.remove('hidden');
            } else {
                renderAppointments(apps);
            }
        } catch (error) {
            loading.classList.add('hidden');
            Swal.fire('خطأ', 'تعذر تحميل بيانات المواعيد', 'error');
        }
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending': return `<span class="status-badge status-pending">قيد الانتظار</span>`;
            case 'confirmed': return `<span class="status-badge status-confirmed">مؤكد (يرجى الحضور)</span>`;
            case 'completed': return `<span class="status-badge status-completed">مكتمل</span>`;
            case 'cancelled': return `<span class="status-badge status-cancelled">ملغى</span>`;
            default: return `<span class="status-badge bg-gray-100 text-gray-700">${status}</span>`;
        }
    };

    const convertTo12HourFormat = (time24) => {
        const [hourStr, minStr] = time24.split(':');
        let hour = parseInt(hourStr, 10);
        const ampm = hour >= 12 ? 'م' : 'ص';
        hour = hour % 12;
        hour = hour ? hour : 12;
        return `${hour}:${minStr} ${ampm}`;
    };

    function renderAppointments(apps) {
        const now = new Date();

        apps.forEach(app => {
            const time12 = convertTo12HourFormat(app.time);
            const appDateStr = new Date(app.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            // Check if appointment is in the future and pending/confirmed to allow cancellation
            const appDateTime = new Date(`${app.date}T${app.time}`);
            const canCancel = (appDateTime > now) && (app.status === 'pending' || app.status === 'confirmed');

            const card = document.createElement('div');
            card.className = 'bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-blue-300 transition';

            card.innerHTML = `
                <div class="flex items-start gap-4">
                    <div class="bg-blue-50 text-blue-600 rounded-lg w-14 h-14 flex flex-col items-center justify-center flex-shrink-0 font-bold">
                        <span class="text-xl">${new Date(app.date).getDate()}</span>
                        <span class="text-xs">${new Date(app.date).toLocaleString('ar', { month: 'short' })}</span>
                    </div>
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <h4 class="text-lg font-bold text-gray-800">${app.type}</h4>
                            ${getStatusBadge(app.status)}
                        </div>
                        <ul class="text-gray-500 text-sm space-y-1">
                            <li><i class="fa-regular fa-calendar w-4"></i> ${appDateStr}</li>
                            <li><i class="fa-regular fa-clock w-4"></i> الساعة ${time12}</li>
                        </ul>
                    </div>
                </div>
                ${canCancel ? `
                    <div class="mt-4 md:mt-0 flex-shrink-0">
                        <button onclick="cancelPatientAppt(${app.id})" class="w-full md:w-auto px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                            <i class="fa-solid fa-xmark"></i> إلغاء الموعد
                        </button>
                    </div>
                ` : ''}
            `;
            appointmentsList.appendChild(card);
        });
    }

    // Cancel func global scope
    window.cancelPatientAppt = async (id) => {
        const result = await Swal.fire({
            title: 'هل أنت متأكد؟',
            text: 'هل ترغب حقاً في إلغاء هذا الموعد؟',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'نعم، قم بالإلغاء',
            cancelButtonText: 'تراجع'
        });

        if (result.isConfirmed) {
            try {
                const response = await axios.put(`/api/appointments/${id}/status`, { status: 'cancelled' });
                if (response.data.success) {
                    Swal.fire('تم الإلغاء', 'تم إلغاء موعدك بنجاح ونأسف لعدم تمكنك من الحضور.', 'success');
                    showDashboard(currentPhone); // Refresh list
                }
            } catch (error) {
                Swal.fire('خطأ', 'حدث خطأ أثناء إلغاء الموعد', 'error');
            }
        }
    };
});
