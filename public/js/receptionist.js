document.addEventListener('DOMContentLoaded', () => {
    // Left Box: Booking Logic
    const recPhone = document.getElementById('recPhone');
    const recName = document.getElementById('recName');
    const recDate = document.getElementById('recDate');
    const recTime = document.getElementById('recTime');
    const oldPatientBadge = document.getElementById('oldPatientBadge');
    const quickBookForm = document.getElementById('quickBookForm');
    const recSubmitBtn = document.getElementById('recSubmitBtn');

    const recDob = document.getElementById('recDob');
    const recBloodType = document.getElementById('recBloodType');
    const recAllergies = document.getElementById('recAllergies');

    // Right Box: Queue Logic
    const queueTableBody = document.getElementById('queueTableBody');
    const pendingCountEl = document.getElementById('pendingCount');
    const crowdAlert = document.getElementById('crowdAlert');
    const loadingQueue = document.getElementById('loadingQueue');
    const emptyQueue = document.getElementById('emptyQueue');
    const lastSyncTime = document.getElementById('lastSyncTime');

    // Polling setup (real-time simulation)
    const SYNC_INTERVAL = 10000; // 10 seconds
    let pollingTimer = null;

    // --- Booking Logic (Auto-fill & Time Slots) ---

    // Date formatting (YYYY-MM-DD)
    const getTodayStr = () => {
        const d = new Date();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${month}-${day}`;
    };

    recDate.value = getTodayStr(); // Default to today
    recDate.min = getTodayStr(); // Prevent past dates

    // Fetch patient by phone (without medical notes)
    recPhone.addEventListener('blur', async () => {
        const phone = recPhone.value;
        if (!phone || phone.length < 9) return;

        try {
            const response = await axios.get(`/api/patient/info?phone=${encodeURIComponent(phone)}`);
            if (response.data && response.data.name) {
                // Old patient! Auto-fill name, show green badge. NO notes shown.
                recName.value = response.data.name;
                recDob.value = response.data.dob || '';
                recBloodType.value = response.data.blood_type || '';
                recAllergies.value = response.data.allergies || '';
                oldPatientBadge.classList.remove('hidden');
            } else {
                oldPatientBadge.classList.add('hidden');
            }
        } catch (err) {
            oldPatientBadge.classList.add('hidden');
        }
    });

    // Fetch time slots for chosen date
    const loadTimeSlots = async () => {
        const date = recDate.value;
        if (!date) return;

        recTime.innerHTML = '<option value="">جاري التحميل...</option>';
        recTime.disabled = true;

        try {
            const response = await axios.get(`/api/available-slots?date=${date}`);
            const slots = response.data;
            recTime.innerHTML = '<option value="" disabled selected>اختر الوقت (20 دقيقة)</option>';

            if (slots.length === 0) {
                recTime.innerHTML = '<option value="" disabled>لا توجد أوقات متاحة</option>';
            } else {
                slots.forEach(t => {
                    const [hourStr, minStr] = t.split(':');
                    let hr = parseInt(hourStr);
                    const ampm = hr >= 12 ? 'م' : 'ص';
                    hr = hr % 12 || 12;
                    recTime.innerHTML += `<option value="${t}">${hr}:${minStr} ${ampm}</option>`;
                });
            }
            recTime.disabled = false;
        } catch (e) {
            recTime.innerHTML = '<option value="">خطأ في التحميل</option>';
        }
    };

    recDate.addEventListener('change', loadTimeSlots);
    loadTimeSlots(); // Initial load for today

    // Submit new booking
    quickBookForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            patient_name: recName.value,
            phone: recPhone.value,
            date: recDate.value,
            time: recTime.value,
            type: document.getElementById('recType').value,
            notes: '', // Intentionally empty: receptionist cannot see or add medical context
            dob: recDob.value,
            blood_type: recBloodType.value,
            allergies: recAllergies.value
        };

        recSubmitBtn.disabled = true;
        recSubmitBtn.textContent = 'جاري الحجز...';

        try {
            await axios.post('/api/appointments', data);

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'تم حجز الموعد بنجاح',
                showConfirmButton: false,
                timer: 2500
            });

            // Reset
            quickBookForm.reset();
            recDate.value = getTodayStr();
            recDob.value = '';
            recBloodType.value = '';
            recAllergies.value = '';
            oldPatientBadge.classList.add('hidden');
            loadTimeSlots();

            // Immediate sync to update table
            fetchTodayQueue();

        } catch (e) {
            Swal.fire('خطأ', 'فشل الحجز', 'error');
        } finally {
            recSubmitBtn.disabled = false;
            recSubmitBtn.textContent = 'حجز الموعد';
        }
    });

    // --- Queue Management (Polling & Table) ---

    const convertTime = (time24) => {
        const [h, m] = time24.split(':');
        let hr = parseInt(h);
        const ampm = hr >= 12 ? 'م' : 'ص';
        hr = hr % 12 || 12;
        return `<span dir="ltr" class="font-bold text-gray-800">${hr}:${m} ${ampm}</span>`;
    };

    const fetchTodayQueue = async (isSilent = false) => {
        const todayStr = getTodayStr();

        if (!isSilent) {
            queueTableBody.innerHTML = '';
            emptyQueue.classList.add('hidden');
            loadingQueue.classList.remove('hidden');
        }

        try {
            const response = await axios.get(`/api/appointments?date=${todayStr}`);
            // Rec sees ONLY pending and confirmed appointments. They do NOT need to see Completed or Cancelled.
            const waitingList = response.data.filter(app => app.status === 'pending' || app.status === 'confirmed');

            loadingQueue.classList.add('hidden');

            // Crowd alert logic (e.g., > 5 waiting)
            pendingCountEl.textContent = waitingList.length;
            if (waitingList.length >= 5) {
                crowdAlert.classList.remove('hidden');
            } else {
                crowdAlert.classList.add('hidden');
            }

            if (waitingList.length === 0) {
                queueTableBody.innerHTML = '';
                emptyQueue.classList.remove('hidden');
            } else {
                emptyQueue.classList.add('hidden');
                renderQueueTable(waitingList);
            }

            const now = new Date();
            lastSyncTime.innerHTML = `آخر تحديث: <span dir="ltr">${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}</span> (تلقائي)`;

        } catch (err) {
            console.error(err);
        }
    };

    const renderQueueTable = (list) => {
        const rows = list.map(app => {
            let statusHTML = '';
            let actionBtn = '';

            if (app.status === 'pending') {
                statusHTML = `<span class="status-badge status-pending">انتظار التقطيع</span>`;
                actionBtn = `<button onclick="confirmAppt(${app.id})" class="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded font-bold transition tooltip" title="تأكيد وصول المريض">تأكيد الحضور</button>`;
            } else if (app.status === 'confirmed') {
                statusHTML = `<span class="status-badge status-confirmed">مؤكد</span>`;
                // Receptionist can only confirm. Only doctor can COMPLETE.
                actionBtn = `<span class="text-xs text-gray-400">في انتظار الطبيب...</span>`;
            }

            return `
            <tr class="hover:bg-gray-50 transition border-b border-gray-100 last:border-0">
                <td class="px-6 py-4">${convertTime(app.time)}</td>
                <td class="px-6 py-4">
                    <div class="font-bold text-gray-900">${app.patient_name}</div>
                    <div class="text-xs text-gray-500 mt-0.5" dir="ltr">${app.phone}</div>
                </td>
                <td class="px-6 py-4 text-xs text-gray-600">${app.type}</td>
                <td class="px-6 py-4 text-center">${statusHTML}</td>
                <td class="px-6 py-4 text-center">${actionBtn}</td>
            </tr>
            `;
        });
        queueTableBody.innerHTML = rows.join('');
    };

    // Confirm patient arrival (Global func)
    window.confirmAppt = async (id) => {
        try {
            await axios.put(`/api/appointments/${id}/status`, { status: 'confirmed' });
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'تم تأكيد حضور المريض',
                showConfirmButton: false,
                timer: 2000
            });
            fetchTodayQueue(true); // silent refresh
        } catch (e) {
            Swal.fire('خطأ', 'فشل التحديث', 'error');
        }
    };

    // Start Polling 
    fetchTodayQueue();
    pollingTimer = setInterval(() => { fetchTodayQueue(true) }, SYNC_INTERVAL);

});
