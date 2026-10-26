let dashboardChart = null;

async function loadDashboard() {
    const siteGrid = document.getElementById('site-grid');

    const user = getCurrentUser();
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const roleLabel = user.role === 'admin' ? 'Admin' : 'Officer';
    document.getElementById('welcome-message').textContent = `${timeGreeting}, ${roleLabel}! Welcome back. Your central portal for water quality monitoring and site diagnostics is ready.`;

    let sites, openAlerts;
    try {
        sites = await apiGet('/sites');
        // Acknowledged alerts are still unresolved, so they keep a site red or amber
        openAlerts = await apiGet('/alerts?status=active,acknowledged');
    } catch (err) {
        siteGrid.innerHTML = '<p>Could not reach the backend.</p>';
        console.error(err);
        return;
    }

    const alertsBySite = {};
    openAlerts.forEach(a => {
        if (!alertsBySite[a.site_id]) alertsBySite[a.site_id] = [];
        alertsBySite[a.site_id].push(a);
    });

    function worstSeverity(siteId) {
        const alerts = alertsBySite[siteId] || [];
        if (alerts.some(a => a.severity === 'critical')) return 'critical';
        if (alerts.some(a => a.severity === 'warning')) return 'warning';
        return 'safe';
    }

    // The first acknowledged alert on a site, or null if nobody has claimed one
    function checkedBy(siteId) {
        const alerts = alertsBySite[siteId] || [];
        return alerts.find(a => a.status === 'acknowledged') || null;
    }

    // Stat row
    const statRow = document.getElementById('stat-row');
    const criticalCount = openAlerts.filter(a => a.severity === 'critical').length;
    const warningCount = openAlerts.filter(a => a.severity === 'warning').length;
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

    // Open-alerts-per-site bar chart
    const siteLabels = sites.map(s => s.name);
    const siteAlertCounts = sites.map(s => (alertsBySite[s.id] || []).length);

    if (dashboardChart) dashboardChart.destroy();
    dashboardChart = new Chart(document.getElementById('alerts-by-site-chart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: siteLabels,
            datasets: [{
                label: 'Open Alerts',
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
        const checker = checkedBy(site.id);
        return `
            <a href="site.html?id=${site.id}" class="site-card">
                <div class="site-card-top">
                    <h3>${site.name}</h3>
                    <span class="status-badge ${severity}">${severity}</span>
                </div>
                <p>${site.river_section || ''}</p>
                                <p class="officer-line">${site.assigned_officer_name ? MajiAvatar.html(site.assigned_officer_id, site.assigned_officer_avatar, 20) : ''}Officer: ${site.assigned_officer_name || 'Unassigned'}</p>
                ${checker ? `<p class="checking-line">${MajiAvatar.html(checker.acknowledged_by, checker.acknowledged_by_avatar, 20)} Being checked by ${checker.acknowledged_by_name || 'an officer'}</p>` : ''}
            </a>
        `;
    }).join('');

    // Recent Alerts panel
    const recentAlertsEl = document.getElementById('recent-alerts');
    const recentAlerts = openAlerts.slice(0, 5);

    if (recentAlerts.length === 0) {
        recentAlertsEl.innerHTML = `<p class="panel-empty">No open alerts right now.</p>`;
    } else {
        recentAlertsEl.innerHTML = recentAlerts.map(a => `
            <a href="site.html?id=${a.site_id}" class="activity-item">
                <div class="activity-icon ${a.severity}">
                    <i data-feather="${a.severity === 'critical' ? 'alert-triangle' : 'alert-circle'}"></i>
                </div>
                <div>
                    <div class="activity-title">${a.parameter_name} at ${a.site_name}</div>
                    <div class="activity-meta">${Number(a.triggered_value).toFixed(2)} ${a.unit} · ${new Date(a.created_at).toLocaleTimeString()}${a.status === 'acknowledged' ? ` · ${MajiAvatar.html(a.acknowledged_by, a.acknowledged_by_avatar, 16)} ${a.acknowledged_by_name || 'an officer'}` : ''}</div>
                </div>
            </a>
        `).join('');
    }

    // Field Officers panel (grouped by officer name, keeping id and avatar for the animal)
    const officersEl = document.getElementById('officers-list');
    const officerMap = {};
    sites.forEach(site => {
        const name = site.assigned_officer_name || 'Unassigned';
        if (!officerMap[name]) {
            officerMap[name] = {
                id: site.assigned_officer_id,
                avatar: site.assigned_officer_avatar,
                siteNames: []
            };
        }
        officerMap[name].siteNames.push(site.name);
    });

    officersEl.innerHTML = Object.entries(officerMap).map(([name, info]) => `
        <div class="officer-item">
            ${name === 'Unassigned'
                ? '<div class="officer-avatar">?</div>'
                : MajiAvatar.html(info.id, info.avatar, 36)}
            <div>
                <div class="officer-name">${name}</div>
                <div class="officer-sites">${info.siteNames.join(', ')}</div>
            </div>
        </div>
    `).join('');

    feather.replace();

    document.getElementById('last-updated').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
}

loadDashboard();
setInterval(loadDashboard, 30000);