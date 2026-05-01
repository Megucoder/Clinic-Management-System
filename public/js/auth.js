(function () {
    const isDoctor = localStorage.getItem('doctor_session') === 'true';
    const isReceptionist = localStorage.getItem('role') === 'receptionist';
    const path = window.location.pathname;

    // List of pages that require Doctor authentication
    const doctorOnlyPages = ['/doctor/'];

    // Pages for receptionist only 
    const receptionistOnlyPages = ['/receptionist/'];

    if (doctorOnlyPages.some(p => path.startsWith(p)) && !isDoctor) {
        window.location.href = '/login.html';
    }

    // Only redirect from receptionist page if neither receptionist nor doctor
    if (receptionistOnlyPages.some(p => path.startsWith(p)) && !isReceptionist && !isDoctor) {
        window.location.href = '/';
    }

    // Auto-redirect authenticated users away from public landing/login pages
    const isPublicLanding = path === '/' || path === '/index.html' || path === '/login.html';
    if (isPublicLanding) {
        const userRole = localStorage.getItem('role');
        if (isDoctor) {
            window.location.href = '/doctor/appointments.html';
            return; // Stop execution
        } else if (isReceptionist) {
            window.location.href = '/receptionist/dashboard.html';
            return;
        } else if (userRole && userRole !== 'patient') {
            window.location.href = '/staff-attendance.html';
            return;
        }
    }

    // Global Logout Function
    window.logoutUser = function () {
        localStorage.removeItem('doctor_session');
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        window.location.href = '/';
    };
})();
