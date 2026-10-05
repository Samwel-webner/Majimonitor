// ============================================================
// Pipe Network page: status cards + 3D pipe view
// Both read the same data from GET /api/pipes
// ============================================================

const CONFIG = {
    refreshMs: 30000,        // the backend answers slowly, so don't refresh too often
    viewHeight: 480,         // height of the 3D panel in pixels
    shadows: true,           // set to false if the 3D view feels choppy
    shadowMapSize: 2048,
    camera: { fov: 50, startY: 3.6, focusY: 2.6, lookAtY: 1.4, minZ: 4, maxZ: 26, focusZ: 7.5 },
    stationSpacing: 4.5,     // distance between stations in the 3D scene
    groundY: -1.2,           // height of the ground
    pipeRadius: 0.3,
    gaugeMaxBar: 8,          // top of the pressure gauge scale
    badgeY: 1.6,             // height of the floating icon badges
    labelY: 2.5,             // height of the station name labels
    tour: { overviewMs: 3000, normalMs: 3500, faultMs: 6500 },
    themeKey: 'majimonitor3dTheme',
    colors: {
        paint: 0x1d5fc4,     // blue pipe paint
        steel: 0x64748b,
        concrete: 0x9ca3af,
        housing: 0x1e3a5f,
        roof: 0x94a3b8,
        water: 0x38bdf8,
        droplet: 0xbae6fd,
        network: 0x38bdf8    // glowing data lines
    }
};

// Lighting and sky for day and night
const THEMES = {
    day: {
        fog: 0xcfe3f5, fogNear: 30, fogFar: 85,
        hemiSky: 0xdbeafe, hemiGround: 0x3a5a35, hemiIntensity: 0.85,
        sunColor: 0xfff4e0, sunIntensity: 0.95, sunPos: [8, 14, 9],
        cityGlow: 0, riverGlow: 0
    },
    night: {
        fog: 0x0b1530, fogNear: 22, fogFar: 70,
        hemiSky: 0x24407a, hemiGround: 0x0b1220, hemiIntensity: 0.6,
        sunColor: 0x9db8ff, sunIntensity: 0.45, sunPos: [-8, 12, 6],
        cityGlow: 1, riverGlow: 0.55
    }
};

// How each condition is shown: label for the badge, level for the colour (ok / warn / bad)
const STATUS_INFO = {
    normal:        { label: 'Normal',        level: 'ok' },
    low_pressure:  { label: 'Low pressure',  level: 'warn' },
    high_pressure: { label: 'High pressure', level: 'warn' },
    leak:          { label: 'Leak',          level: 'warn' },
    burst:         { label: 'Burst pipe',    level: 'bad' },
    blockage:      { label: 'Blockage',      level: 'bad' },
    no_supply:     { label: 'No supply',     level: 'bad' }
};

// General guidance shown in the inspect panel. Replace with THIWASCO's own procedures when you have them.
const ACTIONS = {
    normal: 'No action needed. The section is operating within its normal range.',
    leak: 'Send a field team to inspect the pipe between the two stations. Look for wet ground and pressure drops. Schedule a repair, and isolate the section if the loss grows.',
    burst: 'Isolate the section by closing the valves at both stations. Dispatch an emergency repair crew and warn customers who may lose supply.',
    blockage: 'Check that the valves in this section are open. Inspect for debris or a stuck valve, and flush the line once it is cleared.',
    no_supply: 'Check the pump and the main valve at the source. Confirm there is power at the pump house and that the intake is not blocked.',
    low_pressure: 'Check pump output and the tank level. Look for unreported leaks or unusually heavy demand upstream.',
    high_pressure: 'Check the pressure-reducing valve and reduce pump output. Inspect joints and flanges for stress.'
};

// Same three colours as the cards, in the form Three.js wants (and as CSS for labels)
const LEVEL_COLOR = { ok: 0x16a34a, warn: 0xf59e0b, bad: 0xdc2626 };
const LEVEL_CSS = { ok: '#16a34a', warn: '#f59e0b', bad: '#dc2626' };
const LEVEL_RANK = { ok: 0, warn: 1, bad: 2 };

function statusInfo(status) {
    return STATUS_INFO[status] || { label: status, level: 'warn' };
}

// ============================================================
// Status cards
// ============================================================

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function fmt(value, unit) {
    return value === null || value === undefined ? '--' : `${value} ${unit}`;
}

function stationHtml(role, station) {
    const updated = station.updated_at ? new Date(station.updated_at).toLocaleTimeString() : 'no data';
    return `
        <div class="pipe-station">
            <strong>${role}: ${escapeHtml(station.name)}</strong>
            Flow: ${fmt(station.flow, 'L/min')}<br>
            Pressure: ${fmt(station.pressure, 'bar')}<br>
            <span class="pipe-meta">Updated ${updated}</span>
        </div>
    `;
}

function cardHtml(pipe) {
    const info = statusInfo(pipe.condition_status);
    const loss = pipe.loss_percent === null ? '--' : `${pipe.loss_percent}%`;

    return `
        <div class="pipe-card ${info.level}">
            <h3>${escapeHtml(pipe.name)}</h3>
            <span class="pipe-badge ${info.level}">${info.label}</span>
            <p class="pipe-message">${escapeHtml(pipe.message)}</p>
            <div class="pipe-stations">
                ${stationHtml('From', pipe.upstream)}
                ${stationHtml('To', pipe.downstream)}
            </div>
            <div class="pipe-meta">Length ${pipe.length_m} m &middot; Flow lost between stations: ${loss}</div>
        </div>
    `;
}

// ============================================================
// 3D view: shared state
// ============================================================

let renderer, scene, camera;
let root;                // rotated by the user
let pan;                 // moved so the selected item sits at the centre of rotation
let sceneryGroup;        // landscape: built once, never rebuilt
let world;               // pipes, stations, dashboard: rebuilt from fresh data every refresh
let hemi, sun;           // lights that change between day and night
let cityMat, riverMat;   // materials that change between day and night
let daySky, nightSky;
let riverTexture;

let pipeVisuals = [];    // one entry per pipe: materials and moving parts to animate
let gauges = [];         // pressure gauge needles
let droplets = [];       // spray droplets for leaks, bursts and the outfall
let puddles = [];        // water on the ground (puddles and foam)
let statusLights = [];   // roof lights on the stations
let beacons = [];        // expanding alarm rings on the ground
let pulses = [];         // light pulses travelling along the data lines
let pickTargets = [];    // things the user can click
let focusTargets = { pipes: {}, stations: {} };
let layerItems = { labels: [], data: [], gauges: [] };

const layers = { labels: true, data: true, gauges: true, scenery: true };
const lastNeedle = {};   // remembers each needle's angle so it doesn't restart from zero on refresh
const VIEW_START = { rotX: 0.12, rotY: -0.2 };
const view = { rotX: VIEW_START.rotX, rotY: VIEW_START.rotY };

let latestPipes = [];
let selected = null;     // { type: 'pipe' | 'station', id }
let focus = null;        // { x, z } of the selected item, or null for the overview
let camTargetZ = 14;
let camTargetY = CONFIG.camera.startY;
let userActive = false;  // true while the user is dragging
let userZoomed = false;  // true once the user has zoomed by hand
let fitStationCount = 0;
let theme = 'day';
let lastFrame = performance.now();

const tour = { active: false, step: -1, until: 0 };

// overlay elements (created once)
let panel, themeBtn, tourBtn;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// ============================================================
// 3D view: setup
// ============================================================

function showThreeMessage(text) {
    document.getElementById('pipe-3d').innerHTML = `<p class="pipe-3d-msg">${text}</p>`;
}

// Moves the camera back far enough that the whole chain fits the panel width
function fitCamera() {
    if (focus || userZoomed || !fitStationCount) return;
    const halfWidth = ((fitStationCount - 1) / 2) * CONFIG.stationSpacing + 2.2;
    const tanHalf = Math.tan((camera.fov / 2) * Math.PI / 180) * camera.aspect;
    const z = halfWidth / tanHalf + 0.5;
    camTargetZ = Math.max(CONFIG.camera.minZ, Math.min(CONFIG.camera.maxZ, z));
}

