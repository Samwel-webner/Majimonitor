function saveSession(token, user) {
    localStorage.setItem('majimonitor_token', token);
    localStorage.setItem('majimonitor_user', JSON.stringify(user));
}

function getToken() {
    return localStorage.getItem('majimonitor_token');
}

function getCurrentUser() {
    const raw = localStorage.getItem('majimonitor_user');
    return raw ? JSON.parse(raw) : null;
}

// Merge new fields (e.g. { avatar: 'lion' }) into the saved user and redraw the sidebar
function updateCurrentUser(changes) {
    const user = getCurrentUser();
    if (!user) return null;
    const updated = Object.assign({}, user, changes);
    localStorage.setItem('majimonitor_user', JSON.stringify(updated));
    renderSidebarUser();
    return updated;
}

function renderSidebarUser() {
    const el = document.getElementById('sidebar-user');
    if (!el) return;

    const user = getCurrentUser();
    if (!user) return;

    let avatarHtml;
    if (window.MajiAvatar) {
        avatarHtml = window.MajiAvatar.html(user.id, user.avatar, 40);
    } else {
        // Fallback if avatars.js is not loaded on this page
        const initials = user.name.split(' ').map(w => w[0]).slice(0, 2).join('');
        avatarHtml = `<div class="sidebar-user-avatar avatar-neutral">${initials}</div>`;
    }

    el.innerHTML = `
        <div class="sidebar-user-row">
            ${avatarHtml}
            <div>
                <div class="sidebar-user-name">${user.name}</div>
                <div class="sidebar-user-role">${user.role.replace('_', ' ')}</div>
            </div>
        </div>
    `;
}

renderSidebarUser();

function logout() {
    localStorage.removeItem('majimonitor_token');
    localStorage.removeItem('majimonitor_user');
    window.location.href = 'login.html';
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = '';

        try {
            const res = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                errorEl.textContent = data.error || 'Login failed';
                return;
            }

            saveSession(data.token, data.user);
            window.location.href = 'index.html';
        } catch (err) {
            errorEl.textContent = 'Could not reach the backend';
            console.error(err);
        }
    });
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
}

function requireAdminPage() {
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') {
        window.location.href = 'index.html';
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var user = getCurrentUser();
    if (user && user.role === 'admin') return;
    document.querySelectorAll('[data-admin-only]').forEach(function (el) {
        el.style.display = 'none';
    });
});