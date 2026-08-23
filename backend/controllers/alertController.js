const alertModel = require('../models/alertModel');

// GET /api/alerts?status=active
async function listAlerts(req, res) {
    try {
        const { status } = req.query;
        const alerts = await alertModel.getAllAlerts(status);
        return res.json(alerts);
    } catch (err) {
        console.error('Error listing alerts:', err);
        return res.status(500).json({ error: 'Failed to fetch alerts' });
    }
}

// PATCH /api/alerts/:id  { status: 'acknowledged' | 'resolved', resolved_by: userId }
async function updateAlert(req, res) {
    try {
        const { status } = req.body;
        const valid = ['active', 'acknowledged', 'resolved'];
        if (!valid.includes(status)) {
            return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
        }
        const resolved_by = status === 'resolved' ? req.user.id : null;
        const alert = await alertModel.updateAlertStatus(req.params.id, status, resolved_by);
        return res.json(alert);
    } catch (err) {
        console.error('Error updating alert:', err);
        return res.status(500).json({ error: 'Failed to update alert' });
    }
}

async function exportAlertsCSV(req, res) {
    try {
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({ error: 'from and to query params are required' });
        }

        const alerts = await alertModel.getAlertsForExport(from, to);

        const header = 'Timestamp,Site,Parameter,Value,Unit,Severity,Status,Resolved At\n';
        const rows = alerts.map(a =>
            `${a.created_at.toISOString()},${a.site_name},${a.parameter_name},${a.triggered_value},${a.unit},${a.severity},${a.status},${a.resolved_at ? a.resolved_at.toISOString() : ''}`
        ).join('\n');
        const csv = header + rows;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="majimonitor_alerts.csv"`);
        return res.send('\uFEFF' + csv);
    } catch (err) {
        console.error('Error exporting alerts:', err);
        return res.status(500).json({ error: 'Failed to export alerts' });
    }
}

async function getAlertsByDate(req, res) {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ error: 'date query param is required (YYYY-MM-DD)' });
        }

        const from = new Date(`${date}T00:00:00.000Z`);
        const to = new Date(`${date}T23:59:59.999Z`);

        const alerts = await alertModel.getAlertsForExport(from, to);
        return res.json(alerts);
    } catch (err) {
        console.error('Error fetching alerts by date:', err);
        return res.status(500).json({ error: 'Failed to fetch alerts for that date' });
    }
}

async function getAlertTrend(req, res) {
    try {
        const { from, to } = req.query;
        if (!from || !to) {
            return res.status(400).json({ error: 'from and to query params are required' });
        }

        const alerts = await alertModel.getAlertsForExport(new Date(from), new Date(to));

        const byDate = {};
        alerts.forEach(a => {
            const day = a.created_at.toISOString().split('T')[0];
            if (!byDate[day]) byDate[day] = { date: day, critical: 0, warning: 0 };
            byDate[day][a.severity] += 1;
        });

        const trend = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
        return res.json(trend);
    } catch (err) {
        console.error('Error building alert trend:', err);
        return res.status(500).json({ error: 'Failed to build trend data' });
    }
}

module.exports = { listAlerts, updateAlert, exportAlertsCSV, getAlertsByDate, getAlertTrend };