function resizeThree() {
    const container = document.getElementById('pipe-3d');
    container.style.height = CONFIG.viewHeight + 'px';
    const width = container.clientWidth || 600;
    renderer.setSize(width, CONFIG.viewHeight);
    camera.aspect = width / CONFIG.viewHeight;
    camera.updateProjectionMatrix();
    fitCamera();
}

// What is under the mouse? Returns { type, id } or null
function pickAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(pickTargets, true);
    for (const hit of hits) {
        let o = hit.object;
        while (o) {
            if (o.userData && o.userData.pick) return o.userData.pick;
            o = o.parent;
        }
    }
    return null;
}

// Drag to rotate, scroll to zoom, click to inspect, double-click to reset
function setupInput(canvas) {
    let lastX = 0;
    let lastY = 0;
    let downX = 0;
    let downY = 0;
    let moved = 0;

    canvas.addEventListener('pointerdown', e => {
        userActive = true;
        lastX = downX = e.clientX;
        lastY = downY = e.clientY;
        moved = 0;
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = 'grabbing';
        if (tour.active) stopTour();
    });

    canvas.addEventListener('pointermove', e => {
        if (!userActive) {
            canvas.style.cursor = pickAt(e.clientX, e.clientY) ? 'pointer' : 'grab';
            return;
        }
        moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY));
        view.rotY += (e.clientX - lastX) * 0.01;
        view.rotX = Math.max(0.0, Math.min(0.6, view.rotX + (e.clientY - lastY) * 0.01));
        lastX = e.clientX;
        lastY = e.clientY;
    });

    canvas.addEventListener('pointerup', e => {
        const wasClick = userActive && moved < 5;
        userActive = false;
        canvas.style.cursor = 'grab';
        if (wasClick) {
            const hit = pickAt(e.clientX, e.clientY);
            if (hit) selectTarget(hit);
        }
    });

    canvas.addEventListener('pointercancel', () => {
        userActive = false;
        canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        userZoomed = true;
        const { minZ, maxZ } = CONFIG.camera;
        camTargetZ = Math.max(minZ, Math.min(maxZ, camTargetZ + e.deltaY * 0.012));
    }, { passive: false });

    canvas.addEventListener('dblclick', () => {
        view.rotX = VIEW_START.rotX;
        view.rotY = VIEW_START.rotY;
        selectTarget(null);
    });
}

function initThree() {
    if (typeof THREE === 'undefined') {
        showThreeMessage('The 3D view could not load. Check your internet connection and refresh.');
        return false;
    }

    try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (err) {
        showThreeMessage('This browser or device does not support 3D graphics (WebGL).');
        return false;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = CONFIG.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const container = document.getElementById('pipe-3d');
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    daySky = makeSkyTexture(false);
    nightSky = makeSkyTexture(true);
    scene.background = daySky;
    scene.fog = new THREE.Fog(THEMES.day.fog, THEMES.day.fogNear, THEMES.day.fogFar);

    camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 120);
    camera.position.set(0, CONFIG.camera.startY, 14);
    camera.lookAt(0, CONFIG.camera.lookAtY, 0);

    // Lighting: soft sky/ground light plus one sun-like light that casts shadows
    hemi = new THREE.HemisphereLight(0xdbeafe, 0x3a5a35, 0.85);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff4e0, 0.95);
    sun.position.set(8, 14, 9);
    sun.castShadow = CONFIG.shadows;
    sun.shadow.mapSize.set(CONFIG.shadowMapSize, CONFIG.shadowMapSize);
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    scene.add(sun);

    // root turns with the mouse; pan shifts so the selected item is the centre of that turn
    root = new THREE.Group();
    scene.add(root);
    pan = new THREE.Group();
    root.add(pan);
    sceneryGroup = new THREE.Group();
    world = new THREE.Group();
    pan.add(sceneryGroup);
    pan.add(world);

    buildScenery();
    createOverlay(container);

    let savedTheme = 'day';
    try { savedTheme = localStorage.getItem(CONFIG.themeKey) || 'day'; } catch (err) { /* ignore */ }
    applyTheme(savedTheme === 'night' ? 'night' : 'day');

    resizeThree();
    window.addEventListener('resize', resizeThree);
    setupInput(renderer.domElement);
    animate();
    return true;
}

// ============================================================
// 3D view: day / night, layers, tour, inspect panel
// ============================================================

function applyTheme(name) {
    theme = name;
    const t = THEMES[name];
    scene.background = name === 'night' ? nightSky : daySky;
    scene.fog.color.setHex(t.fog);
    scene.fog.near = t.fogNear;
    scene.fog.far = t.fogFar;
    hemi.color.setHex(t.hemiSky);
    hemi.groundColor.setHex(t.hemiGround);
    hemi.intensity = t.hemiIntensity;
    sun.color.setHex(t.sunColor);
    sun.intensity = t.sunIntensity;
    sun.position.set(t.sunPos[0], t.sunPos[1], t.sunPos[2]);
    cityMat.emissiveIntensity = t.cityGlow;
    riverMat.emissiveIntensity = t.riverGlow;
    if (themeBtn) themeBtn.textContent = name === 'night' ? 'Day mode' : 'Night mode';
    try { localStorage.setItem(CONFIG.themeKey, name); } catch (err) { /* ignore */ }
}

function applyLayers() {
    sceneryGroup.visible = layers.scenery;
    ['labels', 'data', 'gauges'].forEach(key => {
        layerItems[key].forEach(obj => { obj.visible = layers[key]; });
    });
}

function selectTarget(sel) {
    selected = sel;
    if (sel) {
        const list = sel.type === 'pipe' ? focusTargets.pipes : focusTargets.stations;
        const spot = list[sel.id];
        if (spot) {
            focus = { x: spot.x, z: spot.z };
            camTargetZ = CONFIG.camera.focusZ;
            camTargetY = CONFIG.camera.focusY;
        }
    } else {
        focus = null;
        userZoomed = false;
        camTargetY = CONFIG.camera.startY;
        fitCamera();
    }
    renderPanel();
}

// Tour: overview, then each pipe section in turn (longer at faults), then back to the overview
function tourSteps() {
    const steps = [{ type: 'overview' }];
    latestPipes.forEach(p => steps.push({ type: 'pipe', id: p.id, fault: p.condition_status !== 'normal' }));
    steps.push({ type: 'overview' });
    return steps;
}

function startTour() {
    tour.active = true;
    tour.step = -1;
    tour.until = 0;
    if (tourBtn) tourBtn.textContent = 'Stop tour';
}

function stopTour() {
    tour.active = false;
    if (tourBtn) tourBtn.textContent = 'Start tour';
}

function runTour(nowMs) {
    if (!tour.active || nowMs < tour.until) return;

    const steps = tourSteps();
    tour.step++;
    if (tour.step >= steps.length) {
        stopTour();
        selectTarget(null);
        return;
    }

    const step = steps[tour.step];
    if (step.type === 'overview') {
        selectTarget(null);
        tour.until = nowMs + CONFIG.tour.overviewMs;
    } else {
        selectTarget({ type: 'pipe', id: step.id });
        tour.until = nowMs + (step.fault ? CONFIG.tour.faultMs : CONFIG.tour.normalMs);
    }
}

function badgeHtml(level, label) {
    return `<span class="p3d-badge" style="background:${LEVEL_CSS[level]}">${escapeHtml(label)}</span>`;
}

function readingsRow(role, station) {
    return `<tr><td>${role}</td><td>${escapeHtml(station.name)}</td><td>${fmt(station.pressure, 'bar')}</td><td>${fmt(station.flow, 'L/min')}</td></tr>`;
}

