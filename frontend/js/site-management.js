requireAdminPage();

async function loadSitesManagement() {
    let sites;
    try {
        sites = await apiGet('/sites');
    } catch (err) {
        document.getElementById('sites-management-list').innerHTML = '<p class="panel-empty">Could not load sites.</p>';
        return;
    }

    const listEl = document.getElementById('sites-management-list');
    listEl.innerHTML = sites.map(site => `
        <div class="assignment-row">
            <div class="assignment-site">
                <div class="officer-name">${site.name}</div>
                <div class="officer-sites">${site.river_section || ''} · ${site.status}</div>
            </div>
            <div>
                <button class="toggle-status-btn" data-site-id="${site.id}" data-current-status="${site.status}">
                    ${site.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button class="delete-site-btn" data-site-id="${site.id}">Delete</button>
            </div>
        </div>
    `).join('');

    listEl.querySelectorAll('.toggle-status-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const siteId = btn.dataset.siteId;
            const newStatus = btn.dataset.currentStatus === 'active' ? 'inactive' : 'active';
            try {
                await apiPut(`/sites/${siteId}`, { status: newStatus });
                loadSitesManagement();
            } catch (err) {
                alert('Failed to update site status.');
                console.error(err);
            }
        });
    });

    listEl.querySelectorAll('.delete-site-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const siteId = btn.dataset.siteId;
            const confirmed = confirm('Delete this site permanently? This also deletes all its readings and alerts.');
            if (!confirmed) return;

            try {
                await apiDelete(`/sites/${siteId}`);
                loadSitesManagement();
            } catch (err) {
                alert('Failed to delete site.');
                console.error(err);
            }
        });
    });
}

document.getElementById('add-site-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('site-name').value;
    const location_description = document.getElementById('site-location').value;
    const river_section = document.getElementById('site-section').value;
    const latitude = document.getElementById('site-lat').value || null;
    const longitude = document.getElementById('site-lng').value || null;
    const messageEl = document.getElementById('add-site-message');

    try {
        await apiPost('/sites', { name, location_description, river_section, latitude, longitude, status: 'active' });
        document.getElementById('add-site-form').reset();
        messageEl.textContent = 'Site added successfully.';
        messageEl.style.color = 'var(--color-safe)';
        loadSitesManagement();
    } catch (err) {
        messageEl.textContent = 'Failed to add site.';
        messageEl.style.color = 'var(--color-critical)';
        console.error(err);
    }
});

loadSitesManagement();
feather.replace();