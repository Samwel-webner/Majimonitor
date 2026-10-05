require('dotenv').config();
const express = require('express');
const cors = require('cors');

const sitesRoutes = require('./routes/sites');
const readingsRoutes = require('./routes/readings');
const alertsRoutes = require('./routes/alerts');
const parametersRoutes = require('./routes/parameters');
const authRoutes = require('./routes/auth');
const filtersRoutes = require('./routes/filters');
const pipesRoutes = require('./routes/pipes');

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
    next();
});

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'MajiMonitor API', message: 'Water quality monitoring backend for THIWASCO' });
});

app.use('/api/sites', sitesRoutes);
app.use('/api/readings', readingsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/parameters', parametersRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/filters', filtersRoutes);
app.use('/api/pipes', pipesRoutes);

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🌊 MajiMonitor API running on http://localhost:${PORT}`);
});