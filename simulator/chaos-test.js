const API_BASE_URL = 'https://majimonitor.onrender.com';

// Deliberately out-of-range values per parameter, split by severity.
// Parameter IDs match your seeded `parameters` table.
const badValues = {
  1: { name: 'pH', warning: 5.5, critical: 3.0 },
  2: { name: 'Turbidity', warning: 7, critical: 15 },
  3: { name: 'TDS', warning: 700, critical: 1200 },
  4: { name: 'Temperature', warning: 33, critical: 40 },
  5: { name: 'Conductivity', warning: 1000, critical: 1800 },
};

const siteIds = [1, 2, 3, 4];
const parameterIds = [1, 2, 3, 4, 5];

let siteIndex = 0;

async function sendBadReading() {
  const siteId = siteIds[siteIndex % siteIds.length];
  siteIndex++;

  const parameterId = parameterIds[Math.floor(Math.random() * parameterIds.length)];
  const severity = Math.random() < 0.5 ? 'warning' : 'critical';
  const value = badValues[parameterId][severity];

  try {
    const res = await fetch(`${API_BASE_URL}/api/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_id: siteId, parameter_id: parameterId, value }),
    });
    const data = await res.json();
    console.log(
      `Site ${siteId} — ${badValues[parameterId].name} = ${value} (${severity}) → zone: ${data.zone}`
    );
  } catch (err) {
    console.error('Failed to send reading:', err.message);
  }
}

console.log('Chaos test started — posting a bad reading every 20s. Press Ctrl+C to stop.');
sendBadReading(); // fire one immediately
setInterval(sendBadReading, 20000);