// Fills the inspect panel from the latest data
function renderPanel() {
    if (!panel) return;
    if (!selected) {
        panel.style.display = 'none';
        return;
    }

    let level = 'ok';
    let html = '';

    if (selected.type === 'pipe') {
        const pipe = latestPipes.find(p => p.id === selected.id);
        if (!pipe) { selectTarget(null); return; }
        const info = statusInfo(pipe.condition_status);
        level = info.level;
        const loss = pipe.loss_percent === null ? '--' : `${pipe.loss_percent}%`;

        html = `
            <div class="p3d-head"><strong>${escapeHtml(pipe.name)}</strong><button class="p3d-x" data-act="close" aria-label="Close">&times;</button></div>
            ${badgeHtml(info.level, info.label)}
            <p>${escapeHtml(pipe.message)}</p>
            <table class="p3d-table">
                <tr><th></th><th>Station</th><th>Pressure</th><th>Flow</th></tr>
                ${readingsRow('From', pipe.upstream)}
                ${readingsRow('To', pipe.downstream)}
            </table>
            <p class="p3d-small">Length ${pipe.length_m} m &middot; Flow lost between stations: ${loss}</p>
            <div class="p3d-advice"><strong>Suggested action</strong><br>${escapeHtml(ACTIONS[pipe.condition_status] || ACTIONS.normal)}</div>
            <p class="p3d-small">General guidance only. Follow THIWASCO procedures.</p>
            <button class="p3d-btn" data-act="close">Back to overview</button>
        `;
    } else {
        // station: gather its data and the sections that touch it
        let station = null;
        const touching = [];
        latestPipes.forEach(p => {
            if (p.upstream.site_id === selected.id) { station = p.upstream; touching.push(p); }
            if (p.downstream.site_id === selected.id) { station = p.downstream; touching.push(p); }
        });
        if (!station) { selectTarget(null); return; }

        let worst = touching[0];
        touching.forEach(p => {
            if (LEVEL_RANK[statusInfo(p.condition_status).level] > LEVEL_RANK[statusInfo(worst.condition_status).level]) worst = p;
        });
        const info = statusInfo(worst.condition_status);
        level = info.level;
        const updated = station.updated_at ? new Date(station.updated_at).toLocaleTimeString() : 'no data';
        const sectionList = touching.map(p => {
            const i = statusInfo(p.condition_status);
            return `<li>${escapeHtml(p.name)}: ${badgeHtml(i.level, i.label)}</li>`;
        }).join('');

        html = `
            <div class="p3d-head"><strong>${escapeHtml(station.name)}</strong><button class="p3d-x" data-act="close" aria-label="Close">&times;</button></div>
            ${badgeHtml(info.level, info.label)}
            <table class="p3d-table">
                <tr><td>Pressure</td><td>${fmt(station.pressure, 'bar')}</td></tr>
                <tr><td>Flow</td><td>${fmt(station.flow, 'L/min')}</td></tr>
                <tr><td>Updated</td><td>${updated}</td></tr>
            </table>
            <p class="p3d-small">Pipe sections at this station:</p>
            <ul class="p3d-list">${sectionList}</ul>
            <div class="p3d-advice"><strong>Suggested action</strong><br>${escapeHtml(ACTIONS[worst.condition_status] || ACTIONS.normal)}</div>
            <p class="p3d-small">General guidance only. Follow THIWASCO procedures.</p>
            <button class="p3d-btn" data-act="close">Back to overview</button>
        `;
    }

    panel.style.borderLeftColor = LEVEL_CSS[level];
    panel.innerHTML = html;
    panel.style.display = 'block';
}

// Buttons and panels drawn on top of the 3D view (plain HTML, styled here so no CSS file changes)
function createOverlay(container) {
    container.style.position = 'relative';

    const style = document.createElement('style');
    style.textContent = `
        .p3d-bar { position:absolute; top:10px; right:10px; display:flex; gap:8px; z-index:5; }
        .p3d-btn { background:rgba(15,23,42,0.88); color:#fff; border:1px solid rgba(148,163,184,0.55); border-radius:8px; padding:6px 12px; font-size:13px; cursor:pointer; font-family:inherit; }
        .p3d-btn:hover { background:rgba(30,64,110,0.95); }
        .p3d-menu { position:absolute; top:40px; right:0; background:rgba(15,23,42,0.95); border:1px solid rgba(148,163,184,0.45); border-radius:8px; padding:8px 14px; display:none; color:#fff; font-size:13px; white-space:nowrap; }
        .p3d-menu label { display:flex; align-items:center; gap:8px; padding:4px 0; cursor:pointer; }
        .p3d-panel { position:absolute; left:10px; bottom:10px; width:320px; max-width:calc(100% - 20px); max-height:calc(100% - 20px); overflow:auto; background:rgba(15,23,42,0.95); color:#e2e8f0; border-radius:12px; border-left:6px solid #94a3b8; padding:12px 14px; font-size:13px; line-height:1.4; z-index:5; box-sizing:border-box; }
        .p3d-head { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px; font-size:15px; color:#fff; }
        .p3d-x { background:none; border:none; color:#cbd5e1; font-size:22px; line-height:1; cursor:pointer; padding:0 4px; }
        .p3d-badge { display:inline-block; padding:2px 10px; border-radius:999px; color:#fff; font-size:12px; font-weight:600; }
        .p3d-panel p { margin:8px 0; }
        .p3d-small { color:#94a3b8; font-size:12px; }
        .p3d-table { width:100%; border-collapse:collapse; margin:8px 0; font-size:12px; }
        .p3d-table th { text-align:left; color:#94a3b8; font-weight:600; }
        .p3d-table td, .p3d-table th { padding:3px 6px 3px 0; }
        .p3d-list { margin:4px 0 8px; padding-left:18px; }
        .p3d-list li { margin:4px 0; }
        .p3d-advice { background:rgba(30,64,110,0.55); border-radius:8px; padding:8px 10px; margin:8px 0; }
    `;
    document.head.appendChild(style);

    const bar = document.createElement('div');
    bar.className = 'p3d-bar';

    themeBtn = document.createElement('button');
    themeBtn.className = 'p3d-btn';
    themeBtn.textContent = 'Night mode';
    themeBtn.addEventListener('click', () => applyTheme(theme === 'night' ? 'day' : 'night'));

    tourBtn = document.createElement('button');
    tourBtn.className = 'p3d-btn';
    tourBtn.textContent = 'Start tour';
    tourBtn.addEventListener('click', () => (tour.active ? stopTour() : startTour()));

    const layersBtn = document.createElement('button');
    layersBtn.className = 'p3d-btn';
    layersBtn.textContent = 'Layers';

    const menu = document.createElement('div');
    menu.className = 'p3d-menu';
    [['labels', 'Labels and badges'], ['data', 'Data lines and dashboard'], ['gauges', 'Pressure gauges'], ['scenery', 'Landscape']].forEach(([key, text]) => {
        const label = document.createElement('label');
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = layers[key];
        box.addEventListener('change', () => {
            layers[key] = box.checked;
            applyLayers();
        });
        label.appendChild(box);
        label.appendChild(document.createTextNode(text));
        menu.appendChild(label);
    });
    layersBtn.addEventListener('click', () => {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    });

    bar.appendChild(themeBtn);
    bar.appendChild(tourBtn);
    bar.appendChild(layersBtn);
    bar.appendChild(menu);
    container.appendChild(bar);

    panel = document.createElement('div');
    panel.className = 'p3d-panel';
    panel.style.display = 'none';
    panel.addEventListener('click', e => {
        const act = e.target.dataset && e.target.dataset.act;
        if (act === 'close') {
            if (tour.active) stopTour();
            selectTarget(null);
        }
    });
    container.appendChild(panel);

    // Update the hint under the 3D view to mention the new controls
    const hint = document.querySelector('.pipe-3d-hint');
    if (hint) hint.innerHTML = 'Click a pipe or station for details &middot; drag to rotate &middot; scroll to zoom &middot; double-click to reset';
}

// ============================================================
// 3D view: textures and labels (all drawn in code, no image files)
// ============================================================

