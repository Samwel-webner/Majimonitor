const readingModel = require('../models/readingModel');
const parameterModel = require('../models/parameterModel');
const alertModel = require('../models/alertModel');
const siteModel = require('../models/siteModel');
const userModel = require('../models/userModel');
const { sendAlertEmail } = require('../services/emailService');
const { sendCriticalAlertPush } = require('../services/pushService');
const { runDiagnosis } = require('../services/diagnosisService');

async function submitReading(req, res) {
    try {
        const { site_id, parameter_id, value } = req.body;

        if (!site_id || !parameter_id || value === undefined) {
            return res.status(400).json({ error: 'site_id, parameter_id, and value are required' });
        }

        const parameter = await parameterModel.getParameterById(parameter_id);
        if (!parameter) {
            return res.status(404).json({ error: 'Unknown parameter_id' });
        }

        const reading = await readingModel.createReading(site_id, parameter_id, value);
        const zone = parameterModel.classifyValue(parameter, value);

        // Threshold alert: raised whenever a reading leaves its safe band
        let alert = null;
        if (zone !== 'safe') {
            alert = await alertModel.createAlert({
                reading_id: reading.id,
                site_id,
                parameter_id,
                triggered_value: value,
                severity: zone
            });

            if (zone === 'critical') {
                const site = await siteModel.getSiteById(site_id);

                sendAlertEmail({
                    siteName: site.name,
                    parameterName: parameter.name,
                    value,
                    unit: parameter.unit,
                    severity: zone
                });

                const adminTokens = await userModel.getAdminPushTokens();
                adminTokens.forEach(pushToken => {
                    sendCriticalAlertPush({
                        pushToken,
                        siteName: site.name,
                        parameterName: parameter.name,
                        value,
                        unit: parameter.unit
                    });
                });
            }
        }

        // Pipe diagnosis: only flow and pressure readings are relevant.
        // Wrapped separately so a diagnosis bug can never fail a normal reading.
        let diagnosis = [];
        if (parameter.name === 'Flow Rate' || parameter.name === 'Water Pressure') {
            try {
                diagnosis = await runDiagnosis({ site_id, reading_id: reading.id, parameter_id, value });
            } catch (diagErr) {
                console.error('Diagnosis failed:', diagErr);
            }
        }

        return res.status(201).json({ reading, zone, alert, diagnosis });
    } catch (err) {
        console.error('Error submitting reading:', err);
        return res.status(500).json({ error: 'Failed to submit reading' });
    }
}

async function getLatestForSite(req, res) {
    try {
        const readings = await readingModel.getLatestReadingsForSite(req.params.siteId);
        return res.json(readings);
    } catch (err) {
        console.error('Error fetching latest readings:', err);
        return res.status(500).json({ error: 'Failed to fetch readings' });
    }
}

async function getHistoryForSite(req, res) {
    try {
        const { siteId } = req.params;
        const { parameter_id, from, to } = req.query;

        if (!parameter_id || !from || !to) {
            return res.status(400).json({ error: 'parameter_id, from, and to query params are required' });
        }

        const history = await readingModel.getHistoricalReadings(siteId, parameter_id, from, to);
        return res.json(history);
    } catch (err) {
        console.error('Error fetching reading history:', err);
        return res.status(500).json({ error: 'Failed to fetch history' });
    }
}

async function exportReadingsCSV(req, res) {
    try {
        const { siteId } = req.params;
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({ error: 'from and to query params are required' });
        }

        const site = await siteModel.getSiteById(siteId);
        if (!site) {
            return res.status(404).json({ error: 'Site not found' });
        }

        const readings = await readingModel.getReadingsForExport(siteId, from, to);

        const header = 'Timestamp,Parameter,Value,Unit\n';
        const rows = readings.map(r =>
            `${r.recorded_at.toISOString()},${r.parameter_name},${r.value},${r.unit}`
        ).join('\n');
        const csv = header + rows;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${site.name.replace(/\s+/g, '_')}_readings.csv"`);
        return res.send('\uFEFF' + csv);
    } catch (err) {
        console.error('Error exporting readings:', err);
        return res.status(500).json({ error: 'Failed to export readings' });
    }
}

module.exports = { submitReading, getLatestForSite, getHistoryForSite, exportReadingsCSV };