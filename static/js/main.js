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
    { id: 'water-readings-form', key: 'draft_water_readings' },
    { id: 'genset-checklist-form', key: 'draft_genset_checklist' }
  ];

  telemetryForms.forEach(config => {
    const form = document.getElementById(config.id);
    if (!form) return;

    const todayDate = form.getAttribute('data-date') || '';
    const storageKey = config.key + '_' + todayDate;

    // Check if the form is locked (saved for today)
    const isLocked = form.getAttribute('data-locked') === 'true';
    if (isLocked) {
      form.querySelectorAll('input, select').forEach(input => {
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
            if (input.type === 'checkbox') {
              input.checked = draft[name] === true;
            } else {
              input.value = draft[name];
            }
          }
        });
      }
    } catch (e) {
      console.error('Failed to load telemetry drafts:', e);
    }

    // Save draft on input
    form.addEventListener('change', () => {
      const formData = {};
      const inputs = form.querySelectorAll('.table-input');
      inputs.forEach(input => {
        if (input.name) {
          if (input.type === 'checkbox') {
            formData[input.name] = input.checked;
          } else {
            formData[input.name] = input.value;
          }
        }
      });
      localStorage.setItem(storageKey, JSON.stringify(formData));
    });
    form.addEventListener('input', () => {
      const formData = {};
      const inputs = form.querySelectorAll('.table-input');
      inputs.forEach(input => {
        if (input.name) {
          if (input.type === 'checkbox') {
            formData[input.name] = input.checked;
          } else {
            formData[input.name] = input.value;
          }
        }
      });
      localStorage.setItem(storageKey, JSON.stringify(formData));
    });

    // Clear draft on submit
    form.addEventListener('submit', () => {
      localStorage.removeItem(storageKey);
    });
  });

  // 5. Live Clock Update Routine
  const timeEl = document.getElementById('current-time');
  if (timeEl) {
    const updateClock = () => {
      const now = new Date();
      const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      timeEl.textContent = now.toLocaleString('en-US', options);
    };
    updateClock();
    setInterval(updateClock, 1000);
  }

  // 6. Online Document Viewer Modal Window
  const btnViewDocs = document.querySelectorAll('.btn-view-doc');
  const modalViewer = document.getElementById('modal-viewer');
  const btnCloseViewer = document.getElementById('btn-close-viewer');
  const viewerTitle = document.getElementById('viewer-title');
  const viewerContent = document.getElementById('viewer-content');

  if (modalViewer && btnCloseViewer && btnViewDocs.length > 0) {
    // Helper to format values
    const formatCell = (val, pf) => {
      if (val === undefined && pf === undefined) return '-';
      if (!val && !pf) return '-';
      if (pf !== undefined) {
        return `${val || '-'} / ${pf || '-'}`;
      }
      return val || '-';
    };

    btnViewDocs.forEach(btn => {
      btn.addEventListener('click', async () => {
        const type = btn.getAttribute('data-type');
        
        // Show loader
        viewerContent.innerHTML = `
          <div id="viewer-loader" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; color: var(--text-secondary); gap: 12px;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 28px; color: var(--color-primary);"></i>
            <span>Loading telemetry data...</span>
          </div>
        `;
        
        // Set title
        if (type === 'power') {
          viewerTitle.innerHTML = '<i class="fa-solid fa-bolt" style="color: var(--color-warning);"></i> Power House Telemetry - Monthly View';
        } else if (type === 'water') {
          viewerTitle.innerHTML = '<i class="fa-solid fa-droplet" style="color: var(--color-info);"></i> Water Valves Telemetry - Monthly View';
        } else {
          viewerTitle.innerHTML = '<i class="fa-solid fa-charging-station" style="color: var(--color-warning);"></i> Genset Checklist - Monthly View';
        }
        
        // Open modal
        modalViewer.style.display = 'flex';
        
        try {
          const res = await fetch(`/api/readings/${type}`);
          const resJson = await res.json();
          
          if (resJson.status === 'success') {
            const dataList = resJson.data || [];
            const monthYearDisplay = resJson.month_year || '';
            
            // Set header label
            if (type === 'power') {
              viewerTitle.innerHTML = `<i class="fa-solid fa-bolt" style="color: var(--color-warning);"></i> Power House Telemetry - ${monthYearDisplay}`;
            } else if (type === 'water') {
              viewerTitle.innerHTML = `<i class="fa-solid fa-droplet" style="color: var(--color-info);"></i> Water Valves Telemetry - ${monthYearDisplay}`;
            } else {
              viewerTitle.innerHTML = `<i class="fa-solid fa-charging-station" style="color: var(--color-warning);"></i> Genset Checklist - ${monthYearDisplay}`;
            }
            
            // Compute days of current month
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            let html = '';
            
            if (type === 'power') {
              // Build Power House 1 Table
              html += `<div style="padding: 16px;"><h3 style="font-size: 15px; margin-bottom: 12px; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; border-left: 3px solid var(--color-primary); padding-left: 8px;">Power House 1</h3></div>`;
              html += `<table class="viewer-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Solar 75 (kW/PF)</th>
                    <th>Solar 33 (kW/PF)</th>
                    <th>Line Import (kW/PF)</th>
                    <th>Line Export (kW/PF)</th>
                    <th>Weld Import (kW/PF)</th>
                    <th>Weld Export (kW/PF)</th>
                  </tr>
                </thead>
                <tbody>`;
              
              for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const entry = dataList.find(e => e.date === dateStr);
                const val = entry ? entry.data : {};
                const dateObj = new Date(year, month, d);
                const isSunday = dateObj.getDay() === 0;
                const rowClass = isSunday ? 'class="sunday-row"' : '';
                
                html += `<tr ${rowClass}>
                  <td style="font-weight: 600;">${dateStr}</td>
                  <td>${formatCell(val.ph1_solar_75, val.ph1_solar_75_pf)}</td>
                  <td>${formatCell(val.ph1_solar_33, val.ph1_solar_33_pf)}</td>
                  <td>${formatCell(val.ph1_line_import, val.ph1_line_import_pf)}</td>
                  <td>${formatCell(val.ph1_line_export, val.ph1_line_export_pf)}</td>
                  <td>${formatCell(val.ph1_weld_import, val.ph1_weld_import_pf)}</td>
                  <td>${formatCell(val.ph1_weld_export, val.ph1_weld_export_pf)}</td>
                </tr>`;
              }
              html += `</tbody></table>`;
              
              // Build Power House 2 Table
              html += `<div style="padding: 24px 16px 16px 16px;"><h3 style="font-size: 15px; margin-bottom: 12px; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; border-left: 3px solid #ec4899; padding-left: 8px;">Power House 2</h3></div>`;
              html += `<table class="viewer-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Solar 90 (kW/PF)</th>
                    <th>Line Import (kW/PF)</th>
                    <th>Line Export (kW/PF)</th>
                    <th>Weld Import (kW/PF)</th>
                    <th>Weld Export (kW/PF)</th>
                  </tr>
                </thead>
                <tbody>`;
              
              for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const entry = dataList.find(e => e.date === dateStr);
                const val = entry ? entry.data : {};
                const dateObj = new Date(year, month, d);
                const isSunday = dateObj.getDay() === 0;
                const rowClass = isSunday ? 'class="sunday-row"' : '';
                
                html += `<tr ${rowClass}>
                  <td style="font-weight: 600;">${dateStr}</td>
                  <td>${formatCell(val.ph2_solar_90, val.ph2_solar_90_pf)}</td>
                  <td>${formatCell(val.ph2_line_import, val.ph2_line_import_pf)}</td>
                  <td>${formatCell(val.ph2_line_export, val.ph2_line_export_pf)}</td>
                  <td>${formatCell(val.ph2_weld_import, val.ph2_weld_import_pf)}</td>
                  <td>${formatCell(val.ph2_weld_export, val.ph2_weld_export_pf)}</td>
                </tr>`;
              }
              html += `</tbody></table>`;
            } else if (type === 'water') {
              // Build Water Valves Table
              html += `<table class="viewer-table">
                <thead>
                  <tr>
                    <th>Date</th>`;
              for (let i = 1; i <= 16; i++) {
                html += `<th>V${i}</th>`;
              }
              html += `</tr></thead><tbody>`;
              
              for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const entry = dataList.find(e => e.date === dateStr);
                const val = entry ? entry.data : {};
                const dateObj = new Date(year, month, d);
                const isSunday = dateObj.getDay() === 0;
                const rowClass = isSunday ? 'class="sunday-row"' : '';
                
                html += `<tr ${rowClass}>
                  <td style="font-weight: 600; min-width: 100px;">${dateStr}</td>`;
                for (let i = 1; i <= 16; i++) {
                  html += `<td>${val[`valve_${i}`] || '-'}</td>`;
                }
                html += `</tr>`;
              }
              html += `</tbody></table>`;
            } else {
              // Build Genset 1 Table
              html += `<div style="padding: 16px;"><h3 style="font-size: 15px; margin-bottom: 12px; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; border-left: 3px solid var(--color-warning); padding-left: 8px;">Generator Set 1</h3></div>`;
              html += `<div style="overflow-x: auto; width: 100%;"><table class="viewer-table">
                <thead>
                  <tr>
                    <th>Date</th>`;
              for (let i = 1; i <= 22; i++) {
                html += `<th title="Question ${i}">Q${i}</th>`;
              }
              html += `</tr>
                </thead>
                <tbody>`;
              
              for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const entry = dataList.find(e => e.date === dateStr);
                const val = entry ? entry.data : {};
                const dateObj = new Date(year, month, d);
                const isSunday = dateObj.getDay() === 0;
                const rowClass = isSunday ? 'class="sunday-row"' : '';
                
                html += `<tr ${rowClass}>
                  <td style="font-weight: 600; min-width: 100px;">${dateStr}</td>`;
                for (let i = 1; i <= 22; i++) {
                  const checkVal = val[`g1_q${i}`] || '-';
                  const displaySymbol = checkVal === 'OK' ? '<span style="color: var(--color-success); font-weight: bold;">✔</span>' : '-';
                  html += `<td style="text-align: center;">${displaySymbol}</td>`;
                }
                html += `</tr>`;
              }
              html += `</tbody></table></div>`;

              // Build Genset 2 Table
              html += `<div style="padding: 24px 16px 16px 16px;"><h3 style="font-size: 15px; margin-bottom: 12px; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; border-left: 3px solid #ec4899; padding-left: 8px;">Generator Set 2</h3></div>`;
              html += `<div style="overflow-x: auto; width: 100%;"><table class="viewer-table">
                <thead>
                  <tr>
                    <th>Date</th>`;
              for (let i = 1; i <= 22; i++) {
                html += `<th title="Question ${i}">Q${i}</th>`;
              }
              html += `</tr>
                </thead>
                <tbody>`;
              
              for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const entry = dataList.find(e => e.date === dateStr);
                const val = entry ? entry.data : {};
                const dateObj = new Date(year, month, d);
                const isSunday = dateObj.getDay() === 0;
                const rowClass = isSunday ? 'class="sunday-row"' : '';
                
                html += `<tr ${rowClass}>
                  <td style="font-weight: 600; min-width: 100px;">${dateStr}</td>`;
                for (let i = 1; i <= 22; i++) {
                  const checkVal = val[`g2_q${i}`] || '-';
                  const displaySymbol = checkVal === 'OK' ? '<span style="color: var(--color-success); font-weight: bold;">✔</span>' : '-';
                  html += `<td style="text-align: center;">${displaySymbol}</td>`;
                }
                html += `</tr>`;
              }
              html += `</tbody></table></div>`;
            }
            
            viewerContent.innerHTML = html;
          } else {
            viewerContent.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--color-danger);"><i class="fa-solid fa-triangle-exclamation"></i> Failed to retrieve telemetry records.</div>`;
          }
        } catch (err) {
          viewerContent.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--color-danger);"><i class="fa-solid fa-triangle-exclamation"></i> Error loading data: ${err.message}</div>`;
        }
      });
    });

    // Close Viewer Modal
    const closeViewer = () => {
      modalViewer.style.display = 'none';
      viewerContent.innerHTML = '';
    };
    
    btnCloseViewer.addEventListener('click', closeViewer);
    window.addEventListener('click', (e) => {
      if (e.target === modalViewer) {
        closeViewer();
      }
    });
  }
});
