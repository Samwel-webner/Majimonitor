const readingModel = require('../models/readingModel');
const pipeSectionModel = require('../models/pipeSectionModel');
const alertModel = require('../models/alertModel');

// ============================================================
// Settings - adjust these to match real THIWASCO pipe data
// ============================================================

const LEAK_LOSS = 0.10;   // 10% of flow lost between stations = leak
const BURST_LOSS = 0.30;  // 30% lost (with low downstream pressure) = burst
const NO_FLOW = 1;        // L/min below which flow counts as zero
const NO_PRESSURE = 0.1;  // bar below which pressure counts as zero

// All four readings of a section (flow + pressure at both stations) must have arrived within
// this window of each other, or the section is skipped until the slower station reports.
// Set READING_WINDOW_SECONDS to about 1.5 x the sensors' reporting interval.
const MAX_GAP_MS = (Number(process.env.READING_WINDOW_SECONDS) || 90) * 1000;

// Severity of the alert created for each diagnosis
const SEVERITY = {
    no_supply: 'critical',
    blockage: 'critical',
    burst: 'critical',
    leak: 'warning',
    high_pressure: 'warning',
    low_pressure: 'warning'
};

// ============================================================
// Reading the latest data
// ============================================================

// Latest flow + pressure at one station, plus the safe bands from the parameters table
async function getStationData(site_id) {
    const rows = await readingModel.getLatestReadingsForSite(site_id);
    const flow = rows.find(r => r.parameter_name === 'Flow Rate');
    const pressure = rows.find(r => r.parameter_name === 'Water Pressure');
    if (!flow || !pressure) return null; // station hasn't reported both yet

    return {
        flow: Number(flow.value),
        pressure: Number(pressure.value),
        flowTime: new Date(flow.recorded_at).getTime(),
        pressureTime: new Date(pressure.recorded_at).getTime(),
        flowSafeMin: Number(flow.safe_min),
        pressureSafeMin: Number(pressure.safe_min),
        pressureSafeMax: Number(pressure.safe_max),
        pressureWarningMin: Number(pressure.warning_min)
    };
}

// True only if all four readings (flow + pressure at both stations) are close in time
function readingsAreInStep(up, down) {
    const times = [up.flowTime, up.pressureTime, down.flowTime, down.pressureTime];
    return Math.max(...times) - Math.min(...times) <= MAX_GAP_MS;
}

// Percentage of flow lost between the two stations (0 when there is no upstream flow)
function lossFraction(up, down) {
    return up.flow > NO_FLOW ? (up.flow - down.flow) / up.flow : 0;
}

// ============================================================
// The rules
// ============================================================

// Checked from most to least severe, so a burst isn't reported as just "low pressure"
function diagnose(up, down) {
    const loss = lossFraction(up, down);

    if (up.flow < NO_FLOW && up.pressure < NO_PRESSURE) return 'no_supply';
    if (up.pressure > up.pressureSafeMax && down.flow < up.flowSafeMin) return 'blockage';
    if (loss >= BURST_LOSS && down.pressure < up.pressureWarningMin) return 'burst';
    if (loss >= LEAK_LOSS) return 'leak';
    if (up.pressure > up.pressureSafeMax || down.pressure > up.pressureSafeMax) return 'high_pressure';
    if (up.pressure < up.pressureSafeMin || down.pressure < up.pressureSafeMin) return 'low_pressure';
    return 'normal';
}

// Human-readable explanation, stored on the alert and shown in the app and web pages
function describe(status, section, up, down) {
    const lossPct = Math.round(lossFraction(up, down) * 100);
    const name = section.name;

    switch (status) {
        case 'no_supply':
            return `No supply: flow and pressure are near zero at the start of "${name}"`;
        case 'blockage':
            return `Probable blockage in "${name}": upstream pressure is high (${up.pressure} bar) but downstream flow is only ${down.flow} L/min`;
        case 'burst':
            return `Probable burst in "${name}": ${lossPct}% of flow lost (${up.flow} L/min in, ${down.flow} L/min out) and downstream pressure fell to ${down.pressure} bar`;
        case 'leak':
            return `Probable leak in "${name}": ${lossPct}% of flow lost (${up.flow} L/min in, ${down.flow} L/min out)`;
        case 'high_pressure':
            return `High pressure in "${name}": ${Math.max(up.pressure, down.pressure)} bar, risk of pipe damage`;
        case 'low_pressure':
            return `Low pressure in "${name}": ${Math.min(up.pressure, down.pressure)} bar`;
        default:
            return '';
    }
}

// ============================================================
// Running the diagnosis after a reading arrives
// ============================================================

// Called after a flow or pressure reading is saved.
// Re-checks every pipe section touching that site and raises an alert when its status changes.
async function runDiagnosis({ site_id, reading_id, parameter_id, value }) {
    const sections = await pipeSectionModel.getSectionsForSite(site_id);
    const changes = [];

    for (const section of sections) {
        const up = await getStationData(section.upstream_site_id);
        const down = await getStationData(section.downstream_site_id);
        if (!up || !down) continue;                    // not enough data yet
        if (!readingsAreInStep(up, down)) continue;    // wait for the slower station to catch up

        const status = diagnose(up, down);
        if (status === section.condition_status) continue; // nothing changed, so no new alert

        await pipeSectionModel.updateConditionStatus(section.id, status);
        changes.push({ section_id: section.id, from: section.condition_status, to: status });

        if (status === 'normal') continue; // recovered: update the status only

        await alertModel.createAlert({
            reading_id,
            site_id: section.downstream_site_id, // the symptoms show up at the downstream station
            parameter_id,
            triggered_value: value,
            severity: SEVERITY[status],
            diagnosis: describe(status, section, up, down)
        });
    }

    return changes;
}

// ============================================================
// Network overview for the app, the web page and the 3D view
// ============================================================

// Latest flow, pressure and update time for one station, in a shape the screens can use
function stationSummary(site_id, name, data) {
    return {
        site_id,
        name,
        flow: data ? data.flow : null,
        pressure: data ? data.pressure : null,
        updated_at: data ? new Date(Math.max(data.flowTime, data.pressureTime)).toISOString() : null
    };
}

// Current state of every pipe section
async function getNetworkOverview() {
    const sections = await pipeSectionModel.getAllSections();
    const overview = [];

    for (const section of sections) {
        const up = await getStationData(section.upstream_site_id);
        const down = await getStationData(section.downstream_site_id);

        let message = 'No flow and pressure data yet';
        let lossPercent = null;

        if (up && down) {
            lossPercent = Math.round(lossFraction(up, down) * 100);
            message = section.condition_status === 'normal'
                ? 'Operating normally'
                : describe(section.condition_status, section, up, down);
        }

        overview.push({
            id: section.id,
            name: section.name,
            length_m: Number(section.length_m),
            condition_status: section.condition_status,
            message,
            loss_percent: lossPercent,
            upstream: stationSummary(section.upstream_site_id, section.upstream_name, up),
            downstream: stationSummary(section.downstream_site_id, section.downstream_name, down)
        });
    }

    return overview;
}

module.exports = { runDiagnosis, diagnose, getNetworkOverview };