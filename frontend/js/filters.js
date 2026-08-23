function hideAdminControlsIfNeeded() {
    const user = getCurrentUser();
    if (user.role !== 'admin') {
        document.querySelector('#add-filter-form').closest('.panel').style.display = 'none';
    }
}

function getFilterStatus(filter) {
    const lastServiced = new Date(filter.last_serviced_date);
    const dueDate = new Date(lastServiced.getTime() + filter.service_interval_days * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysUntilDue = Math.floor((dueDate - now) / (24 * 60 * 60 * 1000));

    if (daysUntilDue < 0) return { label: 'overdue', className: 'critical' };
    if (daysUntilDue <= 14) return { label: 'due soon', className: 'warning' };
    return { label: 'ok', className: 'safe' };
}

async function loadFilters() {
    let sites, filters;
    try {
        [sites, filters] = await Promise.all([
            apiGet('/sites'),
            apiGet('/filters')
        ]);
    } catch (err) {
        document.getElementById('filters-list').innerHTML = '<p class="panel-empty">Could not load filters.</p>';
        console.error(err);
        return;
    }

    const siteSelect = document.getElementById('filter-site');
    siteSelect.innerHTML = sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    const statuses = filters.map(getFilterStatus);
    const overdueCount = statuses.filter(s => s.label === 'overdue').length;
    const dueSoonCount = statuses.filter(s => s.label === 'due soon').length;
    const okCount = statuses.filter(s => s.label === 'ok').length;
    const isAdmin = getCurrentUser().role === 'admin';

    document.getElementById('filter-stat-row').innerHTML = `
        <div class="stat-card">
            <div class="stat-icon safe"><i data-feather="check-circle"></i></div>
            <div>
                <div class="stat-value">${okCount}</div>
                <div class="stat-label">Filters OK</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon warning"><i data-feather="alert-circle"></i></div>
            <div>
                <div class="stat-value">${dueSoonCount}</div>
                <div class="stat-label">Due Soon</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon critical"><i data-feather="alert-triangle"></i></div>
            <div>
                <div class="stat-value">${overdueCount}</div>
                <div class="stat-label">Overdue</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon total"><i data-feather="filter"></i></div>
            <div>
                <div class="stat-value">${filters.length}</div>
                <div class="stat-label">Total Filters</div>
            </div>
        </div>
    `;

    const listEl = document.getElementById('filters-list');
    if (filters.length === 0) {
        listEl.innerHTML = '<p class="panel-empty">No filters recorded yet.</p>';
    } else {
        listEl.innerHTML = filters.map((f, i) => {
            const status = statuses[i];
            return `
                <div class="assignment-row">
                    <div class="assignment-site">
                        <div class="officer-name">${f.filter_type} <span class="status-badge ${status.className}">${status.label}</span></div>
                        <div class="officer-sites">${f.site_name} · Last serviced: ${f.last_serviced_date.split('T')[0]} · Every ${f.service_interval_days} days</div>
                    </div>
                    <div>
                        <button class="service-filter-btn" data-filter-id="${f.id}">Mark Serviced Today</button>
                        ${isAdmin ? `<button class="delete-filter-btn" data-filter-id="${f.id}">Delete</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        listEl.querySelectorAll('.service-filter-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    await apiPatch(`/filters/${btn.dataset.filterId}/service`, {});
                    loadFilters();
                } catch (err) {
                    alert('Failed to update filter.');
                    console.error(err);
                }
            });
        });

        listEl.querySelectorAll('.delete-filter-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const confirmed = confirm('Delete this filter record?');
                if (!confirmed) return;
                try {
                    await apiDelete(`/filters/${btn.dataset.filterId}`);
                    loadFilters();
                } catch (err) {
                    alert('Failed to delete filter. Are you logged in as admin?');
                    console.error(err);
                }
            });
        });
    }

    feather.replace();
}

document.getElementById('add-filter-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const site_id = document.getElementById('filter-site').value;
    const filter_type = document.getElementById('filter-type').value;
    const installation_date = document.getElementById('filter-install-date').value;
    const last_serviced_date = document.getElementById('filter-serviced-date').value;
    const service_interval_days = document.getElementById('filter-interval').value;
    const notes = document.getElementById('filter-notes').value;
    const messageEl = document.getElementById('add-filter-message');

    try {
        await apiPost('/filters', { site_id, filter_type, installation_date, last_serviced_date, service_interval_days, notes });
        document.getElementById('add-filter-form').reset();
        messageEl.textContent = 'Filter added successfully.';
        messageEl.style.color = 'var(--color-safe)';
        loadFilters();
    } catch (err) {
        messageEl.textContent = 'Failed to add filter. Are you logged in as admin?';
        messageEl.style.color = 'var(--color-critical)';
        console.error(err);
    }
});

hideAdminControlsIfNeeded();
loadFilters();