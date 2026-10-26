requireAdminPage();

var ROLE_LABELS = { admin: 'Admin', field_officer: 'Field officer' };

function esc(value) {
    return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function timeAgo(value) {
    if (!value) return 'No activity yet';
    var seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 60) return 'just now';
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + ' min ago';
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    var days = Math.round(hours / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
}

// One chip per site: what is open there and whether someone has claimed it.
function siteChip(site) {
    var unclaimed = Number(site.active_alerts) || 0;
    var checking = Number(site.checking_alerts) || 0;
    var parts = [];
    var tone;

    if (unclaimed > 0) parts.push(unclaimed + ' unclaimed');
    if (checking > 0) parts.push(checking + ' being checked');

    if (parts.length === 0) {
        tone = 'clear';
        parts.push('All clear');
    } else if (unclaimed > 0) {
        // Red when an open alert on the site is critical, amber otherwise
        tone = site.critical_open > 0 ? 'crit' : 'warn';
    } else {
        tone = 'check';
    }

    return '<span class="off-chip off-chip--' + tone + '">' + parts.join(', ') + '</span>';
}

function siteRow(site) {
    return '<li>' +
        '<a href="site.html?id=' + encodeURIComponent(site.id) + '">' + esc(site.name) + '</a>' +
        siteChip(site) +
        '</li>';
}

function officerOptions(officers, selectedId) {
    return officers.map(function (o) {
        return '<option value="' + o.id + '"' + (o.id === selectedId ? ' selected' : '') + '>' + esc(o.name) + '</option>';
    }).join('');
}

function renderStats(totals) {
    var tiles = [
        { value: totals.officers, label: 'Team members', tone: '' },
        { value: totals.unclaimed_alerts, label: 'Alerts nobody has claimed', tone: totals.unclaimed_alerts > 0 ? 'alert' : '' },
        { value: totals.being_checked, label: 'Alerts being checked', tone: totals.being_checked > 0 ? 'check' : '' },
        { value: totals.unassigned_sites, label: 'Sites without an officer', tone: totals.unassigned_sites > 0 ? 'alert' : '' }
    ];

    document.getElementById('off-stats').innerHTML = tiles.map(function (t) {
        return '<div class="off-stat' + (t.tone ? ' off-stat--' + t.tone : '') + '">' +
            '<div class="off-stat-value">' + t.value + '</div>' +
            '<div class="off-stat-label">' + t.label + '</div>' +
            '</div>';
    }).join('');
}

function renderOfficers(officers, currentUser) {
    var el = document.getElementById('off-cards');
    if (!officers.length) {
        el.innerHTML = '<p class="off-muted">No officers registered yet. Use "Register a new officer" below.</p>';
        return;
    }

    // Officers with unclaimed alerts on their sites come first
    var sorted = officers.slice().sort(function (a, b) {
        return (b.open_unclaimed - a.open_unclaimed) ||
               (b.open_checking - a.open_checking) ||
               a.name.localeCompare(b.name);
    });

    el.innerHTML = sorted.map(function (o) {
        var attention = o.open_unclaimed > 0 ? ' off-card--attention' : '';
        var sites = o.sites.length
            ? '<ul class="off-sites">' + o.sites.map(siteRow).join('') + '</ul>'
            : '<p class="off-muted off-nosites">No sites assigned yet</p>';
        var removeBtn = o.id !== currentUser.id
            ? '<button type="button" class="delete-officer-btn" data-user-id="' + o.id + '">Remove</button>'
            : '';

        return '<article class="off-card' + attention + '">' +
            '<header class="off-card-head">' +
                MajiAvatar.html(o.id, o.avatar, 52) +
                '<div class="off-card-id">' +
                    '<h3>' + esc(o.name) + '</h3>' +
                    '<p>' + esc(ROLE_LABELS[o.role] || o.role) + ', ' + esc(o.email) + '</p>' +
                '</div>' +
                removeBtn +
            '</header>' +
            sites +
            '<footer class="off-card-foot">' +
                '<span><strong>' + o.acknowledged_total + '</strong> acknowledged</span>' +
                '<span><strong>' + o.resolved_total + '</strong> resolved</span>' +
                '<span>' + (o.last_activity ? 'Last active ' + timeAgo(o.last_activity) : 'No activity yet') + '</span>' +
            '</footer>' +
            '</article>';
    }).join('');
}

function renderUnassigned(sites, officers) {
    var el = document.getElementById('off-unassigned');
    if (!sites.length) {
        el.innerHTML = '<p class="off-muted">Every site has an officer.</p>';
        return;
    }

    el.innerHTML = sites.map(function (s) {
        return '<div class="off-unassigned-row">' +
            '<div>' +
                '<div class="off-site-name">' + esc(s.name) + '</div>' +
                siteChip(s) +
            '</div>' +
            '<select class="off-assign" data-site-id="' + s.id + '" aria-label="Assign an officer to ' + esc(s.name) + '">' +
                '<option value="">Assign to…</option>' + officerOptions(officers, null) +
            '</select>' +
            '</div>';
    }).join('');
}

function renderActivity(events) {
    var el = document.getElementById('off-activity');
    if (!events.length) {
        el.innerHTML = '<p class="off-muted">Nothing yet. Alerts that officers acknowledge or resolve will show up here.</p>';
        return;
    }

    el.innerHTML = '<ul class="off-activity">' + events.map(function (e) {
        return '<li>' +
            MajiAvatar.html(e.user_id, e.user_avatar, 30) +
            '<div>' +
                '<p><strong>' + esc(e.user_name) + '</strong> ' + esc(e.action) + ' ' + esc(e.parameter_name) + ' at ' + esc(e.site_name) + '</p>' +
                '<time>' + timeAgo(e.happened_at) + '</time>' +
            '</div>' +
            '</li>';
    }).join('') + '</ul>';
}

function renderAssignments(allSites, officers) {
    document.getElementById('assignments-list').innerHTML = allSites.map(function (site) {
        return '<div class="assignment-row">' +
            '<div class="assignment-site">' +
                '<div class="officer-name">' + esc(site.name) + '</div>' +
                '<div class="officer-sites">' + esc(site.river_section || '') + '</div>' +
            '</div>' +
            '<select data-site-id="' + site.id + '" class="officer-select off-assign" aria-label="Officer for ' + esc(site.name) + '">' +
                '<option value="">Unassigned</option>' + officerOptions(officers, site.assigned_officer_id) +
            '</select>' +
            '</div>';
    }).join('');
}

async function loadOfficersPage() {
    var summary;
    try {
        summary = await apiGet('/auth/officers/summary');
    } catch (err) {
        console.error(err);
        document.getElementById('off-cards').innerHTML =
            '<p class="panel-empty">Could not load the officers. Check that you are logged in as an admin and that the backend has finished deploying.</p>';
        return;
    }

    var officers = summary.officers;
    var allSites = officers
        .reduce(function (list, o) { return list.concat(o.sites); }, [])
        .concat(summary.unassigned_sites)
        .sort(function (a, b) { return a.name.localeCompare(b.name); });

    renderStats(summary.totals);
    renderOfficers(officers, getCurrentUser());
    renderUnassigned(summary.unassigned_sites, officers);
    renderActivity(summary.recent_activity);
    renderAssignments(allSites, officers);

    if (window.feather) feather.replace();
}

async function assignSite(siteId, officerId) {
    try {
        await apiPut('/sites/' + siteId, { assigned_officer_id: officerId || null });
    } catch (err) {
        alert('Failed to update assignment. Are you logged in as an admin?');
        console.error(err);
    }
    loadOfficersPage();
}

async function removeOfficer(userId) {
    if (!confirm('Remove this officer? Their assigned sites will become unassigned.')) return;
    try {
        await apiDelete('/auth/users/' + userId);
        loadOfficersPage();
    } catch (err) {
        alert('Failed to remove officer.');
        console.error(err);
    }
}

// One listener each, so re-rendering the page never stacks up handlers
var mainEl = document.querySelector('.main-content');

mainEl.addEventListener('change', function (e) {
    var select = e.target.closest('.off-assign');
    if (select) assignSite(select.dataset.siteId, select.value);
});

mainEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.delete-officer-btn');
    if (btn) removeOfficer(btn.dataset.userId);
});

document.getElementById('register-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    var name = document.getElementById('reg-name').value;
    var email = document.getElementById('reg-email').value;
    var password = document.getElementById('reg-password').value;
    var role = document.getElementById('reg-role').value;
    var gender = document.getElementById('reg-gender').value;
    var errorEl = document.getElementById('register-error');
    errorEl.textContent = '';

    try {
        await apiPost('/auth/register', { name: name, email: email, password: password, role: role, gender: gender });
        document.getElementById('register-form').reset();
        document.getElementById('register-details').open = false;
        loadOfficersPage();
    } catch (err) {
        errorEl.textContent = 'Failed to register officer. Check the email isn\'t already used.';
        console.error(err);
    }
});

loadOfficersPage();