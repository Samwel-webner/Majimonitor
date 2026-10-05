// Simulates pipe sensor readings for MajiMonitor's diagnosis feature.
// Usage: node pipe-test.js <normal|leak|burst|blockage|nosupply>

const BASE_URL = 'http://localhost:5000/api/readings'; // local backend (port from server.js)

const PRESSURE_ID = 7; // Water Pressure (bar)
const FLOW_ID = 8;     // Flow Rate (L/min)

// Stations in pipe order: 1 Intake, 2 Makongeni, 3 Chania Bridge, 4 Athi Junction
// Each entry is [flow L/min, pressure bar]
const scenarios = {
    normal:   { 1: [100, 4.0], 2: [100, 3.8], 3: [100, 3.6], 4: [100, 3.4] },
    leak:     { 1: [100, 4.0], 2: [100, 3.8], 3: [80, 3.2],  4: [80, 3.0] },
    burst:    { 1: [100, 4.0], 2: [100, 3.8], 3: [50, 0.3],  4: [50, 0.3] },
    blockage: { 1: [100, 4.0], 2: [100, 7.0], 3: [10, 2.0],  4: [10, 1.9] },
    nosupply: { 1: [0, 0],     2: [0, 0],     3: [0, 0],     4: [0, 0] }
};

async function send(site_id, parameter_id, value) {
    const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id, parameter_id, value })
    });
    return res.json();
}

async function run() {
    const name = process.argv[2];
    const scenario = scenarios[name];

    if (!scenario) {
        console.log('Usage: node pipe-test.js <normal|leak|burst|blockage|nosupply>');
        return;
    }

    console.log(`Running scenario: ${name}\n`);

    for (const [siteId, [flow, pressure]] of Object.entries(scenario)) {
        const flowResult = await send(Number(siteId), FLOW_ID, flow);
        const pressureResult = await send(Number(siteId), PRESSURE_ID, pressure);
        console.log(`Station ${siteId}: flow ${flow} L/min, pressure ${pressure} bar`);

        for (const result of [flowResult, pressureResult]) {
            if (result.error) {
                console.log(`   ERROR: ${result.error}`);
            }
            if (result.diagnosis === undefined) {
                console.log('   (no diagnosis field: the server is running old code)');
            }
            for (const change of result.diagnosis || []) {
                console.log(`   Section ${change.section_id}: ${change.from} -> ${change.to}`);
            }
        }
    }

    console.log('\nDone.');
}

run().catch(err => console.error('Test failed:', err.message));