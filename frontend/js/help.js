async function loadThresholds() {
    let parameters;
    try {
        parameters = await apiGet('/parameters');
    } catch (err) {
        console.error(err);
        return;
    }

    document.getElementById('thresholds-table-body').innerHTML = parameters.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>${p.unit}</td>
            <td>${p.safe_min} – ${p.safe_max}</td>
            <td>${p.warning_min} – ${p.warning_max}</td>
        </tr>
    `).join('');
}

loadThresholds();