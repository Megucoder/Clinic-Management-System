document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    if (!token) {
        // If receptionist came from dashboard without proper login
        alert('يرجى تسجيل الدخول بحساب الموظف الخاص بك للوصول إلى نظام الحضور والانصراف.');
        window.location.href = '/login.html';
        return;
    }

    document.getElementById('welcomeUser').textContent = `أهلاً، ${username}`;

    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    const checkInBtn = document.getElementById('checkInBtn');
    const checkInStatus = document.getElementById('checkInStatus');
    const attendanceTableBody = document.getElementById('attendanceTableBody');
    const emptyQueue = document.getElementById('emptyQueue');

    const loadAttendance = async () => {
        try {
            const response = await axios.get('/api/attendance/me');
            const data = response.data;
            
            attendanceTableBody.innerHTML = '';
            
            if (data.length === 0) {
                emptyQueue.classList.remove('hidden');
                return;
            }
            
            emptyQueue.classList.add('hidden');
            
            data.forEach(record => {
                const tr = document.createElement('tr');
                let statusBadge = '';
                if (record.status === 'Confirmed') {
                    statusBadge = '<span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">مؤكد ✅</span>';
                } else if (record.status === 'Pending') {
                    statusBadge = '<span class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">بانتظار موافقة الطبيب ⏳</span>';
                } else {
                    statusBadge = `<span class="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">${record.status} ❌</span>`;
                }

                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">${record.date}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                        ${statusBadge}
                    </td>
                `;
                attendanceTableBody.appendChild(tr);
            });
            
            // Check if checked in today
            const today = new Date();
            const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const hasCheckedInToday = data.some(d => d.date === dateStr);
            
            if (hasCheckedInToday) {
                checkInBtn.disabled = true;
                checkInBtn.classList.replace('bg-teal-600', 'bg-gray-400');
                checkInBtn.classList.replace('hover:bg-teal-700', 'hover:bg-gray-400');
                checkInBtn.innerHTML = '<i class="fa-solid fa-clock text-2xl"></i> تم إرسال طلب الحضور';
            }
            
        } catch(err) {
            console.error(err);
        }
    };

    checkInBtn.addEventListener('click', async () => {
        try {
            checkInBtn.disabled = true;
            checkInBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-2xl"></i> جاري التسجيل...';
            
            const response = await axios.post('/api/attendance/checkin');
            
            if (response.data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'تم',
                    text: 'تم تسجيل الحضور بنجاح!',
                    timer: 2000,
                    showConfirmButton: false
                });
                loadAttendance();
            }
        } catch(err) {
            checkInBtn.disabled = false;
            checkInBtn.innerHTML = '<i class="fa-solid fa-fingerprint text-2xl"></i> أثبت حضوري الآن';
            
            const msg = err.response?.data?.error || 'حدث خطأ غير متوقع';
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: msg
            });
        }
    });

    loadAttendance();
});
