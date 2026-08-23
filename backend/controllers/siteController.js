const siteModel = require('../models/siteModel');

async function listSites(req, res) {
    try {
        const sites = await siteModel.getAllSites();
        return res.json(sites);
    } catch (err) {
        console.error('Error listing sites:', err);
        return res.status(500).json({ error: 'Failed to fetch sites' });
    }
}

async function getSite(req, res) {
    try {
        const site = await siteModel.getSiteById(req.params.id);
        if (!site) return res.status(404).json({ error: 'Site not found' });
        return res.json(site);
    } catch (err) {
        console.error('Error fetching site:', err);
        return res.status(500).json({ error: 'Failed to fetch site' });
    }
}

async function createSite(req, res) {
    try {
        const site = await siteModel.createSite(req.body);
        return res.status(201).json(site);
    } catch (err) {
        console.error('Error creating site:', err);
        return res.status(500).json({ error: 'Failed to create site' });
    }
}

async function updateSite(req, res) {
    try {
        const site = await siteModel.updateSite(req.params.id, req.body);
        return res.json(site);
    } catch (err) {
        console.error('Error updating site:', err);
        return res.status(500).json({ error: 'Failed to update site' });
    }
}

async function deleteSite(req, res) {
    try {
        const result = await siteModel.deleteSite(req.params.id);
        return res.json(result);
    } catch (err) {
        console.error('Error deleting site:', err);
        return res.status(500).json({ error: 'Failed to delete site' });
    }
}

module.exports = { listSites, getSite, createSite, updateSite, deleteSite };
