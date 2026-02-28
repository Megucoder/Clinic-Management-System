document.addEventListener('DOMContentLoaded', () => {
    // Set current year
    document.getElementById('currentYear').textContent = new Date().getFullYear();

    const dateInput = document.getElementById('appointmentDate');
    const timeSlotsContainer = document.getElementById('timeSlotsContainer');
    const slotsGrid = document.getElementById('slotsGrid');
    const loadingSlots = document.getElementById('loadingSlots');
    const noSlotsMsg = document.getElementById('noSlotsMsg');
    const selectedTimeInput = document.getElementById('selectedTime');
    const bookingForm = document.getElementById('bookingForm');
    const submitBtn = document.getElementById('submitBtn');

    // Initialize Flatpickr for the date input
    flatpickr(dateInput, {
        locale: "ar",
        minDate: "today",
        disable: [
            function (date) {
                // Disable weekends (Friday = 5, Saturday = 6)
                return (date.getDay() === 5 || date.getDay() === 6);
            }
        ],
        onChange: function (selectedDates, dateStr, instance) {
            if (dateStr) {
                fetchAvailableSlots(dateStr);
            }
        }
    });

    async function fetchAvailableSlots(date) {
        // Reset state
        timeSlotsContainer.classList.remove('hidden');
        slotsGrid.innerHTML = '';
        selectedTimeInput.value = '';
        loadingSlots.classList.remove('hidden');
        noSlotsMsg.classList.add('hidden');

        try {
            const response = await axios.get(`/api/available-slots?date=${date}`);
            const slots = response.data;

            loadingSlots.classList.add('hidden');

            if (slots.length === 0) {
                noSlotsMsg.classList.remove('hidden');
            } else {
                renderSlots(slots);
            }
        } catch (error) {
            console.error('Error fetching slots:', error);
            loadingSlots.classList.add('hidden');
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: 'حدث خطأ أثناء جلب المواعيد المتاحة.',
                confirmButtonText: 'حسناً',
                confirmButtonColor: '#2563eb'
            });
        }
    }

    function renderSlots(slots) {
        slotsGrid.innerHTML = '';
        slots.forEach(time => {
            const btn = document.createElement('button');
            btn.type = 'button';
            // Convert 24hr format to 12hr format for display
            const [hourStr, minStr] = time.split(':');
            let hour = parseInt(hourStr, 10);
            const ampm = hour >= 12 ? 'م' : 'ص';
            hour = hour % 12;
            hour = hour ? hour : 12; // the hour '0' should be '12'
            const displayTime = `${hour}:${minStr} ${ampm}`;

            btn.className = 'slot-btn py-2 px-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 bg-gray-50 hover:bg-white hover:border-blue-500 hover:text-blue-600 focus:outline-none';
            btn.textContent = displayTime;
            btn.dataset.time = time;

            btn.addEventListener('click', () => {
                // Remove selected class from all
                document.querySelectorAll('.slot-btn').forEach(b => {
                    b.classList.remove('slot-selected');
                });
                // Add to clicked
                btn.classList.add('slot-selected');
                selectedTimeInput.value = time;
            });

            slotsGrid.appendChild(btn);
        });
    }

    // Auto-fill logic when phone number loses focus (Patient Persistence)
    const patientPhoneInput = document.getElementById('patientPhone');
    const patientNameInput = document.getElementById('patientName');
    const appointmentNotesInput = document.getElementById('appointmentNotes');

    patientPhoneInput.addEventListener('blur', async () => {
        const phone = patientPhoneInput.value;
        const phoneRegex = /^[0-9+() -]{9,15}$/;

        // Only fetch if it looks like a valid phone and name is empty
        if (phoneRegex.test(phone) && !patientNameInput.value) {
            try {
                const response = await axios.get(`/api/patient/info?phone=${encodeURIComponent(phone)}`);
                if (response.data) {
                    patientNameInput.value = response.data.name;
                    if (response.data.notes) {
                        appointmentNotesInput.value = response.data.notes;
                    }

                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'info',
                        title: 'أهلاً بك مجدداً! تم جلب بياناتك تلقائياً.',
                        showConfirmButton: false,
                        timer: 3000
                    });
                }
            } catch (error) {
                // Ignore errors (new patient or network issue)
            }
        }
    });

    // Form submission
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validation
        const phone = patientPhoneInput.value;
        const time = selectedTimeInput.value;

        if (!time) {
            Swal.fire({
                icon: 'warning',
                title: 'تنبيه',
                text: 'الرجاء اختيار وقت الموعد',
                confirmButtonText: 'حسناً',
                confirmButtonColor: '#2563eb'
            });
            return;
        }

        // Basic phone validation (just checking if it has digits)
        const phoneRegex = /^[0-9+() -]{9,15}$/;
        if (!phoneRegex.test(phone)) {
            Swal.fire({
                icon: 'warning',
                title: 'تنبيه',
                text: 'الرجاء إدخال رقم هاتف صحيح',
                confirmButtonText: 'حسناً',
                confirmButtonColor: '#2563eb'
            });
            return;
        }

        const data = {
            patient_name: patientNameInput.value,
            phone: phone,
            type: document.getElementById('appointmentType').value,
            date: dateInput.value,
            time: time,
            notes: appointmentNotesInput.value
        };

        // Disable button to prevent double submission
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحجز...';

        try {
            const response = await axios.post('/api/appointments', data);

            if (response.data.id) {
                // Success
                Swal.fire({
                    icon: 'success',
                    title: 'تم الحجز بنجاح!',
                    html: `
                        <p>شكراً لك <b>${data.patient_name}</b>.</p>
                        <p>تم تأكيد حجزك يوم <b>${data.date}</b> الساعة <b>${document.querySelector('.slot-selected').textContent}</b>.</p>
                        <hr style="margin: 15px 0; border-color: #e5e7eb;">
                        <p style="font-size: 0.875rem; color: #4b5563;">
                            يمكنك إدارة مواعيدك وملفك الشخصي عبر <a href="/patient-portal.html" style="color: #2563eb; font-weight: bold; text-decoration: underline;">بوابة المريض</a>.
                        </p>
                    `,
                    confirmButtonText: 'حسناً',
                    confirmButtonColor: '#2563eb'
                }).then(() => {
                    // Reset form and reload slots
                    bookingForm.reset();
                    selectedTimeInput.value = '';
                    timeSlotsContainer.classList.add('hidden');
                });
            }
        } catch (error) {
            console.error('Booking error:', error);
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: 'حدث خطأ أثناء تأكيد الحجز، الرجاء المحاولة مرة أخرى.',
                confirmButtonText: 'حسناً',
                confirmButtonColor: '#2563eb'
            });
        } finally {
            // Re-enable button
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>تأكيد الحجز</span><i class="fa-solid fa-arrow-left"></i>';
        }
    });
});
