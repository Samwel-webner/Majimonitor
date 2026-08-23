const parameterModel = require('../models/parameterModel');

async function listParameters(req, res) {
    try {
        const parameters = await parameterModel.getAllParameters();
        return res.json(parameters);
    } catch (err) {
        console.error('Error listing parameters:', err);
        return res.status(500).json({ error: 'Failed to fetch parameters' });
    }
}

module.exports = { listParameters };
