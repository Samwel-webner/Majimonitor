requireAdminPage();

async function loadOfficersPage() {
    let sites, users;
    try {
        [sites, users] = await Promise.all([
            apiGet('/sites'),
            apiGet('/auth/users')
        ]);
    } catch (err) {
        document.getElementById('assignments-list').innerHTML = '<p class="panel-empty">Could not load data. Are you logged in as an admin?</p>';
        console.error(err);
        return;
    }

    const officers = users.filter(u => u.role === 'field_officer' || u.role === 'admin');

    // Registered Officers panel
    const registryEl = document.getElementById('officers-registry');
    const currentUser = getCurrentUser();

    registryEl.innerHTML = officers.map(o => `
        <div class="officer-item">
            <div class="officer-avatar">${o.name.split(' ').map(w => w[0]).slice(0,2).join('')}</div>
            <div style="flex:1;">
                <div class="officer-name">${o.name}</div>
                <div class="officer-sites">${o.email} · ${o.role.replace('_', ' ')}</div>
            </div>
            ${o.id !== currentUser.id ? `<button class="delete-officer-btn" data-user-id="${o.id}">Remove</button>` : ''}
        </div>
    `).join('');

    registryEl.querySelectorAll('.delete-officer-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            const confirmed = confirm('Remove this officer? Their assigned sites will become unassigned.');
            if (!confirmed) return;

            try {
                await apiDelete(`/auth/users/${userId}`);
                loadOfficersPage();
            } catch (err) {
                alert('Failed to remove officer.');
                console.error(err);
            }
        });
    });

    // Site Assignments panel
    const assignmentsEl = document.getElementById('assignments-list');
    assignmentsEl.innerHTML = sites.map(site => `
        <div class="assignment-row">
            <div class="assignment-site">
                <div class="officer-name">${site.name}</div>
                <div class="officer-sites">${site.river_section || ''}</div>
            </div>
            <select data-site-id="${site.id}" class="officer-select">
                <option value="">Unassigned</option>
                ${officers.map(o => `
                    <option value="${o.id}" ${site.assigned_officer_id === o.id ? 'selected' : ''}>
                        ${o.name}
                    </option>
                `).join('')}
            </select>
        </div>
    `).join('');

    assignmentsEl.querySelectorAll('.officer-select').forEach(select => {
        select.addEventListener('change', async () => {
            const siteId = select.dataset.siteId;
            const officerId = select.value || null;

            try {
                await apiPut(`/sites/${siteId}`, { assigned_officer_id: officerId });
            } catch (err) {
                alert('Failed to update assignment. Are you logged in as an admin?');
                console.error(err);
            }
        });
    });

    feather.replace();
}

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    const gender = document.getElementById('reg-gender').value;
    const errorEl = document.getElementById('register-error');
    errorEl.textContent = '';

    try {
        await apiPost('/auth/register', { name, email, password, role, gender });
        document.getElementById('register-form').reset();
        loadOfficersPage();
    } catch (err) {
        errorEl.textContent = 'Failed to register officer. Check the email isn\'t already used.';
        console.error(err);
    }
});

loadOfficersPage();