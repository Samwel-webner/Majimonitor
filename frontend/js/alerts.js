let currentStatus = 'active';

async function loadAlerts() {
    const container = document.getElementById('alerts-container');
    const query = currentStatus ? `?status=${currentStatus}` : '';

    let alerts;
    try {
        alerts = await apiGet(`/alerts${query}`);
    } catch (err) {
        container.innerHTML = '<p>Could not reach the backend.</p>';
        console.error(err);
        return;
    }

    if (alerts.length === 0) {
        container.innerHTML = `<p>No ${currentStatus || ''} alerts.</p>`;
        return;
    }

    const rows = alerts.map(a => `
        <tr>
            <td>${new Date(a.created_at).toLocaleString()}</td>
            <td>${a.site_name}</td>
            <td>${a.parameter_name}</td>
            <td>${Number(a.triggered_value).toFixed(2)} ${a.unit}</td>
            <td><span class="status-badge ${a.severity}">${a.severity}</span></td>
            <td>${a.status}</td>
            <td>
                ${a.status === 'active' ? `<button data-action="acknowledged" data-id="${a.id}">Acknowledge</button>` : ''}
                ${a.status !== 'resolved' ? `<button data-action="resolved" data-id="${a.id}">Resolve</button>` : ''}
            </td>
        </tr>
    `).join('');

    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Time</th><th>Site</th><th>Parameter</th><th>Value</th>
                    <th>Severity</th><th>Status</th><th></th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    container.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const alertId = btn.dataset.id;
            const newStatus = btn.dataset.action;
            btn.disabled = true;
            try {
                await apiPatch(`/alerts/${alertId}`, { status: newStatus, resolved_by: null });
                loadAlerts();
            } catch (err) {
                console.error(err);
                btn.disabled = false;
            }
        });
    });
}

document.getElementById('tabs').addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab')) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    currentStatus = e.target.dataset.status;
    loadAlerts();
});

loadAlerts();

document.getElementById('export-alerts-btn').addEventListener('click', () => {
    const to = new Date();
    const from = new Date('2020-01-01'); // effectively "all time"

    const url = `${API_BASE_URL}/alerts/export?from=${from.toISOString()}&to=${to.toISOString()}`;
    window.location.href = url;
});

feather.replace();