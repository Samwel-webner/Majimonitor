let viewYear, viewMonth;
let trendChart = null;

async function loadTrendChart() {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    let trend;
    try {
        trend = await apiGet(`/alerts/trend?from=${from.toISOString()}&to=${to.toISOString()}`);
    } catch (err) {
        console.error(err);
        return;
    }

    const labels = trend.map(t => t.date);
    const criticalData = trend.map(t => t.critical);
    const warningData = trend.map(t => t.warning);

    if (trendChart) trendChart.destroy();
    trendChart = new Chart(document.getElementById('trend-chart').getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Critical', data: criticalData, borderColor: '#A63D3D', backgroundColor: 'rgba(166,61,61,0.1)', tension: 0.25, fill: true },
                { label: 'Warning', data: warningData, borderColor: '#A8792A', backgroundColor: 'rgba(168,121,42,0.1)', tension: 0.25, fill: true }
            ]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function renderCalendar() {
    const today = new Date();
    if (viewYear === undefined) {
        viewYear = today.getFullYear();
        viewMonth = today.getMonth();
    }

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    document.getElementById('calendar-month-label').textContent = `${monthNames[viewMonth]} ${viewYear}`;

    const firstDay = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const dayLabels = ['S','M','T','W','T','F','S'];
    let html = dayLabels.map(d => `<div class="calendar-day-label">${d}</div>`).join('');

    for (let i = 0; i < startWeekday; i++) {
        html += `<div class="calendar-day empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === today.toISOString().split('T')[0];
        html += `<div class="calendar-day ${isToday ? 'today' : ''}" data-date="${dateStr}">${day}</div>`;
    }

    document.getElementById('calendar-grid').innerHTML = html;

    document.querySelectorAll('.calendar-day[data-date]').forEach(el => {
        el.addEventListener('click', () => loadDayDetails(el.dataset.date, el));
    });

    feather.replace();
}

async function loadDayDetails(dateStr, clickedEl) {
    document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
    if (clickedEl) clickedEl.classList.add('selected');

    document.getElementById('selected-day-label').textContent = new Date(dateStr).toDateString();
    const detailsEl = document.getElementById('day-details');
    detailsEl.innerHTML = '<p class="panel-empty">Loading...</p>';

    let alerts;
    try {
        alerts = await apiGet(`/alerts/by-date?date=${dateStr}`);
    } catch (err) {
        detailsEl.innerHTML = '<p class="panel-empty">Could not load data for this day.</p>';
        console.error(err);
        return;
    }

    if (alerts.length === 0) {
        detailsEl.innerHTML = '<p class="panel-empty">No alerts were recorded on this day.</p>';
        return;
    }

    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const warningCount = alerts.filter(a => a.severity === 'warning').length;

    detailsEl.innerHTML = `
        <p style="margin-bottom:14px;"><strong>${alerts.length}</strong> total alerts &middot; ${criticalCount} critical &middot; ${warningCount} warning</p>
        ${alerts.map(a => `
            <div class="activity-item">
                <div class="activity-icon ${a.severity}">
                    <i data-feather="${a.severity === 'critical' ? 'alert-triangle' : 'alert-circle'}"></i>
                </div>
                <div>
                    <div class="activity-title">${a.parameter_name} at ${a.site_name}</div>
                    <div class="activity-meta">${Number(a.triggered_value).toFixed(2)} ${a.unit} · ${new Date(a.created_at).toLocaleTimeString()} · ${a.status}</div>
                </div>
            </div>
        `).join('')}
    `;

    feather.replace();
}

document.getElementById('prev-month-btn').addEventListener('click', () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    renderCalendar();
});

document.getElementById('next-month-btn').addEventListener('click', () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    renderCalendar();
});

loadTrendChart();
renderCalendar();