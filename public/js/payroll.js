document.addEventListener('DOMContentLoaded', () => {
    // Auth & Setup
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    document.getElementById('doctorNameLabel').textContent = `د. ${localStorage.getItem('username') || 'الطبيب'}`;

    // Sidebar Logic
    const sidebar = document.getElementById('sidebar');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const openSidebarBtn = document.getElementById('openSidebarBtn');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');

    function toggleSidebar() {
        sidebar.classList.toggle('open');
        mobileOverlay.classList.toggle('hidden');
    }

    openSidebarBtn?.addEventListener('click', toggleSidebar);
    closeSidebarBtn?.addEventListener('click', toggleSidebar);
    mobileOverlay?.addEventListener('click', toggleSidebar);

    // Elements
    const addWorkerBtn = document.getElementById('addWorkerBtn');
    const payrollMonthInput = document.getElementById('payrollMonth');
    const payrollTableBody = document.getElementById('payrollTableBody');
    const statWorkers = document.getElementById('statWorkers');
    const statUnpaid = document.getElementById('statUnpaid');
    const statPaid = document.getElementById('statPaid');

    // Default to current month
    const today = new Date();
    payrollMonthInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const loadPayroll = async () => {
        try {
            const [year, month] = payrollMonthInput.value.split('-');
            
            const [workersRes, payrollRes] = await Promise.all([
                axios.get('/api/workers'),
                axios.get(`/api/payroll?month=${month}&year=${year}`)
            ]);

            const workers = workersRes.data;
            const payroll = payrollRes.data;

            statWorkers.textContent = workers.length;

            let totalUnpaid = 0;
            let totalPaid = 0;

            payrollTableBody.innerHTML = '';

            if (payroll.length === 0) {
                payrollTableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-10 text-center text-gray-400 font-medium">لا يوجد عمال مضافين حالياً.</td></tr>`;
                statUnpaid.textContent = '0';
                statPaid.textContent = '0';
                return;
            }

            payroll.forEach(worker => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-indigo-50/30 transition-colors border-b border-gray-100 last:border-0";
                
                const salary = worker.calculated_salary || 0;
                const isPaid = worker.is_paid === 1;

                if (isPaid) {
                    totalPaid += salary;
                } else {
                    totalUnpaid += salary;
                }

                tr.innerHTML = `
                    <td class="px-6 py-5 whitespace-nowrap">
                        <div class="flex flex-col">
                            <span class="font-bold text-gray-900 text-base">${worker.username}</span>
                            <span class="text-[10px] text-gray-400 mt-0.5 font-medium uppercase tracking-wider">رقم التعريف: #${worker.user_id}</span>
                        </div>
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap">
                        ${worker.role === 'receptionist' ? 
                            `<span class="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold border border-indigo-200">مساعد استقبال</span>` 
                            : (worker.role === 'cleaner' ? 
                            `<span class="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg text-[11px] font-bold border border-teal-200">عامل نظافة</span>` 
                            : `<span class="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[11px] font-bold border border-amber-200">عامل عام</span>`)}
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap">
                        <div class="flex flex-col">
                            <span class="font-bold text-gray-800 text-sm">${worker.daily_rate} د.ج</span>
                            <span class="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">أجر اليوم الواحد</span>
                        </div>
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap text-center">
                        <button onclick="viewAttendanceDetails(${worker.user_id}, '${worker.username}')" class="group flex items-center justify-center gap-2 mx-auto bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm">
                            <i class="fa-solid fa-calendar-day text-indigo-500 group-hover:text-white transition"></i>
                            <span>${worker.days_attended} أيام عمل</span>
                        </button>
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap">
                        <div class="flex flex-col">
                            <span class="text-indigo-700 font-black text-lg leading-tight">${salary} <span class="text-[10px] font-bold">د.ج</span></span>
                            <span class="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">صافي المستحق</span>
                        </div>
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap text-center">
                        ${isPaid ? 
                            `<div class="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl font-bold text-xs border border-green-200">
                                <i class="fa-solid fa-circle-check"></i> تم الدفع بنجاح
                             </div>` 
                            : 
                            `<button onclick="confirmPayment(${worker.user_id}, ${salary}, '${worker.username}')" ${salary === 0 ? 'disabled' : ''} class="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 disabled:opacity-30 disabled:shadow-none">
                                <i class="fa-solid fa-receipt"></i> تسديد الراتب
                            </button>`
                        }
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap text-center">
                        <div class="flex items-center justify-center gap-3">
                            <button onclick="editWorker(${worker.user_id}, '${worker.username}', '${worker.role}', ${worker.daily_rate})" class="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 text-gray-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm" title="تعديل">
                                <i class="fa-solid fa-pen-to-square text-sm"></i>
                            </button>
                            <button onclick="deleteWorker(${worker.user_id}, '${worker.username}')" class="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all shadow-sm" title="حذف العامل">
                                <i class="fa-solid fa-trash-can text-sm"></i>
                            </button>
                        </div>
                    </td>
                `;
                payrollTableBody.appendChild(tr);
            });

            statUnpaid.textContent = totalUnpaid;
            statPaid.textContent = totalPaid;
        } catch (error) {
            console.error(error);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل البيانات', 'error');
        }
    };

    window.viewAttendanceDetails = async (userId, username) => {
        try {
            const response = await axios.get(`/api/attendance/worker/${userId}`);
            const data = response.data;
            
            const html = `
                <div class="max-h-[60vh] overflow-y-auto">
                    <table class="w-full text-right" dir="rtl">
                        <thead class="bg-gray-50 sticky top-0">
                            <tr>
                                <th class="p-2">التاريخ</th>
                                <th class="p-2 text-center">الحالة</th>
                                <th class="p-2 text-center">الإجراء</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            ${data.map(row => `
                                <tr>
                                    <td class="p-2">${row.date}</td>
                                    <td class="p-2 text-center text-xs">
                                        <span class="px-2 py-0.5 rounded-full font-bold ${row.status === 'Confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                                            ${row.status === 'Confirmed' ? 'مؤكد' : 'قيد الانتظار'}
                                        </span>
                                    </td>
                                    <td class="p-2 text-center">
                                        ${row.status === 'Pending' ? 
                                            `<button onclick="setAttendanceStatus(${userId}, '${row.date}', 'Confirmed')" class="text-green-600 hover:text-green-800 text-xl" title="قبول"><i class="fa-solid fa-circle-check"></i></button>
                                             <button onclick="deleteAttendance(${userId}, '${row.date}')" class="text-red-600 hover:text-red-800 text-xl ml-2" title="حذف"><i class="fa-solid fa-circle-xmark"></i></button>`
                                            : 
                                            `<button onclick="deleteAttendance(${userId}, '${row.date}')" class="text-gray-400 hover:text-red-600" title="حذف"><i class="fa-solid fa-trash-can"></i></button>`
                                        }
                                    </td>
                                </tr>
                            `).join('')}
                            ${data.length === 0 ? '<tr><td colspan="3" class="p-4 text-center text-gray-500">لا يوجد سجلات</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            `;

            Swal.fire({
                title: `سجل حضور: ${username}`,
                html: html,
                width: '500px',
                showCloseButton: true,
                showConfirmButton: false
            });
        } catch (error) {
            Swal.fire('خطأ', 'فشل تحميل السجل', 'error');
        }
    };

    window.setAttendanceStatus = async (userId, date, status) => {
        try {
            await axios.post('/api/attendance/approve', { user_id: userId, date, status });
            Swal.close();
            loadPayroll();
        } catch (e) {
            Swal.fire('خطأ', 'فشل التحديث', 'error');
        }
    };

    window.deleteAttendance = async (userId, date) => {
        try {
            await axios.delete(`/api/attendance/${userId}/${date}`);
            Swal.close();
            loadPayroll();
        } catch (e) {
            Swal.fire('خطأ', 'فشل الحذف', 'error');
        }
    };

    // Add Worker
    addWorkerBtn.addEventListener('click', () => {
        Swal.fire({
            title: '<div class="flex items-center gap-2 justify-center mb-2"><i class="fa-solid fa-user-plus text-indigo-600"></i><span>إضافة عامل جديد</span></div>',
            html: `
                <div class="text-right space-y-4 px-2 py-4">
                    <div class="relative">
                        <label class="block text-xs font-bold text-gray-500 mb-1 mr-1">اسم المستخدم</label>
                        <div class="relative">
                            <i class="fa-solid fa-user absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                            <input id="swal-username" class="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition" placeholder="مثال: ahmed_24" dir="rtl">
                        </div>
                    </div>
                    
                    <div class="relative">
                        <label class="block text-xs font-bold text-gray-500 mb-1 mr-1">كلمة المرور</label>
                        <div class="relative">
                            <i class="fa-solid fa-lock absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                            <input id="swal-password" type="password" class="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition" placeholder="••••••••" dir="rtl">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="relative">
                            <label class="block text-xs font-bold text-gray-500 mb-1 mr-1">نوعية العامل</label>
                            <div class="relative">
                                <i class="fa-solid fa-briefcase absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                <select id="swal-role" class="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition appearance-none" dir="rtl">
                                    <option value="receptionist">مساعد استقبال</option>
                                    <option value="cleaner">عامل نظافة</option>
                                    <option value="worker">عامل عام</option>
                                </select>
                            </div>
                        </div>
                        <div class="relative">
                            <label class="block text-xs font-bold text-gray-500 mb-1 mr-1">الأجر اليومي (د.ج)</label>
                            <div class="relative">
                                <i class="fa-solid fa-money-bill-1 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                <input id="swal-rate" type="number" class="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition" placeholder="0.00" dir="rtl">
                            </div>
                        </div>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'إضافة العامل',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#94a3b8',
            customClass: {
                popup: 'rounded-3xl shadow-2xl',
                confirmButton: 'px-8 py-3 rounded-xl font-bold',
                cancelButton: 'px-8 py-3 rounded-xl font-bold'
            },
            preConfirm: () => {
                const u = document.getElementById('swal-username').value;
                const p = document.getElementById('swal-password').value;
                const r = document.getElementById('swal-role').value;
                const rate = document.getElementById('swal-rate').value;
                if (!u || !p || !rate) {
                    Swal.showValidationMessage('يرجى ملء جميع الحقول المطلوبة');
                    return false;
                }
                return { username: u, password: p, role: r, daily_rate: rate };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await axios.post('/api/workers', result.value);
                    Swal.fire({
                        title: 'تم الإضافة!',
                        text: 'تم إضافة العامل بنجاح إلى النظام.',
                        icon: 'success',
                        confirmButtonColor: '#4f46e5',
                        customClass: { popup: 'rounded-3xl' }
                    });
                    loadPayroll();
                } catch(err) {
                    Swal.fire('خطأ', err.response?.data?.error || 'حدث خطأ', 'error');
                }
            }
        });
    });

    window.editWorker = (id, username, role, currentRate) => {
        Swal.fire({
            title: '<div class="flex items-center gap-2 justify-center mb-2"><i class="fa-solid fa-user-pen text-indigo-600"></i><span>تعديل بيانات العامل</span></div>',
            html: `
                <div class="text-right space-y-4 px-2 py-4">
                    <div class="bg-indigo-50 p-3 rounded-xl border border-indigo-100 mb-4 text-center">
                        <p class="text-xs text-indigo-600 font-bold mb-1 uppercase tracking-wider">تعديل حساب</p>
                        <p class="text-lg font-bold text-gray-800">${username}</p>
                    </div>

                    <div class="relative">
                        <label class="block text-xs font-bold text-gray-500 mb-1 mr-1">تغيير كلمة المرور</label>
                        <div class="relative">
                            <i class="fa-solid fa-key absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                            <input id="swal-password-e" type="text" class="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition" placeholder="اتركه فارغ للحفاظ على الحالية" dir="rtl">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="relative">
                            <label class="block text-xs font-bold text-gray-500 mb-1 mr-1">تحديث الوظيفة</label>
                            <div class="relative">
                                <i class="fa-solid fa-briefcase absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                <select id="swal-role-e" class="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition appearance-none" dir="rtl">
                                    <option value="receptionist" ${role === 'receptionist' ? 'selected' : ''}>مساعد استقبال</option>
                                    <option value="cleaner" ${role === 'cleaner' ? 'selected' : ''}>عامل نظافة</option>
                                    <option value="worker" ${role === 'worker' ? 'selected' : ''}>عامل عام</option>
                                </select>
                            </div>
                        </div>
                        <div class="relative">
                            <label class="block text-xs font-bold text-gray-500 mb-1 mr-1">الأجر اليومي (د.ج)</label>
                            <div class="relative">
                                <i class="fa-solid fa-money-bill-1 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                <input id="swal-rate-e" type="number" class="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition" value="${currentRate}" placeholder="0.00" dir="rtl">
                            </div>
                        </div>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'تحديث البيانات',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#94a3b8',
            customClass: {
                popup: 'rounded-3xl shadow-2xl',
                confirmButton: 'px-8 py-3 rounded-xl font-bold',
                cancelButton: 'px-8 py-3 rounded-xl font-bold'
            },
            preConfirm: () => {
                const p = document.getElementById('swal-password-e').value;
                const r = document.getElementById('swal-role-e').value;
                const rate = document.getElementById('swal-rate-e').value;
                if (!rate) {
                    Swal.showValidationMessage('يرجى إدخال الأجر اليومي');
                    return false;
                }
                const data = { username, role: r, daily_rate: rate };
                if (p) data.password = p; 
                return data;
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await axios.post('/api/workers', result.value);
                    Swal.fire({
                        title: 'تم التحديث!',
                        text: 'تم تحديث بيانات العامل بنجاح.',
                        icon: 'success',
                        confirmButtonColor: '#4f46e5',
                        customClass: { popup: 'rounded-3xl' }
                    });
                    loadPayroll();
                } catch(err) {
                    Swal.fire('خطأ', err.response?.data?.error || 'حدث خطأ', 'error');
                }
            }
        });
    };

    window.deleteWorker = (id, username) => {
        Swal.fire({
            title: 'هل أنت متأكد؟',
            text: `هل تريد حقاً حذف العامل ${username}؟ سيتم حذف جميع بيانات حضوره ورواتبه.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'نعم، احذف!',
            cancelButtonText: 'إلغاء'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await axios.delete(`/api/workers/${id}`);
                    Swal.fire('تم!', 'تم حذف العامل بنجاح.', 'success');
                    loadPayroll();
                } catch(err) {
                    Swal.fire('خطأ', err.response?.data?.error || 'حدث خطأ أثناء الحذف', 'error');
                }
            }
        });
    };

    window.confirmPayment = (userId, amount, username) => {
        if (amount <= 0) return;
        
        Swal.fire({
            title: 'تأكيد دفع الراتب؟',
            text: `هل أنت متأكد من دفع ${amount} د.ج للعامل ${username}؟`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#d33',
            confirmButtonText: 'نعم، قم بالدفع!',
            cancelButtonText: 'إلغاء'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const [year, month] = payrollMonthInput.value.split('-');
                    await axios.post('/api/payroll/pay', {
                        user_id: userId,
                        amount: amount,
                        month: month,
                        year: year
                    });
                    
                    Swal.fire('تم!', 'تم تسجيل الدفع بنجاح.', 'success');
                    loadPayroll();
                } catch (err) {
                    Swal.fire('خطأ', err.response?.data?.error || 'حدث خطأ أثناء الدفع', 'error');
                }
            }
        });
    };

    payrollMonthInput.addEventListener('change', loadPayroll);

    // Initial load
    loadPayroll();
});
