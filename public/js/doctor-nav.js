(function() {
    const path = window.location.pathname;
    
    const navItems = [
        { name: 'سجل المرضى', url: '/doctor/records.html', id: 'records' },
        { name: 'إدارة المواعيد', url: '/doctor/appointments.html', id: 'appointments' },
        { name: 'المالية والمداخيل', url: '/doctor/finances.html', id: 'finances' },
        { name: 'إدارة المخزون', url: '/doctor/inventory.html', id: 'inventory' },
        { name: 'العمال والرواتب', url: '/doctor/payroll.html', id: 'payroll' }
    ];

    const generateNav = () => {
        return navItems.map(item => {
            const isActive = path.includes(item.url);
            const activeClass = isActive ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-500 hover:text-blue-600';
            return `<a href="${item.url}" class="${activeClass} px-3 py-2 rounded-md font-medium transition">${item.name}</a>`;
        }).join('');
    };

    // Find if there's any extra button needed (like "Back" or "New Booking")
    let extraButtons = '';
    if (path.includes('appointments.html')) {
        extraButtons = `
            <a href="/book.html" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2">
                <i class="fa-solid fa-plus"></i> حجز جديد
            </a>
        `;
    } else if (path.includes('patient.html')) {
        extraButtons = `
            <a href="/doctor/appointments.html" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition flex items-center gap-2">
                <i class="fa-solid fa-arrow-right"></i> رجوع
            </a>
        `;
    }

    const headerHTML = `
    <header class="bg-white shadow-sm sticky top-0 z-50 print:hidden">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center gap-4 md:gap-8">
                    <a href="javascript:void(0)" onclick="window.goHome()" class="flex items-center gap-2 text-xl font-bold text-blue-600 shrink-0">
                        <i class="fa-solid fa-notes-medical text-2xl"></i> عيادتي
                    </a>
                    <nav class="hidden md:flex space-x-2 space-x-reverse lg:space-x-4">
                        ${generateNav()}
                    </nav>
                </div>
                <div class="flex items-center gap-2 md:gap-4">
                    <button onclick="window.logoutUser()" class="text-gray-500 hover:text-red-600 text-sm font-medium transition flex items-center gap-1 px-2 py-1">
                        <i class="fa-solid fa-right-from-bracket"></i> <span class="hidden sm:inline">تسجيل الخروج</span>
                    </button>
                    ${extraButtons}
                </div>
            </div>
        </div>
        <!-- Mobile Nav Menu (Simplified) -->
        <div class="md:hidden border-t border-gray-100 overflow-x-auto whitespace-nowrap px-4 py-2 bg-gray-50 flex gap-2 no-scrollbar">
             ${generateNav()}
        </div>
    </header>
    `;

    window.goHome = () => {
        const isDoctor = localStorage.getItem('doctor_session') === 'true';
        const isReceptionist = localStorage.getItem('role') === 'receptionist';
        const userRole = localStorage.getItem('role');

        if (isDoctor) {
            window.location.href = '/doctor/appointments.html';
        } else if (isReceptionist) {
            window.location.href = '/receptionist/dashboard.html';
        } else if (userRole && userRole !== 'patient') {
            window.location.href = '/staff-attendance.html';
        } else {
            window.location.href = '/';
        }
    };

    document.body.insertAdjacentHTML('afterbegin', headerHTML);
})();
