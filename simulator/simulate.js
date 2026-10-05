require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const INTERVAL_MS = Number(process.env.INTERVAL_MS) || 10000;
const EVENT_PROBABILITY = Number(process.env.EVENT_PROBABILITY) || 0.08;

// Flow Rate and Water Pressure are simulated by pipe-test.js scenarios, not here.
// Random values for them would break the upstream/downstream pipe diagnosis.
const PIPE_PARAMETERS = ['Flow Rate', 'Water Pressure'];

const state = {};

function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function stateKey(siteId, parameterId) {
    return `${siteId}-${parameterId}`;
}

function nextValue(siteId, parameter) {
    const key = stateKey(siteId, parameter.id);
    const safe_min = Number(parameter.safe_min);
    const safe_max = Number(parameter.safe_max);
    const warning_min = Number(parameter.warning_min);
    const warning_max = Number(parameter.warning_max);

    if (!state[key]) {
        state[key] = {
            value: (safe_min + safe_max) / 2,
            eventTicksRemaining: 0,
            eventZone: null
        };
    }

    const s = state[key];

    if (s.eventTicksRemaining > 0) {
        s.eventTicksRemaining -= 1;

        if (s.eventZone === 'critical') {
            const below = Math.random() < 0.5;
            s.value = below
                ? randomInRange(warning_min - 1, warning_min - 0.01)
                : randomInRange(warning_max + 0.01, warning_max + 1);
        } else {
            const below = Math.random() < 0.5;
            s.value = below
                ? randomInRange(warning_min, safe_min - 0.01)
                : randomInRange(safe_max + 0.01, warning_max);
        }

        s.value = Math.max(0, s.value);
        return Number(s.value.toFixed(3));
    }

    const stepSize = (safe_max - safe_min) * 0.05;
    let candidate = s.value + randomInRange(-stepSize, stepSize);
    candidate = clamp(candidate, safe_min, safe_max);

    if (Math.random() < EVENT_PROBABILITY) {
        s.eventZone = Math.random() < 0.3 ? 'critical' : 'warning';
        s.eventTicksRemaining = Math.floor(randomInRange(2, 5));
    } else {
        s.value = candidate;
    }

    s.value = Math.max(0, s.value);
    return Number(s.value.toFixed(3));
}

async function fetchSitesAndParameters() {
    const sitesRes = await axios.get(`${API_BASE_URL}/sites`);
    const parametersRes = await axios.get(`${API_BASE_URL}/parameters`);

    const activeSites = sitesRes.data.filter(site => site.status === 'active');
    const waterQualityParameters = parametersRes.data.filter(
        p => !PIPE_PARAMETERS.includes(p.name)
    );

    return { sites: activeSites, parameters: waterQualityParameters };
}

async function submitReading(site, parameter, value) {
    try {
        const res = await axios.post(`${API_BASE_URL}/readings`, {
            site_id: site.id,
            parameter_id: parameter.id,
            value
        });

        const { zone, alert } = res.data;
        const icon = zone === 'safe' ? '🟢' : zone === 'warning' ? '🟡' : '🔴';
        let line = `${icon} [${site.name}] ${parameter.name}: ${value} ${parameter.unit} (${zone})`;
        if (alert) {
            line += ` -> ALERT #${alert.id} created`;
        }
        console.log(line);
    } catch (err) {
        const detail = err.response?.data?.error || err.message;
        console.error(`⚠️  Failed to submit reading for ${site.name} / ${parameter.name}: ${detail}`);
    }
}

async function runTick(sites, parameters) {
    console.log(`\n--- Tick @ ${new Date().toLocaleTimeString()} ---`);
    for (const site of sites) {
        for (const parameter of parameters) {
            const value = nextValue(site.id, parameter);
            await submitReading(site, parameter, value);
        }
    }
}

async function start() {
    console.log('🌊 MajiMonitor Simulator starting...');

    const { sites, parameters } = await fetchSitesAndParameters();
    console.log(`Simulating ${sites.length} site(s) x ${parameters.length} parameter(s)\n`);

    await runTick(sites, parameters);
    setInterval(() => runTick(sites, parameters), INTERVAL_MS);
}

start();