const diagnosisService = require('../services/diagnosisService');

async function listPipes(req, res) {
    try {
        const pipes = await diagnosisService.getNetworkOverview();
        return res.json(pipes);
    } catch (err) {
        console.error('Error fetching pipe network:', err);
        return res.status(500).json({ error: 'Failed to fetch pipe network' });
    }
}

module.exports = { listPipes };