function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Small repeatable random numbers, so the landscape looks the same every time
function seededRandom(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Sky gradient; the night version has stars and a moon
function makeSkyTexture(night) {
    const canvas = document.createElement('canvas');
    canvas.width = night ? 512 : 8;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);

    if (night) {
        grad.addColorStop(0, '#050b1f');
        grad.addColorStop(0.6, '#0e1f4a');
        grad.addColorStop(1, '#1d3566');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 256);

        const rand = seededRandom(5);
        for (let i = 0; i < 140; i++) {
            ctx.globalAlpha = 0.4 + rand() * 0.6;
            ctx.fillStyle = '#ffffff';
            const s = rand() < 0.15 ? 2 : 1;
            ctx.fillRect(rand() * 512, rand() * 190, s, s);
        }
        ctx.globalAlpha = 1;

        const moonGlow = ctx.createRadialGradient(400, 60, 4, 400, 60, 44);
        moonGlow.addColorStop(0, 'rgba(255,255,230,0.95)');
        moonGlow.addColorStop(0.35, 'rgba(255,255,230,0.35)');
        moonGlow.addColorStop(1, 'rgba(255,255,230,0)');
        ctx.fillStyle = moonGlow;
        ctx.fillRect(340, 0, 120, 120);
        ctx.fillStyle = '#fffbe6';
        ctx.beginPath();
        ctx.arc(400, 60, 13, 0, Math.PI * 2);
        ctx.fill();
    } else {
        grad.addColorStop(0, '#4f8fd0');
        grad.addColorStop(0.55, '#9cc4ea');
        grad.addColorStop(1, '#e3eefa');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 8, 256);
    }
    return new THREE.CanvasTexture(canvas);
}

function makeGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const rand = seededRandom(7);
    ctx.fillStyle = '#3d7a3a';
    ctx.fillRect(0, 0, 256, 256);
    const shades = ['#2f6a30', '#4a8f43', '#356f33', '#559a49', '#2a5e2c'];
    for (let i = 0; i < 1800; i++) {
        ctx.fillStyle = shades[Math.floor(rand() * shades.length)];
        ctx.fillRect(rand() * 256, rand() * 256, 2 + rand() * 3, 2 + rand() * 3);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 16);
    return tex;
}

// Water surface with light ripples; the sine waves tile seamlessly left to right
function makeRiverTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2a79b8';
    ctx.fillRect(0, 0, 256, 128);
    ctx.lineWidth = 3;
    for (let row = 0; row < 12; row++) {
        const y = 8 + row * 10;
        ctx.strokeStyle = row % 2 ? 'rgba(255,255,255,0.28)' : 'rgba(180,225,255,0.22)';
        ctx.beginPath();
        for (let x = 0; x <= 256; x += 4) {
            const yy = y + Math.sin((x / 256) * Math.PI * 6 + row) * 3;
            if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 1);
    return tex;
}

// Building walls: a colour texture for the day, and a matching one for the lit windows at night
function makeCityTextures() {
    const rand = seededRandom(11);
    const size = 64;
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = size;
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = size;
    const c = colorCanvas.getContext('2d');
    const g = glowCanvas.getContext('2d');

    c.fillStyle = '#8aa3c2';
    c.fillRect(0, 0, size, size);
    g.fillStyle = '#000000';
    g.fillRect(0, 0, size, size);

    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const x = col * 16 + 3;
            const y = row * 16 + 4;
            const lit = rand() < 0.55;
            c.fillStyle = lit ? '#d6e6f8' : '#5d7a9d';
            c.fillRect(x, y, 10, 10);
            if (lit) {
                g.fillStyle = '#ffd98a';
                g.fillRect(x, y, 10, 10);
            }
        }
    }

    const make = canvas => {
        const t = new THREE.CanvasTexture(canvas);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        return t;
    };
    return { map: make(colorCanvas), glow: make(glowCanvas) };
}

// Soft glowing dot used for the data pulses
function makeGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(125,211,252,0.8)');
    grad.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
}

// A text label shown as a sprite that always faces the camera
function makeLabel(text, width, accent) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');

    roundedRect(ctx, 4, 4, 504, 88, 18);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fill();
    if (accent) {
        ctx.lineWidth = 6;
        ctx.strokeStyle = accent;
        ctx.stroke();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 50, 470);

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false
    }));
    sprite.scale.set(width, width * 96 / 512, 1);
    sprite.renderOrder = 10;
    return sprite;
}

// Station label: name on top, live pressure and flow underneath
function makeStationLabel(name, values, accent) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    roundedRect(ctx, 4, 4, 504, 120, 22);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = accent;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.fillText(name, 256, 46, 470);
    ctx.fillStyle = '#93c5fd';
    ctx.font = '28px Arial';
    ctx.fillText(values, 256, 92, 470);

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false
    }));
    sprite.scale.set(3.6, 0.9, 1);
    sprite.renderOrder = 10;
    return sprite;
}

// Simple line icons for the glowing badges
function drawIcon(ctx, name) {
    ctx.strokeStyle = '#e0f2fe';
    ctx.fillStyle = '#e0f2fe';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (name === 'droplet') {
        ctx.beginPath();
        ctx.moveTo(128, 70);
        ctx.bezierCurveTo(165, 115, 175, 135, 175, 150);
        ctx.arc(128, 150, 47, 0, Math.PI, false);
        ctx.bezierCurveTo(81, 135, 91, 115, 128, 70);
        ctx.stroke();
    } else if (name === 'gauge') {
        ctx.beginPath();
        ctx.arc(128, 140, 52, Math.PI * 0.8, Math.PI * 2.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(128, 140);
        ctx.lineTo(156, 108);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(128, 140, 7, 0, Math.PI * 2);
        ctx.fill();
    } else if (name === 'wifi') {
        ctx.beginPath();
        ctx.arc(128, 168, 7, 0, Math.PI * 2);
        ctx.fill();
        [30, 54, 78].forEach(r => {
            ctx.beginPath();
            ctx.arc(128, 168, r, Math.PI * 1.25, Math.PI * 1.75);
            ctx.stroke();
        });
    } else {
        // pump / valve
        ctx.beginPath();
        ctx.arc(128, 144, 34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(128, 110); ctx.lineTo(128, 78);
        ctx.moveTo(100, 78); ctx.lineTo(156, 78);
        ctx.moveTo(62, 144); ctx.lineTo(94, 144);
        ctx.moveTo(162, 144); ctx.lineTo(194, 144);
        ctx.stroke();
    }
}

// Round glowing badge with an icon
function makeBadge(iconName, accent) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const glow = ctx.createRadialGradient(128, 128, 40, 128, 128, 128);
    glow.addColorStop(0, accent);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 256, 256);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#0b1b33';
    ctx.beginPath();
    ctx.arc(128, 128, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = accent;
    ctx.stroke();

    drawIcon(ctx, iconName);

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false
    }));
    sprite.scale.set(1.1, 1.1, 1);
    sprite.renderOrder = 11;
    return sprite;
}

// Pressure gauge face: coloured zones (red / amber / green / amber) and numbers
// The dial runs from 135 degrees (0 bar) clockwise to 405 degrees (8 bar)
function makeGaugeFace() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const max = CONFIG.gaugeMaxBar;
    const toRad = bar => (135 + (bar / max) * 270) * Math.PI / 180;

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();

    // Zones match the pressure thresholds: safe 1.5-6 bar, warning 0.5-8 bar
    const zones = [[0, 0.5, '#dc2626'], [0.5, 1.5, '#f59e0b'], [1.5, 6, '#16a34a'], [6, 8, '#f59e0b']];
    ctx.lineWidth = 16;
    zones.forEach(([from, to, color]) => {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(128, 128, 92, toRad(from), toRad(to));
        ctx.stroke();
    });

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let bar = 0; bar <= max; bar += 2) {
        const a = toRad(bar);
        ctx.fillText(String(bar), 128 + Math.cos(a) * 62, 128 + Math.sin(a) * 62);
    }
    ctx.font = 'bold 18px Arial';
    ctx.fillText('bar', 128, 190);

    return new THREE.CanvasTexture(canvas);
}

