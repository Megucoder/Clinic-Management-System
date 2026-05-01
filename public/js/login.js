document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const submitBtn = document.getElementById('submitBtn');
    const errorMessage = document.getElementById('errorMessage');

    // UI Reset
    errorMessage.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الدخول...';

    try {
        const response = await axios.post('/api/login', { username, password });

        if (response.data.success) {
            const role = response.data.user.role;
            // Save session
            if (role === 'doctor') {
                localStorage.setItem('doctor_session', 'true');
            }
            localStorage.setItem('role', role);
            localStorage.setItem('username', response.data.user.username);
            localStorage.setItem('token', response.data.token);

            // Redirect based on role
            if (role === 'doctor') {
                window.location.href = '/doctor/appointments.html';
            } else if (role === 'receptionist') {
                window.location.href = '/receptionist/dashboard.html';
            } else {
                window.location.href = '/staff-attendance.html';
            }
        }
    } catch (err) {
        errorMessage.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'دخول <i class="fa-solid fa-arrow-left"></i>';
    }
});
