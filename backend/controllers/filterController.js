const filterModel = require('../models/filterModel');

async function listFilters(req, res) {
    try {
        const filters = await filterModel.getAllFilters();
        return res.json(filters);
    } catch (err) {
        console.error('Error listing filters:', err);
        return res.status(500).json({ error: 'Failed to fetch filters' });
    }
}

async function createFilter(req, res) {
    try {
        const filter = await filterModel.createFilter(req.body);
        return res.status(201).json(filter);
    } catch (err) {
        console.error('Error creating filter:', err);
        return res.status(500).json({ error: 'Failed to create filter' });
    }
}

async function markServiced(req, res) {
    try {
        const filter = await filterModel.markServiced(req.params.id);
        return res.json(filter);
    } catch (err) {
        console.error('Error marking filter serviced:', err);
        return res.status(500).json({ error: 'Failed to update filter' });
    }
}

async function deleteFilter(req, res) {
    try {
        const result = await filterModel.deleteFilter(req.params.id);
        return res.json(result);
    } catch (err) {
        console.error('Error deleting filter:', err);
        return res.status(500).json({ error: 'Failed to delete filter' });
    }
}

module.exports = { listFilters, createFilter, markServiced, deleteFilter };