// The floating network dashboard: summary tiles and the status of each pipe section
function makeDashboardTexture(pipes) {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    roundedRect(ctx, 4, 4, 632, 392, 26);
    ctx.fillStyle = 'rgba(8, 24, 48, 0.92)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 26px Arial';
    ctx.fillText('WATER NETWORK DASHBOARD', 28, 44);

    const faults = pipes.filter(p => p.condition_status !== 'normal').length;
    const pressures = [];
    pipes.forEach(p => [p.upstream.pressure, p.downstream.pressure].forEach(v => {
        if (v !== null && v !== undefined) pressures.push(v);
    }));
    const avg = pressures.length
        ? (pressures.reduce((s, v) => s + v, 0) / pressures.length).toFixed(1) + ' bar'
        : '--';

    const tiles = [
        ['SECTIONS', String(pipes.length), '#ffffff'],
        ['FAULTS', String(faults), faults ? '#f87171' : '#4ade80'],
        ['AVG PRESSURE', avg, '#ffffff']
    ];
    tiles.forEach(([label, value, color], i) => {
        const x = 28 + i * 204;
        roundedRect(ctx, x, 76, 188, 88, 14);
        ctx.fillStyle = 'rgba(30, 64, 110, 0.55)';
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px Arial';
        ctx.fillText(label, x + 14, 100);
        ctx.fillStyle = color;
        ctx.font = 'bold 36px Arial';
        ctx.fillText(value, x + 14, 138, 160);
    });

    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('SECTION STATUS', 28, 196);

    pipes.slice(0, 4).forEach((p, i) => {
        const info = statusInfo(p.condition_status);
        const y = 228 + i * 36;
        ctx.fillStyle = LEVEL_CSS[info.level];
        ctx.beginPath();
        ctx.arc(40, y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '20px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(p.name, 62, y, 360);
        ctx.fillStyle = LEVEL_CSS[info.level];
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(info.label, 612, y);
    });
    if (pipes.length > 4) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`+ ${pipes.length - 4} more sections`, 62, 228 + 4 * 36);
    }

    return new THREE.CanvasTexture(canvas);
}

// ============================================================
// 3D view: landscape (built once)
// ============================================================

// Areas kept free of trees: the river, the pipeline and dashboard area, the tower and the plant
function inKeepOut(x, z) {
    if (z > 2.8 && z < 8.8) return true;
    if (Math.abs(x) < 17 && z > -7 && z < 2.8) return true;
    if (Math.hypot(x + 11, z + 11) < 3.2) return true;
    if (x > 4 && x < 15.5 && z > -13 && z < -6) return true;
    return false;
}

function addTrees(rand) {
    const g = CONFIG.groundY;
    const trunkGeo = new THREE.CylinderGeometry(0.07, 0.1, 0.5, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 1 });
    const pineGeo = new THREE.ConeGeometry(0.5, 1.5, 8);
    const roundGeo = new THREE.SphereGeometry(0.55, 10, 8);
    const greens = [0x2f6b34, 0x3f8a3f, 0x25562b, 0x4c9a45].map(
        c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })
    );

    let placed = 0;
    let tries = 0;
    while (placed < 60 && tries < 800) {
        tries++;
        const x = (rand() - 0.5) * 80;
        const z = -30 + rand() * 32.8;
        if (inKeepOut(x, z)) continue;

        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.25;
        tree.add(trunk);

        const mat = greens[Math.floor(rand() * greens.length)];
        const crown = rand() < 0.5
            ? new THREE.Mesh(pineGeo, mat)
            : new THREE.Mesh(roundGeo, mat);
        crown.position.y = crown.geometry === pineGeo ? 1.25 : 0.95;
        tree.add(crown);

        tree.traverse(m => { m.castShadow = true; });
        tree.position.set(x, g, z);
        tree.scale.setScalar(0.8 + rand() * 1.0);
        sceneryGroup.add(tree);
        placed++;
    }
}

function addWaterTower(x, z) {
    const g = CONFIG.groundY;
    const white = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.5, metalness: 0.2 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.6 });
    const stripe = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4, metalness: 0.3 });
    const legH = 4.2;

    [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(([dx, dz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, legH, 6), steel);
        leg.position.set(x + dx, g + legH / 2, z + dz);
        leg.castShadow = true;
        sceneryGroup.add(leg);
    });

    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.3, 28), white);
    tank.position.set(x, g + legH + 0.65, z);
    tank.castShadow = true;
    sceneryGroup.add(tank);

    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.31, 1.31, 0.25, 28), stripe);
    band.position.set(x, g + legH + 0.65, z);
    sceneryGroup.add(band);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.3, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), white);
    dome.position.set(x, g + legH + 1.3, z);
    dome.castShadow = true;
    sceneryGroup.add(dome);
}

function addTreatmentPlant() {
    const g = CONFIG.groundY;
    const rim = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.7 });
    const water = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, metalness: 0.1 });

    [6.5, 10, 13.5].forEach(x => {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.35, 32), rim);
        tank.position.set(x, g + 0.175, -9);
        tank.castShadow = true;
        tank.receiveShadow = true;
        sceneryGroup.add(tank);

        const surface = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.05, 32), water);
        surface.position.set(x, g + 0.35, -9);
        sceneryGroup.add(surface);
    });

    const building = new THREE.Mesh(
        new THREE.BoxGeometry(5, 1.4, 1.6),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 })
    );
    building.position.set(10, g + 0.7, -11.8);
    building.castShadow = true;
    building.receiveShadow = true;
    sceneryGroup.add(building);

    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(5.2, 0.15, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 })
    );
    roof.position.set(10, g + 1.48, -11.8);
    roof.castShadow = true;
    sceneryGroup.add(roof);
}

// Hills, distant city and everything else that never changes
function buildScenery() {
    const g = CONFIG.groundY;
    const rand = seededRandom(42);

    // Ground
    const ground = new THREE.Mesh(
        new THREE.CircleGeometry(48, 64),
        new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 1, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = g;
    ground.receiveShadow = true;
    sceneryGroup.add(ground);

    // River (the texture slides slowly so the water looks like it is moving; it glows faintly at night)
    riverTexture = makeRiverTexture();
    riverMat = new THREE.MeshStandardMaterial({
        map: riverTexture, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.95,
        emissive: 0x2a79b8, emissiveMap: riverTexture, emissiveIntensity: 0
    });
    const river = new THREE.Mesh(new THREE.PlaneGeometry(100, 5.4), riverMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, g + 0.04, 5.7);
    sceneryGroup.add(river);

    // Hills in the background
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x356a34, roughness: 1 });
    [[-24, -17, 8, 2.6, 5], [-8, -19, 9, 2.0, 5], [11, -18, 8, 2.8, 5], [26, -17, 8, 2.2, 5]].forEach(([x, z, sx, sy, sz]) => {
        const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), hillMat);
        hill.scale.set(sx, sy, sz);
        hill.position.set(x, g - 0.2, z);
        sceneryGroup.add(hill);
    });

    // Distant city with windows; the windows light up at night
    const cityTex = makeCityTextures();
    cityMat = new THREE.MeshStandardMaterial({
        map: cityTex.map, emissive: 0xffffff, emissiveMap: cityTex.glow, emissiveIntensity: 0, roughness: 0.8
    });
    for (let i = 0; i < 22; i++) {
        const w = 1.5 + rand() * 2;
        const h = 3 + rand() * 11;
        const geo = new THREE.BoxGeometry(w, h, w);
        const uv = geo.attributes.uv;
        for (let k = 0; k < uv.count; k++) {
            uv.setXY(k, uv.getX(k) * w / 1.5, uv.getY(k) * h / 3);
        }
        const b = new THREE.Mesh(geo, cityMat);
        b.position.set(-42 + i * 3.9 + rand() * 1.5, g + h / 2, -34 - rand() * 3);
        sceneryGroup.add(b);
    }

    addTrees(rand);
    addWaterTower(-11, -11);
    addTreatmentPlant();
}

