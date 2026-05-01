document.addEventListener('DOMContentLoaded', () => {
    localStorage.setItem('role', 'doctor');

    // Global Axios Interceptor for Doctor Authentication
    axios.interceptors.request.use(config => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });

    let currentAppointments = [];
    let activeFilter = 'all';
    let pollingTimer = null;
    const SYNC_INTERVAL = 10000; // 10 seconds

    const tableBody = document.getElementById('tableBody');
    const loading = document.getElementById('loading');
    const noData = document.getElementById('noData');
    const dateFilter = document.getElementById('dateFilter');
    const todayBtn = document.getElementById('todayBtn');
    const currentDateDisplay = document.getElementById('currentDateDisplay');
    const appointmentsTable = document.getElementById('appointmentsTable');

    // Stats elements
    const statTotal = document.getElementById('statTotal');
    const statCompleted = document.getElementById('statCompleted');
    const statPending = document.getElementById('statPending');
    const statCancelled = document.getElementById('statCancelled');

    // Date formatting function
    const formatDate = (date) => {
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    };

    const getTodayStr = () => formatDate(new Date());

    // Initialize with today's date
    dateFilter.value = getTodayStr();

    const fetchAppointments = async (isSilent = false) => {
        const date = dateFilter.value;
        currentDateDisplay.textContent = new Date(date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        if (!isSilent) {
            // UI Reset only if it's a manual refresh/first load
            tableBody.innerHTML = '';
            appointmentsTable.classList.remove('hidden');
            noData.classList.add('hidden');
            loading.classList.remove('hidden');
        }

        try {
            const response = await axios.get(`/api/appointments?date=${date}`);
            currentAppointments = response.data;

            loading.classList.add('hidden');

            const lastSyncTime = document.getElementById('lastSyncTime');
            if (lastSyncTime) {
                const now = new Date();
                lastSyncTime.innerHTML = `تحديث: <span dir="ltr">${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}</span>`;
            }

            if (currentAppointments.length === 0) {
                noData.classList.remove('hidden');
                appointmentsTable.classList.add('hidden');
                updateStats([]);
                if (isSilent) tableBody.innerHTML = '';
                return;
            }

            // Always repopulate if we get data
            appointmentsTable.classList.remove('hidden');
            noData.classList.add('hidden');
            updateStats(currentAppointments);
            applyFilter(); // instead of renderTable directly
        } catch (error) {
            console.error('Error fetching appointments', error);
            if (!isSilent) {
                loading.classList.add('hidden');
                Swal.fire('خطأ', 'تعذر جلب المواعيد من الخادم', 'error');
            }
        }
    };

    const updateStats = (appointments) => {
        statTotal.textContent = appointments.length;
        statCompleted.textContent = appointments.filter(a => a.status === 'completed' || a.status === 'paid').length;
        statPending.textContent = appointments.filter(a => a.status === 'pending' || a.status === 'confirmed' || a.status === 'in_progress').length;
        statCancelled.textContent = appointments.filter(a => a.status === 'cancelled').length;
    };

    window.filterAppointments = (type) => {
        activeFilter = type;
        applyFilter();
    };

    const applyFilter = () => {
        // Update rings
        const filters = ['all', 'completed', 'pending', 'cancelled'];
        filters.forEach(f => {
            const el = document.getElementById(`filter-${f}`);
            if (el) {
                if (f === activeFilter) {
                    el.classList.add('ring-2');
                    el.classList.remove('ring-0');
                } else {
                    el.classList.remove('ring-2');
                    el.classList.add('ring-0');
                }
            }
        });

        // Filter data
        let filtered = currentAppointments;
        if (activeFilter === 'completed') {
            filtered = currentAppointments.filter(a => a.status === 'completed' || a.status === 'paid');
        } else if (activeFilter === 'pending') {
            filtered = currentAppointments.filter(a => a.status === 'pending' || a.status === 'confirmed' || a.status === 'in_progress');
        } else if (activeFilter === 'cancelled') {
            filtered = currentAppointments.filter(a => a.status === 'cancelled');
        }

        renderTable(filtered);
        
        // Update Live Queue Section
        const todayStr = getTodayStr();
        const isToday = dateFilter.value === todayStr;
        const liveQueueSection = document.getElementById('liveQueueSection');
        
        if (isToday && currentAppointments.length > 0) {
            if (liveQueueSection) liveQueueSection.classList.remove('hidden');
            updateLiveQueue();
        } else {
            if (liveQueueSection) liveQueueSection.classList.add('hidden');
        }
    };

    const updateLiveQueue = () => {
        const inProgress = currentAppointments.find(a => a.status === 'in_progress');
        const waitingList = currentAppointments.filter(a => a.status === 'confirmed');
        const nextPatient = waitingList[0];
        
        const currentPatientName = document.getElementById('currentPatientName');
        const currentPatientNumber = document.getElementById('currentPatientNumber');
        const currentPatientLink = document.getElementById('currentPatientLink');
        const nextPatientBrief = document.getElementById('nextPatientBrief');
        const callNextBtn = document.getElementById('callNextBtn');

        if (inProgress) {
            currentPatientName.textContent = inProgress.patient_name;
            currentPatientNumber.textContent = `#${inProgress.id}`;
            currentPatientLink.href = `/doctor/patient.html?phone=${encodeURIComponent(inProgress.phone)}`;
        } else {
            currentPatientName.textContent = 'لا يوجد مريض حالياً بالداخل';
            currentPatientNumber.textContent = '-';
            currentPatientLink.href = '#';
        }

        if (nextPatient) {
            nextPatientBrief.innerHTML = `
                <p class="text-gray-900 font-bold text-lg">${nextPatient.patient_name}</p>
                <p class="text-indigo-600 font-bold">الدور رقم #${nextPatient.id}</p>
            `;
            callNextBtn.disabled = false;
            callNextBtn.onclick = () => window.updateStatus(nextPatient.id, 'in_progress');
        } else {
            nextPatientBrief.innerHTML = `<p class="text-gray-400 italic">لا يوجد مرضى في الانتظار بالخارج</p>`;
            callNextBtn.disabled = true;
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending': return `<span class="status-badge status-pending">انتظار</span>`;
            case 'confirmed': return `<span class="status-badge status-confirmed">مؤكد (في الصالة)</span>`;
            case 'in_progress': return `<span class="status-badge" style="background-color: #e0e7ff; color: #4338ca;">قيد الفحص</span>`;
            case 'completed': return `<span class="status-badge status-completed">في انتظار الدفع</span>`;
            case 'paid': return `<span class="status-badge bg-green-100 text-green-700">مدفوع ومكتمل</span>`;
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

    const renderTable = (appointments) => {
        const rows = appointments.map(app => {
            const time12 = convertTo12HourFormat(app.time);
            const waitNumber = currentAppointments.findIndex(a => a.id === app.id) + 1;

            let actions = '';

            if (app.status === 'pending') {
                actions += `
                    <button onclick="updateStatus(${app.id}, 'confirmed')" class="text-green-600 bg-green-50 hover:bg-green-100 w-8 h-8 rounded-full flex items-center justify-center transition tooltip" title="تأكيد המوعد">
                        <i class="fa-solid fa-check"></i>
                    </button>
                `;
            }

            if (app.status === 'confirmed' || app.status === 'pending' || app.status === 'in_progress') {
                actions += `
                    <button onclick="updateStatus(${app.id}, 'completed')" class="text-blue-600 bg-blue-50 hover:bg-blue-100 w-8 h-8 rounded-full flex items-center justify-center transition tooltip" title="إنهاء الموعد (مكتمل)">
                        <i class="fa-solid fa-stethoscope"></i>
                    </button>
                    <button onclick="updateStatus(${app.id}, 'cancelled')" class="text-red-600 bg-red-50 hover:bg-red-100 w-8 h-8 rounded-full flex items-center justify-center transition tooltip" title="إلغاء الموعد">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                `;
            }

            if (!actions) {
                actions = `<span class="text-gray-400 text-xs">-</span>`;
            }

            return `
            <tr class="hover:bg-indigo-50/50 transition border-b border-gray-100 last:border-0 group ${app.status === 'confirmed' ? 'bg-indigo-50/30' : ''}">
                <td class="px-6 py-4 text-center">
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold text-xs">
                        ${waitNumber}
                    </span>
                </td>
                <td class="px-6 py-4 font-bold text-gray-800 whitespace-nowrap" dir="ltr">${time12}</td>
                <td class="px-6 py-4">
                    <a href="/doctor/patient.html?phone=${encodeURIComponent(app.phone)}" class="group-hover:text-blue-600 transition" title="فتح الملف الطبي">
                        <div class="font-medium text-gray-900 flex items-center gap-1 group-hover:underline">
                            ${app.patient_name} <i class="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-0 group-hover:opacity-100 transition"></i>
                        </div>
                    </a>
                    <div class="text-xs text-gray-500 mt-1 block md:hidden" dir="ltr">${app.phone}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="flex flex-col gap-1">
                        <span class="inline-flex items-center gap-1.5 py-1 px-2.5 rounded text-xs font-medium bg-gray-100 text-gray-800 w-fit">
                            ${app.type}
                        </span>
                        <span class="text-xs text-gray-500 hidden md:inline ml-1 mt-1" dir="ltr">${app.phone}</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-gray-500 text-xs max-w-xs truncate hidden md:table-cell" title="${app.notes || 'لا توجد ملاحظات'}">
                    ${app.notes ? app.notes : '<span class="text-gray-300">-</span>'}
                </td>
                <td class="px-6 py-4 text-center">
                    ${getStatusBadge(app.status)}
                </td>
                <td class="px-6 py-4 text-center">
                    <div class="flex items-center justify-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition duration-200">
                        ${actions}
                    </div>
                </td>
            </tr>
            `;
        }).join('');

        tableBody.innerHTML = rows;
    };

    // Event Listeners
    dateFilter.addEventListener('change', fetchAppointments);
    todayBtn.addEventListener('click', () => {
        dateFilter.value = getTodayStr();
        fetchAppointments();
    });

    // Make updateStatus globally available
    window.updateStatus = async (id, newStatus) => {
        // Confirm action if cancelling
        if (newStatus === 'cancelled') {
            const result = await Swal.fire({
                title: 'هل أنت متأكد؟',
                text: 'سيتم إلغاء هذا الموعد ولن يظهر كخيار متاح للمرضى الآخرين مباشرة، ويستحسن التواصل مع المريض أولاً.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#dc2626',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'نعم، قم بالإلغاء',
                cancelButtonText: 'تراجع'
            });

            if (!result.isConfirmed) return;
        }

        let price = undefined;
        // Prompt for price if completing
        if (newStatus === 'completed') {
            const result = await Swal.fire({
                title: 'إنهاء الفحص',
                text: 'يرجى إدخال تكلفة الكشف / العلاج (بالدينار):',
                input: 'number',
                inputAttributes: {
                    min: 0,
                    step: 100
                },
                showCancelButton: true,
                confirmButtonText: 'إرسال للاستقبال للدفع',
                cancelButtonText: 'إلغاء',
                inputValidator: (value) => {
                    if (!value) return 'الرجاء إدخال السعر!';
                    if (value < 0) return 'السعر لا يمكن أن يكون سالباً!';
                }
            });

            if (!result.isConfirmed) return;
            price = result.value;
        }

        // Call Next Logic integration
        if (newStatus === 'confirmed' && id === 'next') {
            const waitingList = currentAppointments.filter(a => a.status === 'pending');
            if (waitingList.length > 0) {
                id = waitingList[0].id;
            } else {
                return;
            }
        }

        try {
            const response = await axios.put(`/api/appointments/${id}/status`, { status: newStatus, price });
            if (response.data.success) {
                let txt = 'تم تحديث حالة الموعد بنجاح';
                if (newStatus === 'confirmed') txt = 'تم تأكيد الموعد بنجاح';
                if (newStatus === 'completed') txt = 'تم تحويل المريض للاستقبال للدفع';
                if (newStatus === 'cancelled') txt = 'تم إلغاء الموعد';

                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: txt,
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true
                });

                // Reload data silently
                fetchAppointments(true);
            }
        } catch (error) {
            console.error('Error updating status', error);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحديث الحالة', 'error');
        }
    };

    // Final attachments
    document.getElementById('finishCurrentBtn').onclick = () => {
        const inProgress = currentAppointments.find(a => a.status === 'in_progress');
        if (inProgress) {
            window.updateStatus(inProgress.id, 'completed');
        }
    };

    document.getElementById('callNextBtn').onclick = () => {
        const pendingList = currentAppointments.filter(a => a.status === 'confirmed');
        if (pendingList.length > 0) {
            window.updateStatus(pendingList[0].id, 'in_progress');
        }
    };

    // Initial load
    fetchAppointments();

    // Start polling
    pollingTimer = setInterval(() => {
        // Only auto-refresh if looking at today's schedule
        if (dateFilter.value === getTodayStr()) {
            fetchAppointments(true);
        }
    }, SYNC_INTERVAL);

});
