function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Draws the big animal, its caption and the (closed) picker.
function renderAvatarArea(pickerOpen) {
    const user = getCurrentUser();
    const avatarEl = document.getElementById('profile-avatar');
    const current = MajiAvatar.forUser(user.id, user.avatar);

    const choices = MajiAvatar.list.map(a => `
        <button type="button" class="avatar-choice${a.key === user.avatar ? ' selected' : ''}"
                data-avatar="${a.key}" aria-label="${a.label}">
            ${MajiAvatar.html(null, a.key, 48)}
            <span>${a.label}</span>
        </button>
    `).join('');

    avatarEl.innerHTML = `
        <button type="button" id="avatar-open" class="avatar-open" aria-label="Change your animal">
            ${MajiAvatar.html(user.id, user.avatar, 96)}
        </button>
        <p class="avatar-hint">${current.label} - click to change</p>
        <div class="avatar-picker" id="avatar-picker"${pickerOpen ? '' : ' hidden'}>
            <h3>Choose your animal</h3>
            <div class="avatar-grid">${choices}</div>
            <p class="avatar-actions">
                <button type="button" id="avatar-auto" class="link-button">Use my automatic animal</button>
                <button type="button" id="avatar-close" class="link-button">Close</button>
            </p>
            <p id="avatar-message"></p>
        </div>
    `;
}

async function chooseAvatar(key) {
    const messageEl = document.getElementById('avatar-message');
    messageEl.textContent = 'Saving...';
    messageEl.style.color = '';

    try {
        const data = await apiPatch('/auth/avatar', { avatar: key });
        updateCurrentUser({ avatar: data.avatar });   // saves it and redraws the sidebar
        renderAvatarArea(false);
    } catch (err) {
        messageEl.textContent = 'Could not save. Try logging out and in again.';
        messageEl.style.color = 'var(--color-critical)';
        console.error(err);
    }
}

// One listener, so redrawing the avatar area never stacks up handlers
document.getElementById('profile-avatar').addEventListener('click', function (e) {
    if (e.target.closest('#avatar-open')) {
        document.getElementById('avatar-picker').hidden = false;
    } else if (e.target.closest('#avatar-close')) {
        document.getElementById('avatar-picker').hidden = true;
    } else if (e.target.closest('#avatar-auto')) {
        chooseAvatar(null);
    } else {
        const choice = e.target.closest('.avatar-choice');
        if (choice) chooseAvatar(choice.dataset.avatar);
    }
});

async function loadProfile() {
    const user = getCurrentUser();
    const infoEl = document.getElementById('profile-info');

    // The old initials circle had its own sizing, so drop that class
    document.getElementById('profile-avatar').className = 'avatar-area';
    renderAvatarArea(false);

    infoEl.innerHTML = `
        <p><strong>Name:</strong> ${escapeHtml(user.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(user.email)}</p>
        <p><strong>Role:</strong> ${escapeHtml(user.role.replace('_', ' '))}</p>
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
                    <div class="officer-name">${escapeHtml(s.name)}</div>
                    <div class="officer-sites">${escapeHtml(s.river_section || '')}</div>
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