// ============================================================
// 3D view: building the pipes and stations (rebuilt on every refresh)
// ============================================================

// Removes the old model and frees its memory before a rebuild
function clearWorld() {
    while (world.children.length) {
        const obj = world.children[0];
        world.remove(obj);
        obj.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
    }
    pipeVisuals = [];
    gauges = [];
    droplets = [];
    puddles = [];
    statusLights = [];
    beacons = [];
    pulses = [];
    pickTargets = [];
    focusTargets = { pipes: {}, stations: {} };
    layerItems = { labels: [], data: [], gauges: [] };
}

// Unique stations in the order they appear along the pipes, with a lookup by site id
function collectStations(pipes) {
    const stations = [];
    const indexById = {};
    pipes.forEach(p => {
        [p.upstream, p.downstream].forEach(s => {
            if (!(s.site_id in indexById)) {
                indexById[s.site_id] = stations.length;
                stations.push(s);
            }
        });
    });
    return { stations, indexById };
}

// Each station takes the worst status of the pipes connected to it
function computeStationLevels(pipes) {
    const levels = {};
    pipes.forEach(p => {
        const level = statusInfo(p.condition_status).level;
        [p.upstream.site_id, p.downstream.site_id].forEach(id => {
            if (!levels[id] || LEVEL_RANK[level] > LEVEL_RANK[levels[id]]) levels[id] = level;
        });
    });
    return levels;
}

// A gravel strip under the pipeline
function addPad(positions) {
    const xs = positions.map(p => p.x);
    const minX = Math.min(...xs) - 2.5;
    const maxX = Math.max(...xs) + 2.5;
    const pad = new THREE.Mesh(
        new THREE.BoxGeometry(maxX - minX, 0.05, 3.6),
        new THREE.MeshStandardMaterial({ color: 0x7c7466, roughness: 1 })
    );
    pad.position.set((minX + maxX) / 2, CONFIG.groundY + 0.025, 0);
    pad.receiveShadow = true;
    world.add(pad);
}

// Needle angle in radians: 0 bar points lower-left, 4 bar points up, 8 bar points lower-right
function needleAngle(bar) {
    const p = Math.max(0, Math.min(CONFIG.gaugeMaxBar, bar || 0));
    return (135 - (p / CONFIG.gaugeMaxBar) * 270) * Math.PI / 180;
}

// Each station: a clickable pump house with a pressure gauge, plus a floating icon badge and label
function addStations(stations, positions, levels) {
    const housingMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.housing, metalness: 0.4, roughness: 0.55 });
    const roofMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.roof, metalness: 0.5, roughness: 0.4 });
    const steelMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.steel, metalness: 0.7, roughness: 0.35 });
    const gaugeFace = makeGaugeFace();
    const g = CONFIG.groundY;
    const icons = ['pump', 'droplet', 'gauge', 'wifi'];

    stations.forEach((station, i) => {
        const pos = positions[i];
        const level = levels[station.site_id] || 'ok';

        // Everything physical about the station lives in one group, so a click anywhere on it selects the station
        const body = new THREE.Group();
        body.userData.pick = { type: 'station', id: station.site_id };
        world.add(body);
        pickTargets.push(body);
        focusTargets.stations[station.site_id] = { x: pos.x, z: pos.z };

        const housing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 1.1), housingMat);
        housing.position.set(pos.x, g + 0.8, pos.z);
        housing.castShadow = true;
        housing.receiveShadow = true;
        body.add(housing);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 1.3), roofMat);
        roof.position.set(pos.x, g + 1.66, pos.z);
        roof.castShadow = true;
        body.add(roof);

        // Status light on the roof
        const lightMat = new THREE.MeshStandardMaterial({
            color: LEVEL_COLOR[level], emissive: LEVEL_COLOR[level], emissiveIntensity: 0.9
        });
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), lightMat);
        light.position.set(pos.x, g + 1.82, pos.z);
        body.add(light);
        statusLights.push({ mat: lightMat, level });

        // Gauge on the front face: face disc, steel ring and needle
        const gy = g + 0.85;
        const gz = pos.z + 0.56;
        const face = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), new THREE.MeshBasicMaterial({ map: gaugeFace }));
        face.position.set(pos.x, gy, gz);
        body.add(face);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 40), steelMat);
        ring.position.set(pos.x, gy, gz);
        body.add(ring);

        const pivot = new THREE.Group();
        pivot.position.set(pos.x, gy, gz + 0.02);
        const needle = new THREE.Mesh(
            new THREE.BoxGeometry(0.022, 0.25, 0.006),
            new THREE.MeshBasicMaterial({ color: 0xb91c1c })
        );
        needle.position.y = 0.11;
        pivot.add(needle);
        pivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), new THREE.MeshBasicMaterial({ color: 0x111827 })));
        pivot.rotation.z = lastNeedle[station.site_id] !== undefined ? lastNeedle[station.site_id] : needleAngle(0);
        body.add(pivot);
        gauges.push({ pivot, target: needleAngle(station.pressure), siteId: station.site_id });
        layerItems.gauges.push(face, ring, pivot);

        // Thin beam from the roof up to the floating badge
        const beam = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(pos.x, g + 1.9, pos.z),
                new THREE.Vector3(pos.x, CONFIG.badgeY - 0.5, pos.z)
            ]),
            new THREE.LineBasicMaterial({ color: LEVEL_COLOR[level], transparent: true, opacity: 0.7 })
        );
        world.add(beam);

        const accent = LEVEL_CSS[level];
        const badge = makeBadge(icons[i % icons.length], accent);
        badge.position.set(pos.x, CONFIG.badgeY, pos.z);
        world.add(badge);

        const values = `${fmt(station.pressure, 'bar')}  \u00B7  ${fmt(station.flow, 'L/min')}`;
        const label = makeStationLabel(station.name, values, accent);
        label.position.set(pos.x, CONFIG.labelY, pos.z);
        world.add(label);

        layerItems.labels.push(beam, badge, label);
    });
}

// Spray of water droplets from a damaged spot or a pipe outlet
function addSpray(origin, count, power, spread, size, forward) {
    const geo = new THREE.SphereGeometry(size, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.droplet });
    for (let k = 0; k < count; k++) {
        const mesh = new THREE.Mesh(geo, mat);
        world.add(mesh);
        const d = {
            mesh, origin, power, spread,
            fx: forward ? forward.x : 0,
            fz: forward ? forward.z : 0,
            vx: 0, vy: 0, vz: 0
        };
        resetDroplet(d);
        stepDroplet(d, Math.random() * 0.9); // stagger so they don't all start together
        droplets.push(d);
    }
}

function resetDroplet(d) {
    d.mesh.position.set(
        d.origin.x + (Math.random() - 0.5) * 0.1,
        d.origin.y,
        d.origin.z + (Math.random() - 0.5) * 0.1
    );
    d.vx = d.fx + (Math.random() - 0.5) * d.spread;
    d.vz = d.fz + (Math.random() - 0.5) * d.spread;
    d.vy = d.power * (0.6 + Math.random() * 0.6);
}

function stepDroplet(d, dt) {
    d.vy -= 6 * dt; // gravity
    d.mesh.position.x += d.vx * dt;
    d.mesh.position.y += d.vy * dt;
    d.mesh.position.z += d.vz * dt;
    if (d.mesh.position.y < CONFIG.groundY + 0.05) resetDroplet(d);
}

// Water (or foam) lying on the ground
function addPuddle(x, z, base, color, opacity, y) {
    const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(1, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.scale.set(base, base, base);
    world.add(mesh);
    puddles.push({ mesh, base });
}

// Expanding alarm rings on the ground around a fault
function addBeacon(x, z, color, speed) {
    for (let k = 0; k < 2; k++) {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, CONFIG.groundY + 0.06, z);
        world.add(ring);
        beacons.push({ ring, mat, phase: k * 0.5, speed });
    }
}

