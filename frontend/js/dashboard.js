let dashboardChart = null;

async function loadDashboard() {
    const siteGrid = document.getElementById('site-grid');

    const user = getCurrentUser();
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const roleLabel = user.role === 'admin' ? 'Admin' : 'Officer';
document.getElementById('welcome-message').textContent = `${timeGreeting}, ${roleLabel}! Welcome back. Your central portal for water quality monitoring and site diagnostics is ready.`;
    let sites, activeAlerts;
    try {
        sites = await apiGet('/sites');
        activeAlerts = await apiGet('/alerts?status=active');
    } catch (err) {
        siteGrid.innerHTML = '<p>Could not reach the backend.</p>';
        console.error(err);
        return;
    }

    const alertsBySite = {};
    activeAlerts.forEach(a => {
        if (!alertsBySite[a.site_id]) alertsBySite[a.site_id] = [];
        alertsBySite[a.site_id].push(a);
    });

    function worstSeverity(siteId) {
        const alerts = alertsBySite[siteId] || [];
        if (alerts.some(a => a.severity === 'critical')) return 'critical';
        if (alerts.some(a => a.severity === 'warning')) return 'warning';
        return 'safe';
    }

    // Stat row
    const statRow = document.getElementById('stat-row');
    const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length;
    const warningCount = activeAlerts.filter(a => a.severity === 'warning').length;
    const safeCount = sites.filter(s => worstSeverity(s.id) === 'safe').length;

    statRow.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon safe"><i data-feather="check-circle"></i></div>
            <div>
                <div class="stat-value">${safeCount}</div>
                <div class="stat-label">Sites Nominal</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon warning"><i data-feather="alert-circle"></i></div>
            <div>
                <div class="stat-value">${warningCount}</div>
                <div class="stat-label">Warning Alerts</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon critical"><i data-feather="alert-triangle"></i></div>
            <div>
                <div class="stat-value">${criticalCount}</div>
                <div class="stat-label">Critical Alerts</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon total"><i data-feather="map-pin"></i></div>
            <div>
                <div class="stat-value">${sites.length}</div>
                <div class="stat-label">Total Sites</div>
            </div>
        </div>
    `;

    // Alerts-per-site bar chart
    const siteLabels = sites.map(s => s.name);
    const siteAlertCounts = sites.map(s => (alertsBySite[s.id] || []).length);

    if (dashboardChart) dashboardChart.destroy();
    dashboardChart = new Chart(document.getElementById('alerts-by-site-chart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: siteLabels,
            datasets: [{
                label: 'Active Alerts',
                data: siteAlertCounts,
                backgroundColor: '#2F5D62',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });

    // Site grid
    siteGrid.innerHTML = sites.map(site => {
        const severity = worstSeverity(site.id);
        return `
            <a href="site.html?id=${site.id}" class="site-card">
                <div class="site-card-top">
                    <h3>${site.name}</h3>
                    <span class="status-badge ${severity}">${severity}</span>
                </div>
                <p>${site.river_section || ''}</p>
                <p>Officer: ${site.assigned_officer_name || 'Unassigned'}</p>
            </a>
        `;
    }).join('');

    // Recent Alerts panel
    const recentAlertsEl = document.getElementById('recent-alerts');
    const recentAlerts = activeAlerts.slice(0, 5);

    if (recentAlerts.length === 0) {
        recentAlertsEl.innerHTML = `<p class="panel-empty">No active alerts right now.</p>`;
    } else {
        recentAlertsEl.innerHTML = recentAlerts.map(a => `
            <a href="site.html?id=${a.site_id}" class="activity-item">
                <div class="activity-icon ${a.severity}">
                    <i data-feather="${a.severity === 'critical' ? 'alert-triangle' : 'alert-circle'}"></i>
                </div>
                <div>
                    <div class="activity-title">${a.parameter_name} at ${a.site_name}</div>
                    <div class="activity-meta">${Number(a.triggered_value).toFixed(2)} ${a.unit} · ${new Date(a.created_at).toLocaleTimeString()}</div>
                </div>
            </a>
        `).join('');
    }

    // Field Officers panel
    const officersEl = document.getElementById('officers-list');
    const officerMap = {};
    sites.forEach(site => {
        const name = site.assigned_officer_name || 'Unassigned';
        if (!officerMap[name]) officerMap[name] = [];
        officerMap[name].push(site.name);
    });

    officersEl.innerHTML = Object.entries(officerMap).map(([name, siteNames]) => `
        <div class="officer-item">
            <div class="officer-avatar">${name === 'Unassigned' ? '?' : name.split(' ').map(w => w[0]).slice(0,2).join('')}</div>
            <div>
                <div class="officer-name">${name}</div>
                <div class="officer-sites">${siteNames.join(', ')}</div>
            </div>
        </div>
    `).join('');

    feather.replace();

    document.getElementById('last-updated').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
}

loadDashboard();
setInterval(loadDashboard, 30000);