let chartInstance = null;

function getSiteIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

async function loadSite() {
    const siteId = getSiteIdFromUrl();
    const nameEl = document.getElementById('site-name');
    const metaEl = document.getElementById('site-meta');
    const grid = document.getElementById('parameter-grid');

    if (!siteId) {
        nameEl.textContent = 'No site selected';
        return;
    }

    let site, readings;
    try {
        site = await apiGet(`/sites/${siteId}`);
        readings = await apiGet(`/sites/${siteId}/readings/latest`);
    } catch (err) {
        nameEl.textContent = 'Could not load site';
        console.error(err);
        return;
    }

    nameEl.textContent = site.name;
    metaEl.textContent = `${site.river_section || ''} · Officer: ${site.assigned_officer_name || 'Unassigned'}`;

    if (readings.length === 0) {
        grid.innerHTML = '<p>No readings yet.</p>';
        return;
    }

    grid.innerHTML = readings.map(r => `
        <div class="parameter-card" data-parameter-id="${r.parameter_id}" data-parameter-name="${r.parameter_name}">
            <div class="pname">${r.parameter_name}</div>
            <div class="pvalue">${Number(r.value).toFixed(2)} <span class="punit">${r.unit}</span></div>
        </div>
    `).join('');

    grid.querySelectorAll('.parameter-card').forEach(card => {
        card.addEventListener('click', () => {
            loadHistory(siteId, card.dataset.parameterId, card.dataset.parameterName);
        });
    });

    const firstCard = grid.querySelector('.parameter-card');
    loadHistory(siteId, firstCard.dataset.parameterId, firstCard.dataset.parameterName);
}

async function loadHistory(siteId, parameterId, parameterName) {
    const to = new Date();
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);

    let history;
    try {
        history = await apiGet(
            `/sites/${siteId}/readings/history?parameter_id=${parameterId}&from=${from.toISOString()}&to=${to.toISOString()}`
        );
    } catch (err) {
        console.error(err);
        return;
    }

    const labels = history.map(h => new Date(h.recorded_at).toLocaleTimeString());
    const values = history.map(h => Number(h.value));

    const ctx = document.getElementById('history-chart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: `${parameterName} (last 24h)`,
                data: values,
                borderColor: '#2F5D62',
                tension: 0.25
            }]
        }
    });
}

loadSite();

document.getElementById('export-readings-btn').addEventListener('click', () => {
    const siteId = getSiteIdFromUrl();
    const to = new Date();
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);

    const url = `${API_BASE_URL}/sites/${siteId}/readings/export?from=${from.toISOString()}&to=${to.toISOString()}`;
    window.location.href = url;
});

feather.replace();