// Draws one pipe section: painted steel body, glass window with water, flanges, supports and fault effects
function addPipe(pipe, a, b) {
    const R = CONFIG.pipeRadius;
    const g = CONFIG.groundY;
    const status = pipe.condition_status;
    const info = statusInfo(status);
    const color = LEVEL_COLOR[info.level];

    const dir = new THREE.Vector3().subVectors(b, a);
    const length = dir.length();
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const half = Math.max(length - 1.3, 1.2) / 2;     // leave room for the station houses
    const winHalf = Math.min(0.9, half - 0.5);        // half length of the glass window
    const bodyLen = half - winHalf;

    // The pipe is built along its own Y axis, then the group is turned to point from a to b
    const group = new THREE.Group();
    group.position.copy(mid);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    group.userData.pick = { type: 'pipe', id: pipe.id };
    world.add(group);
    pickTargets.push(group);
    focusTargets.pipes[pipe.id] = { x: mid.x, z: mid.z };

    const paintMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.paint, metalness: 0.55, roughness: 0.28 });
    const steelMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.steel, metalness: 0.7, roughness: 0.35 });
    const weldGeo = new THREE.TorusGeometry(R + 0.012, 0.02, 8, 32);

    // Painted steel body on each side of the window, with weld rings
    [-1, 1].forEach(side => {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, bodyLen, 32), paintMat);
        body.position.y = side * (winHalf + bodyLen / 2);
        body.castShadow = true;
        group.add(body);

        [1, 2].forEach(k => {
            const weld = new THREE.Mesh(weldGeo, steelMat);
            weld.rotation.x = Math.PI / 2;
            weld.position.y = side * (winHalf + (bodyLen * k) / 3);
            group.add(weld);
        });
    });

    // Glass window (glows in the status colour when faulty)
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0xbfdbfe, emissive: color, emissiveIntensity: 0,
        transparent: true, opacity: 0.28, metalness: 0.1, roughness: 0.1, depthWrite: false
    });
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.98, R * 0.98, winHalf * 2, 32), glassMat));

    [-1, 1].forEach(side => {
        const lip = new THREE.Mesh(new THREE.TorusGeometry(R + 0.03, 0.05, 10, 32), steelMat);
        lip.rotation.x = Math.PI / 2;
        lip.position.y = side * winHalf;
        group.add(lip);
    });

    // Water inside the window
    const waterMat = new THREE.MeshStandardMaterial({
        color: CONFIG.colors.water, emissive: 0x0ea5e9, emissiveIntensity: 0.25,
        transparent: true, opacity: status === 'low_pressure' ? 0.35 : 0.65
    });
    const addWater = (y0, y1) => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.72, R * 0.72, y1 - y0, 24), waterMat);
        w.position.y = (y0 + y1) / 2;
        group.add(w);
    };
    if (status === 'blockage') addWater(-winHalf, -0.2);        // water only builds up before the plug
    else if (status !== 'no_supply') addWater(-winHalf, winHalf);

    // Flanges with bolts, and a status-coloured collar, at both ends
    const collarMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.4 });
    const flangeGeo = new THREE.CylinderGeometry(R + 0.12, R + 0.12, 0.1, 32);
    const boltGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8);
    const collarGeo = new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.14, 32);
    [-1, 1].forEach(side => {
        const flange = new THREE.Mesh(flangeGeo, steelMat);
        flange.position.y = side * (half - 0.05);
        flange.castShadow = true;
        group.add(flange);

        for (let k = 0; k < 10; k++) {
            const ang = (k / 10) * Math.PI * 2;
            const bolt = new THREE.Mesh(boltGeo, steelMat);
            bolt.position.set(Math.cos(ang) * (R + 0.06), side * (half - 0.05), Math.sin(ang) * (R + 0.06));
            group.add(bolt);
        }

        const collar = new THREE.Mesh(collarGeo, collarMat);
        collar.position.y = side * (half - 0.3);
        group.add(collar);
    });

    // Concrete supports holding the pipe off the ground
    const supportH = -R - g;
    const concreteMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.concrete, roughness: 0.95 });
    [0.22, 0.78].forEach(t => {
        const p = new THREE.Vector3().lerpVectors(a, b, t);
        const block = new THREE.Mesh(new THREE.BoxGeometry(0.8, supportH, 0.7), concreteMat);
        block.position.set(p.x, g + supportH / 2, p.z);
        block.castShadow = true;
        block.receiveShadow = true;
        world.add(block);
    });

    // Flow dots inside the window: speed follows the downstream flow; none when there is no flow
    const flow = pipe.downstream.flow === null ? 0 : pipe.downstream.flow;
    const noFlow = status === 'no_supply' || flow < 1;
    let speed = noFlow ? 0 : Math.min(Math.max(flow / 100, 0.2), 2) * 0.25;
    const dotCount = status === 'low_pressure' ? 4 : 10;
    const yMin = -winHalf + 0.08;
    let yMax = winHalf - 0.08;
    if (status === 'blockage') {
        speed *= 0.5;   // water crawls and bunches up before the plug
        yMax = -0.3;
    }

    const dotGeo = new THREE.SphereGeometry(0.06, 10, 10);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    const particles = [];
    if (!noFlow) {
        for (let k = 0; k < dotCount; k++) {
            const dot = new THREE.Mesh(dotGeo, dotMat);
            const ang = Math.random() * Math.PI * 2;
            const rad = Math.random() * R * 0.5;
            dot.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
            group.add(dot);
            particles.push({ mesh: dot, t: k / dotCount });
        }
    }

    // Fault effects
    const crackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const sprayOrigin = new THREE.Vector3(mid.x, R + 0.05, mid.z);
    let halo = null;

    if (status === 'leak') {
        group.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.04, 32), crackMat));
        addSpray(sprayOrigin, 12, 1.6, 0.5, 0.045);
        addPuddle(mid.x, mid.z, 0.45, CONFIG.colors.water, 0.5, g + 0.07);
    } else if (status === 'burst') {
        group.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 1.05, R * 1.05, 0.12, 32), crackMat));
        const crackRing = new THREE.Mesh(
            new THREE.TorusGeometry(R + 0.05, 0.04, 8, 32),
            new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xdc2626, emissiveIntensity: 1 })
        );
        crackRing.rotation.x = Math.PI / 2;
        group.add(crackRing);
        halo = new THREE.Mesh(
            new THREE.SphereGeometry(0.7, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.18 })
        );
        group.add(halo);
        addSpray(sprayOrigin, 28, 3.8, 2.2, 0.065);
        addPuddle(mid.x, mid.z, 1.1, CONFIG.colors.water, 0.5, g + 0.07);
    } else if (status === 'blockage') {
        const plug = new THREE.Mesh(
            new THREE.CylinderGeometry(R * 0.8, R * 0.8, 0.6, 16),
            new THREE.MeshStandardMaterial({ color: 0x3b2f2f, roughness: 1 })
        );
        group.add(plug);
    }

    if (status !== 'normal') {
        const tag = makeLabel(info.label, 3.0, LEVEL_CSS[info.level]);
        tag.position.set(mid.x, R + 0.9, mid.z);
        world.add(tag);
        layerItems.labels.push(tag);
        addBeacon(mid.x, mid.z, color, info.level === 'bad' ? 1.0 : 0.5);
    }

    pipeVisuals.push({
        group,
        basePos: group.position.clone(),
        glassMat, collarMat, halo,
        level: info.level,
        vibrate: status === 'high_pressure',
        particles, speed, yMin, yMax
    });
}

