document.addEventListener('DOMContentLoaded', () => {
  // 1. Password Visibility Toggle
  const toggleButtons = document.querySelectorAll('.password-toggle');
  toggleButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-target');
      const passwordInput = document.getElementById(targetId);
      if (passwordInput) {
        if (passwordInput.type === 'password') {
          passwordInput.type = 'text';
          button.classList.remove('fa-eye');
          button.classList.add('fa-eye-slash');
        } else {
          passwordInput.type = 'password';
          button.classList.remove('fa-eye-slash');
          button.classList.add('fa-eye');
        }
      }
    });
  });

  // 2. Alert Dismissal Animation
  const closeAlertButtons = document.querySelectorAll('.alert-close');
  closeAlertButtons.forEach(button => {
    button.addEventListener('click', () => {
      const alert = button.closest('.alert');
      if (alert) {
        alert.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        alert.style.opacity = '0';
        alert.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          alert.remove();
        }, 300);
      }
    });
  });

  // Automatically close flash alerts after 5 seconds
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      alert.style.opacity = '0';
      alert.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        alert.remove();
      }, 500);
    }, 5000);
  });

  // 3. Password Strength Checker (only on registration page)
  const passwordInput = document.getElementById('password');
  const strengthBars = document.querySelectorAll('.strength-bar');
  const strengthText = document.querySelector('.strength-text');
  
  if (passwordInput && strengthBars.length > 0) {
    passwordInput.addEventListener('input', () => {
      const val = passwordInput.value;
      let score = 0;
      
      if (val.length >= 8) score++;
      if (/[A-Z]/.test(val)) score++;
      if (/[0-9]/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;
      
      // Reset strength bars
      strengthBars.forEach(bar => {
        bar.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      });
      
      let label = 'Strength: Weak';
      let color = '#ef4444'; // Red
      
      if (val.length === 0) {
        label = 'Strength: ';
        color = 'var(--text-muted)';
      } else if (score === 1) {
        strengthBars[0].style.backgroundColor = '#ef4444';
        label = 'Strength: Very Weak';
        color = '#ef4444';
      } else if (score === 2) {
        strengthBars[0].style.backgroundColor = '#f59e0b';
        strengthBars[1].style.backgroundColor = '#f59e0b';
        label = 'Strength: Fair';
        color = '#f59e0b';
      } else if (score === 3) {
        strengthBars[0].style.backgroundColor = '#3b82f6';
        strengthBars[1].style.backgroundColor = '#3b82f6';
        strengthBars[2].style.backgroundColor = '#3b82f6';
        label = 'Strength: Good';
        color = '#3b82f6';
      } else if (score === 4) {
        strengthBars.forEach(bar => bar.style.backgroundColor = '#10b981');
        label = 'Strength: Strong';
        color = '#10b981';
      }
      
      if (strengthText) {
        strengthText.textContent = label;
        strengthText.style.color = color;
      }
    });
  }

  // 4. Telemetry Forms Auto-Save Drafts
  const telemetryForms = [
    { id: 'power-readings-form', key: 'draft_power_readings' },
    { id: 'water-readings-form', key: 'draft_water_readings' }
  ];

  telemetryForms.forEach(config => {
    const form = document.getElementById(config.id);
    if (!form) return;

    const todayDate = form.getAttribute('data-date') || '';
    const storageKey = config.key + '_' + todayDate;

    // Check if the form is locked (saved for today)
    const isLocked = form.getAttribute('data-locked') === 'true';
    if (isLocked) {
      form.querySelectorAll('input').forEach(input => {
        input.disabled = true;
      });
    }

    // Clean up older keys for this form
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(config.key) && key !== storageKey) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.error('Failed to clean up old telemetry drafts:', e);
    }

    // Load draft values and restore inputs if drafts exist
    try {
      const draft = JSON.parse(localStorage.getItem(storageKey));
      if (draft) {
        Object.keys(draft).forEach(name => {
          const input = form.querySelector(`[name="${name}"]`);
          if (input && draft[name] !== undefined) {
            input.value = draft[name];
          }
        });
      }
    } catch (e) {
      console.error('Failed to load telemetry drafts:', e);
    }

    // Save draft on input
    form.addEventListener('input', () => {
      const formData = {};
      const inputs = form.querySelectorAll('input.table-input');
      inputs.forEach(input => {
        if (input.name) {
          formData[input.name] = input.value;
        }
      });
      localStorage.setItem(storageKey, JSON.stringify(formData));
    });

    // Clear draft on submit
    form.addEventListener('submit', () => {
      localStorage.removeItem(storageKey);
    });
  });
});
