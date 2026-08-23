async function loadProfile() {
    const user = getCurrentUser();
    const infoEl = document.getElementById('profile-info');

    const avatarEl = document.getElementById('profile-avatar');
    const avatarClass = user.gender === 'male' ? 'avatar-male' : user.gender === 'female' ? 'avatar-female' : 'avatar-neutral';
    avatarEl.classList.add(avatarClass);
    avatarEl.textContent = user.name.split(' ').map(w => w[0]).slice(0, 2).join('');

    infoEl.innerHTML = `
        <p><strong>Name:</strong> ${user.name}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Role:</strong> ${user.role.replace('_', ' ')}</p>
    `;

    let sites;
    try {
        sites = await apiGet('/sites');
    } catch (err) {
        document.getElementById('my-sites').innerHTML = '<p class="panel-empty">Could not load sites.</p>';
        return;
    }

    const mySites = sites.filter(s => s.assigned_officer_id === user.id);
    const mySitesEl = document.getElementById('my-sites');

    if (mySites.length === 0) {
        mySitesEl.innerHTML = '<p class="panel-empty">No sites currently assigned to you.</p>';
    } else {
        mySitesEl.innerHTML = mySites.map(s => `
            <div class="officer-item">
                <div>
                    <div class="officer-name">${s.name}</div>
                    <div class="officer-sites">${s.river_section || ''}</div>
                </div>
            </div>
        `).join('');
    }

    feather.replace();
}

document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const messageEl = document.getElementById('password-message');
    messageEl.textContent = '';

    try {
        const data = await apiPatch('/auth/change-password', { currentPassword, newPassword });
        messageEl.textContent = data.message;
        messageEl.style.color = 'var(--color-safe)';
        document.getElementById('change-password-form').reset();
    } catch (err) {
        messageEl.textContent = 'Failed to update password. Check your current password.';
        messageEl.style.color = 'var(--color-critical)';
        console.error(err);
    }
});

loadProfile();