// The last station discharges into the river
function addOutfall(lastPos, lastPipe) {
    const g = CONFIG.groundY;
    const paintMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.paint, metalness: 0.55, roughness: 0.28 });
    const steelMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.steel, metalness: 0.7, roughness: 0.35 });
    const y = g + 0.95;
    const startZ = lastPos.z + 0.55;
    const len = 1.5;
    const tipZ = startZ + len;

    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, len, 24), paintMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(lastPos.x, y, startZ + len / 2);
    pipe.castShadow = true;
    world.add(pipe);

    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 24), steelMat);
    flange.rotation.x = Math.PI / 2;
    flange.position.set(lastPos.x, y, tipZ);
    world.add(flange);

    // Water only gushes out while the last section is actually carrying flow
    const flowing = lastPipe
        && lastPipe.condition_status !== 'no_supply'
        && (lastPipe.downstream.flow || 0) >= 1;
    if (flowing) {
        const landingZ = 4.2; // lands in the river
        addSpray(new THREE.Vector3(lastPos.x, y, tipZ + 0.1), 26, 0.8, 0.35, 0.05, { x: 0, z: (landingZ - tipZ) / 0.6 });
        addPuddle(lastPos.x, landingZ, 0.55, 0xffffff, 0.55, g + 0.07);
    }
}

// Floating dashboard above the network, with glowing data lines to every station
function addHub(pipes, stations, positions, levels) {
    const hubPos = new THREE.Vector3(0, 4.7, -2.5);
    const dash = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeDashboardTexture(pipes), transparent: true }));
    dash.scale.set(4.4, 2.75, 1);
    dash.position.copy(hubPos);
    world.add(dash);
    layerItems.data.push(dash);

    const start = new THREE.Vector3(0, hubPos.y - 1.4, hubPos.z);
    const glowTex = makeGlowTexture();

    stations.forEach((station, i) => {
        const level = levels[station.site_id] || 'ok';
        const lineColor = level === 'ok' ? CONFIG.colors.network : LEVEL_COLOR[level];
        const end = new THREE.Vector3(positions[i].x, CONFIG.badgeY + 0.55, positions[i].z);

        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([start, end]),
            new THREE.LineBasicMaterial({ color: lineColor, transparent: true, opacity: 0.6 })
        );
        world.add(line);
        layerItems.data.push(line);

        // Light pulses travelling along the line, like data flowing to the dashboard
        for (let k = 0; k < 2; k++) {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: glowTex, color: lineColor, transparent: true,
                blending: THREE.AdditiveBlending, depthWrite: false
            }));
            sprite.scale.set(0.5, 0.5, 1);
            world.add(sprite);
            pulses.push({ sprite, a: end, b: start, t: k * 0.5, speed: 0.3 });
            layerItems.data.push(sprite);
        }
    });
}

// Rebuilds the whole data-driven model from the latest /api/pipes data
function buildScene(pipes) {
    clearWorld();

    const { stations, indexById } = collectStations(pipes);
    const levels = computeStationLevels(pipes);

    // Spread stations along the x axis, zig-zagging slightly in depth so it reads as 3D
    const positions = stations.map((s, i) =>
        new THREE.Vector3(
            (i - (stations.length - 1) / 2) * CONFIG.stationSpacing,
            0,
            i % 2 === 0 ? 0.8 : -0.8
        )
    );

    addPad(positions);
    addStations(stations, positions, levels);

    pipes.forEach(pipe => {
        addPipe(pipe, positions[indexById[pipe.upstream.site_id]], positions[indexById[pipe.downstream.site_id]]);
    });

    const lastIndex = stations.length - 1;
    const lastPipe = pipes.find(p => p.downstream.site_id === stations[lastIndex].site_id);
    addOutfall(positions[lastIndex], lastPipe);

    addHub(pipes, stations, positions, levels);

    applyLayers();
    fitStationCount = stations.length;
    fitCamera();

    // If something is selected, keep it selected and refresh its numbers
    if (selected) {
        const list = selected.type === 'pipe' ? focusTargets.pipes : focusTargets.stations;
        const spot = list[selected.id];
        if (spot) focus = { x: spot.x, z: spot.z };
        renderPanel();
    }
}

// ============================================================
// 3D view: animation
// ============================================================

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    const time = now / 1000;

    runTour(now);

    // Ease the camera and the view centre towards where they should be
    const ease = Math.min(1, dt * 3);
    pan.position.x += ((focus ? -focus.x : 0) - pan.position.x) * ease;
    pan.position.z += ((focus ? -focus.z : 0) - pan.position.z) * ease;
    camera.position.y += (camTargetY - camera.position.y) * ease;
    camera.position.z += (camTargetZ - camera.position.z) * ease;
    camera.lookAt(0, CONFIG.camera.lookAtY, 0);

    // The user's rotation, plus a gentle sway while they are not dragging
    root.rotation.x = view.rotX;
    root.rotation.y = view.rotY + (userActive ? 0 : 0.05 * Math.sin(time * 0.4));

    // The river slides slowly
    if (riverTexture) riverTexture.offset.x = (time * 0.03) % 1;

    pipeVisuals.forEach(v => {
        // Faulty pipes pulse; serious faults pulse faster
        if (v.level !== 'ok') {
            const rate = v.level === 'bad' ? 6 : 3;
            const pulse = Math.sin(time * rate);
            v.glassMat.emissiveIntensity = 0.2 + 0.15 * pulse;
            v.collarMat.emissiveIntensity = 0.55 + 0.4 * pulse;
        }

        if (v.halo) {
            const s = 1 + 0.2 * Math.sin(time * 8);
            v.halo.scale.set(s, s, s);
        }

        // High pressure makes the pipe shake slightly
        if (v.vibrate) {
            v.group.position.set(
                v.basePos.x + 0.012 * Math.sin(time * 45),
                v.basePos.y + 0.012 * Math.sin(time * 52),
                v.basePos.z
            );
        }

        v.particles.forEach(p => {
            p.t = (p.t + dt * v.speed) % 1;
            p.mesh.position.y = v.yMin + p.t * (v.yMax - v.yMin);
        });
    });

    droplets.forEach(d => stepDroplet(d, dt));

    puddles.forEach(p => {
        const s = p.base + 0.06 * Math.sin(time * 1.5);
        p.mesh.scale.set(s, s, s);
    });

    // Alarm rings grow outward and fade
    beacons.forEach(b => {
        const p = (time * b.speed + b.phase) % 1;
        const s = 0.6 + p * 3.4;
        b.ring.scale.set(s, s, s);
        b.mat.opacity = 0.7 * (1 - p);
    });

    // Data pulses travelling to the dashboard
    pulses.forEach(p => {
        p.t = (p.t + dt * p.speed) % 1;
        p.sprite.position.lerpVectors(p.a, p.b, p.t);
        p.sprite.material.opacity = Math.sin(p.t * Math.PI);
    });

    // Needles ease towards the real reading and tremble very slightly
    gauges.forEach(gz => {
        const cur = gz.pivot.rotation.z;
        const next = cur + (gz.target - cur) * Math.min(1, dt * 3);
        gz.pivot.rotation.z = next + 0.002 * Math.sin(time * 25);
        lastNeedle[gz.siteId] = next;
    });

    // Station lights: steady when fine, pulsing when something is wrong
    statusLights.forEach(l => {
        l.mat.emissiveIntensity = l.level === 'ok' ? 0.9 : 0.7 + 0.5 * Math.sin(time * 5);
    });

    renderer.render(scene, camera);
}

// ============================================================
// Loading
// ============================================================

const threeReady = initThree();

async function loadPipes() {
    const grid = document.getElementById('pipe-grid');
    const summary = document.getElementById('pipe-summary');

    let pipes;
    try {
        pipes = await apiGet('/pipes');
    } catch (err) {
        grid.innerHTML = '<p>Could not reach the backend.</p>';
        console.error(err);
        return;
    }

    latestPipes = pipes;

    if (pipes.length === 0) {
        grid.innerHTML = '<p>No pipe sections have been set up yet.</p>';
        summary.textContent = '';
        if (threeReady) {
            clearWorld();
            selectTarget(null);
        }
        return;
    }

    const faults = pipes.filter(p => p.condition_status !== 'normal').length;
    summary.textContent = faults === 0
        ? `All ${pipes.length} pipe sections are operating normally`
        : `${faults} of ${pipes.length} pipe sections need attention`;

    grid.innerHTML = pipes.map(cardHtml).join('');

    if (threeReady) buildScene(pipes);
}

loadPipes();
setInterval(loadPipes, CONFIG.refreshMs);

feather.replace();