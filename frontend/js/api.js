async function apiGet(path) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        headers: authHeaders()
    });
    if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
    return res.json();
}

async function apiPatch(path, body) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders()
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`PATCH ${path} failed (${res.status})`);
    return res.json();
}

function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiPost(path, body) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders()
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`POST ${path} failed (${res.status})`);
    return res.json();
}

async function apiPut(path, body) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders()
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`PUT ${path} failed (${res.status})`);
    return res.json();
}

async function apiDelete(path) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'DELETE',
        headers: authHeaders()
    });
    if (!res.ok) throw new Error(`DELETE ${path} failed (${res.status})`);
    return res.json();
}