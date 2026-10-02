/**
 * ========================================================================================
 * Frontend Engine: Wi-Fi AP Placement Optimizer
 * DAA Project: Greedy Maximum Coverage Algorithm
 * ========================================================================================
 */

// Application State
const state = {
    classrooms: [],
    candidates: [],
    selectedAPs: [],
    iterations: [],
    coveredRoomIds: new Set(),
    uncoveredRoomIds: new Set(),
    
    // Tool and Drag state
    currentMode: 'add', // 'add', 'move', 'delete'
    isDragging: false,
    draggedIndex: null,
    dragOffset: { x: 0, y: 0 },
    mousePos: { x: 0, y: 0 },

    // Parameters
    maxAps: 4,
    coverageRadius: 130,
    gridStep: 60,

    // Toggles
    showGrid: true,
    showCandidates: true,
    showCoverage: true,
    showRays: true,

    // Animation & Stepping
    isStepping: false,
    stepTimer: null,
    currentStepIdx: 0,
    presetsData: {}
};

// Canvas & Context References
let canvas, ctx;
const ROOM_RADIUS = 18;
const AP_RADIUS = 14;

// Auto-increment counter for newly created classrooms
let roomCounter = 1;

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    initCanvas();
    initEventListeners();
    await loadPresetsFromServer();
    
    // Load default preset: Engineering L-Shape
    loadPreset('engineering_l_shape');
});

function initCanvas() {
    canvas = document.getElementById('floorplan-canvas');
    ctx = canvas.getContext('2d');

    // Handle high DPI displays for razor-sharp rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Set internal resolution based on intrinsic width/height
    canvas.width = 940 * dpr;
    canvas.height = 560 * dpr;
    ctx.scale(dpr, dpr);

    // Initial render
    requestAnimationFrame(render);
}

// -----------------------------------------------------------------------------
// Event Listeners
// -----------------------------------------------------------------------------
function initEventListeners() {
    // Mode toggles
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentMode = btn.dataset.mode;
            updateModeHint();
            render();
        });
    });

    // Sliders
    const maxApsSlider = document.getElementById('max-aps-slider');
    const maxApsVal = document.getElementById('max-aps-val');
    maxApsSlider.addEventListener('input', (e) => {
        state.maxAps = parseInt(e.target.value, 10);
        maxApsVal.innerText = state.maxAps;
        updateMetricsSummary();
    });

    const radiusSlider = document.getElementById('radius-slider');
    const radiusVal = document.getElementById('radius-val');
    radiusSlider.addEventListener('input', (e) => {
        state.coverageRadius = parseFloat(e.target.value);
        radiusVal.innerText = `${state.coverageRadius} px`;
        // If APs are placed, update their radius too
        state.selectedAPs.forEach(ap => ap.coverage_radius = state.coverageRadius);
        render();
    });

    // Candidate density
    const stepSelect = document.getElementById('candidate-step-select');
    stepSelect.addEventListener('change', (e) => {
        state.gridStep = parseInt(e.target.value, 10);
        generateCandidates();
    });

    // Action buttons
    document.getElementById('btn-run-optimization').addEventListener('click', () => runOptimization(false));
    document.getElementById('btn-step-by-step').addEventListener('click', () => runOptimization(true));
    document.getElementById('btn-generate-candidates').addEventListener('click', () => generateCandidates());
    document.getElementById('btn-clear-aps').addEventListener('click', clearAPsOnly);
    document.getElementById('btn-reset-all').addEventListener('click', resetAll);

    // Preset selector
    document.getElementById('preset-select').addEventListener('change', (e) => {
        const val = e.target.value;
        if (val !== 'custom') {
            loadPreset(val);
        }
    });

    // Canvas Display Toggles
    document.getElementById('toggle-grid').addEventListener('change', (e) => {
        state.showGrid = e.target.checked;
        render();
    });
    document.getElementById('toggle-candidates').addEventListener('change', (e) => {
        state.showCandidates = e.target.checked;
        render();
    });
    document.getElementById('toggle-coverage').addEventListener('change', (e) => {
        state.showCoverage = e.target.checked;
        render();
    });
    document.getElementById('toggle-rays').addEventListener('change', (e) => {
        state.showRays = e.target.checked;
        render();
    });

    // Canvas Mouse Interactions
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    window.addEventListener('mouseup', onCanvasMouseUp);

    // Modals
    initModalHandlers();
}

function updateModeHint() {
    const hint = document.getElementById('canvas-mode-hint');
    if (state.currentMode === 'add') {
        hint.innerHTML = '<i class="fa-solid fa-circle-info"></i> <strong>Add Mode:</strong> Click anywhere on canvas to place a classroom.';
        canvas.style.cursor = 'crosshair';
    } else if (state.currentMode === 'move') {
        hint.innerHTML = '<i class="fa-solid fa-circle-info"></i> <strong>Move Mode:</strong> Click and drag any classroom to reposition it.';
        canvas.style.cursor = 'grab';
    } else if (state.currentMode === 'delete') {
        hint.innerHTML = '<i class="fa-solid fa-circle-info"></i> <strong>Delete Mode:</strong> Click on a classroom to delete it.';
        canvas.style.cursor = 'not-allowed';
    }
}

// -----------------------------------------------------------------------------
// Mouse & Canvas Interaction Logic
// -----------------------------------------------------------------------------
function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = (canvas.width / (window.devicePixelRatio || 1)) / rect.width;
    const scaleY = (canvas.height / (window.devicePixelRatio || 1)) / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function findClassroomAt(x, y) {
    for (let i = state.classrooms.length - 1; i >= 0; i--) {
        const room = state.classrooms[i];
        const dist = Math.hypot(room.x - x, room.y - y);
        if (dist <= ROOM_RADIUS + 6) {
            return i;
        }
    }
    return -1;
}

function onCanvasMouseMove(e) {
    const pos = getCanvasCoordinates(e);
    state.mousePos = pos;
    document.getElementById('canvas-mouse-coords').innerText = `X: ${Math.round(pos.x)}, Y: ${Math.round(pos.y)}`;

    if (state.isDragging && state.draggedIndex !== null) {
        state.classrooms[state.draggedIndex].x = Math.max(30, Math.min(910, pos.x + state.dragOffset.x));
        state.classrooms[state.draggedIndex].y = Math.max(30, Math.min(530, pos.y + state.dragOffset.y));
        render();
        return;
    }

    // Hover cursor feedback
    const hoveredIdx = findClassroomAt(pos.x, pos.y);
    if (hoveredIdx !== -1) {
        if (state.currentMode === 'move') canvas.style.cursor = 'grab';
        else if (state.currentMode === 'delete') canvas.style.cursor = 'pointer';
    } else {
        updateModeHint();
    }
}

function onCanvasMouseDown(e) {
    const pos = getCanvasCoordinates(e);
    const clickedIdx = findClassroomAt(pos.x, pos.y);

    if (state.currentMode === 'add') {
        if (clickedIdx === -1) {
            addClassroomAt(pos.x, pos.y);
        }
    } else if (state.currentMode === 'move') {
        if (clickedIdx !== -1) {
            state.isDragging = true;
            state.draggedIndex = clickedIdx;
            state.dragOffset = {
                x: state.classrooms[clickedIdx].x - pos.x,
                y: state.classrooms[clickedIdx].y - pos.y
            };
            canvas.style.cursor = 'grabbing';
        }
    } else if (state.currentMode === 'delete') {
        if (clickedIdx !== -1) {
            const removed = state.classrooms.splice(clickedIdx, 1)[0];
            showToast(`Removed ${removed.name || removed.id}`);
            generateCandidates();
            recalcCoverageLocally();
            render();
        }
    }
}

function onCanvasMouseUp() {
    if (state.isDragging) {
        state.isDragging = false;
        state.draggedIndex = null;
        updateModeHint();
        generateCandidates();
        recalcCoverageLocally();
        render();
    }
}

function addClassroomAt(x, y, customName = null) {
    const id = `CR-${roomCounter++}`;
    const name = customName || id;
    state.classrooms.push({
        id: id,
        name: name,
        x: Math.round(x),
        y: Math.round(y)
    });

    document.getElementById('preset-select').value = 'custom';
    showToast(`Added classroom ${name}`);
    generateCandidates();
    recalcCoverageLocally();
    render();
}

// -----------------------------------------------------------------------------
// Presets Loading
// -----------------------------------------------------------------------------
async function loadPresetsFromServer() {
    try {
        const resp = await fetch('/api/presets');
        const data = await resp.json();
        if (data.success) {
            state.presetsData = data.presets;
        }
    } catch (err) {
        console.error('Failed to load presets from server:', err);
    }
}

function loadPreset(presetKey) {
    const preset = state.presetsData[presetKey];
    if (!preset) return;

    state.classrooms = JSON.parse(JSON.stringify(preset.classrooms));
    state.maxAps = preset.recommended_aps || 4;
    state.coverageRadius = preset.recommended_radius || 130;

    // Update UI controls
    document.getElementById('max-aps-slider').value = state.maxAps;
    document.getElementById('max-aps-val').innerText = state.maxAps;
    document.getElementById('radius-slider').value = state.coverageRadius;
    document.getElementById('radius-val').innerText = `${state.coverageRadius} px`;

    // Clear previous APs and iterations
    clearAPsOnly();
    generateCandidates();
    showToast(`Loaded ${preset.name}`);
}

// -----------------------------------------------------------------------------
// Candidate Generation (via API with local fallback)
// -----------------------------------------------------------------------------
async function generateCandidates() {
    if (state.classrooms.length === 0) {
        state.candidates = [];
        updateCandBadge();
        render();
        return;
    }

    try {
        const resp = await fetch('/api/generate-candidates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                classrooms: state.classrooms,
                radius: state.coverageRadius,
                grid_step: state.gridStep,
                canvas_width: 940,
                canvas_height: 560
            })
        });
        const data = await resp.json();
        if (data.success) {
            state.candidates = data.candidates;
            updateCandBadge();
            render();
        }
    } catch (err) {
        console.warn('Backend candidate generation error, using fallback:', err);
        generateCandidatesLocal();
    }
}

function generateCandidatesLocal() {
    // Client-side fallback if server is momentarily busy
    const candidates = [];
    let idCounter = 1;
    const step = state.gridStep;
    
    // Grid over classroom bounding box
    const minX = Math.max(30, Math.min(...state.classrooms.map(c => c.x)) - 40);
    const maxX = Math.min(910, Math.max(...state.classrooms.map(c => c.x)) + 40);
    const minY = Math.max(30, Math.min(...state.classrooms.map(c => c.y)) - 40);
    const maxY = Math.min(530, Math.max(...state.classrooms.map(c => c.y)) + 40);

    for (let x = minX; x <= maxX; x += step) {
        for (let y = minY; y <= maxY; y += step) {
            const coversAny = state.classrooms.some(r => Math.hypot(r.x - x, r.y - y) <= state.coverageRadius);
            if (coversAny) {
                candidates.push({ id: `CAND-${idCounter++}`, x, y, type: 'grid' });
            }
        }
    }
    state.candidates = candidates;
    updateCandBadge();
    render();
}

function updateCandBadge() {
    document.getElementById('cand-count-badge').innerText = state.candidates.length;
}

// -----------------------------------------------------------------------------
// DAA Optimization Runner
// -----------------------------------------------------------------------------
async function runOptimization(stepByStep = false) {
    if (state.classrooms.length === 0) {
        showToast('Please add classrooms or load a preset floor plan first!');
        return;
    }

    if (state.candidates.length === 0) {
        await generateCandidates();
    }

    setStatus('Running Greedy Maximum Coverage...');
    document.getElementById('btn-run-optimization').disabled = true;
    document.getElementById('btn-step-by-step').disabled = true;

    try {
        const resp = await fetch('/api/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                classrooms: state.classrooms,
                candidates: state.candidates,
                radius: state.coverageRadius,
                max_aps: state.maxAps
            })
        });

        const data = await resp.json();
        if (!data.success) {
            showToast(data.message || 'Optimization failed.');
            setStatus('Ready');
            return;
        }

        if (stepByStep) {
            playStepByStep(data);
        } else {
            applyOptimizationResult(data);
            showToast(`Optimization complete! Coverage: ${data.coverage_percentage}%`);
        }
    } catch (err) {
        console.error('Optimization error:', err);
        showToast('Error connecting to Flask backend.');
    } finally {
        document.getElementById('btn-run-optimization').disabled = false;
        document.getElementById('btn-step-by-step').disabled = false;
    }
}

function applyOptimizationResult(data) {
    state.selectedAPs = data.selected_aps;
    state.iterations = data.iterations;
    state.coveredRoomIds = new Set(data.covered_classroom_ids.map(String));
    state.uncoveredRoomIds = new Set(data.uncovered_classroom_ids.map(String));

    renderIterationTimeline(state.iterations);
    updateMetrics(data);
    setStatus(`Optimized: ${data.covered_classrooms_count}/${data.total_classrooms} rooms covered`);
    render();
}

function playStepByStep(data) {
    // Clear current APs
    state.selectedAPs = [];
    state.iterations = [];
    state.coveredRoomIds = new Set();
    state.uncoveredRoomIds = new Set(state.classrooms.map(c => String(c.id)));
    clearIterationTimeline();
    render();

    const allSteps = data.iterations;
    const allAPs = data.selected_aps;
    let currentIdx = 0;

    setStatus('Step-by-step simulation active...');

    clearInterval(state.stepTimer);
    state.stepTimer = setInterval(() => {
        if (currentIdx >= allAPs.length) {
            clearInterval(state.stepTimer);
            setStatus(`Step-by-step completed: ${data.coverage_percentage}% coverage`);
            showToast('All greedy iterations completed!');
            return;
        }

        const ap = allAPs[currentIdx];
        const stepLog = allSteps[currentIdx];

        state.selectedAPs.push(ap);
        state.iterations.push(stepLog);
        
        // Add covered rooms
        ap.newly_covered_ids.forEach(id => {
            state.coveredRoomIds.add(String(id));
            state.uncoveredRoomIds.delete(String(id));
        });

        appendIterationCard(stepLog);
        updateLiveProgress(stepLog.cumulative_covered, stepLog.total_classrooms, currentIdx + 1, state.maxAps);
        render();

        currentIdx++;
    }, 900);
}

// -----------------------------------------------------------------------------
// Timeline & Metrics Rendering
// -----------------------------------------------------------------------------
function renderIterationTimeline(iterations) {
    const container = document.getElementById('iteration-timeline');
    container.innerHTML = '';

    if (!iterations || iterations.length === 0) {
        container.innerHTML = `
            <div class="timeline-empty">
                <i class="fa-solid fa-arrow-pointer"></i>
                <p>Click <strong>"Run DAA Optimization"</strong> to see greedy iterations.</p>
            </div>
        `;
        document.getElementById('step-count-badge').innerText = '0 Steps Completed';
        return;
    }

    iterations.forEach(step => appendIterationCard(step));
    document.getElementById('step-count-badge').innerText = `${iterations.length} Iterations Logged`;
}

function appendIterationCard(step) {
    const container = document.getElementById('iteration-timeline');
    
    // Remove empty placeholder if present
    const emptyPlaceholder = container.querySelector('.timeline-empty');
    if (emptyPlaceholder) emptyPlaceholder.remove();

    const card = document.createElement('div');
    card.className = 'iter-card';
    card.innerHTML = `
        <div class="iter-header">
            <div class="iter-title">
                <i class="fa-solid fa-wifi text-primary"></i>
                <span>${step.ap_id} &bull; Iteration #${step.iteration}</span>
            </div>
            <span class="iter-badge-gain">+${step.marginal_gain} New Rooms</span>
        </div>
        <div class="iter-body">
            <div><strong>Coordinates:</strong> (${step.x}, ${step.y}) &bull; <strong>Cumulative:</strong> ${step.cumulative_covered}/${step.total_classrooms} (${step.coverage_percentage}%)</div>
            <div class="iter-rooms-tags">
                ${step.newly_covered_names.map(name => `<span class="room-tag">${name}</span>`).join('')}
            </div>
            <div style="margin-top: 0.35rem; font-size: 0.76rem; color: #94a3b8;">${step.explanation}</div>
        </div>
    `;
    container.appendChild(card);
    container.scrollTop = container.scrollHeight;
}

function clearIterationTimeline() {
    const container = document.getElementById('iteration-timeline');
    container.innerHTML = '';
}

function updateMetrics(data) {
    document.getElementById('metric-total-classrooms').innerText = data.total_classrooms;
    document.getElementById('metric-aps-used').innerText = `${data.aps_used} / ${data.aps_available}`;
    document.getElementById('metric-covered-rooms').innerText = data.covered_classrooms_count;
    document.getElementById('metric-uncovered-rooms').innerText = data.uncovered_classrooms_count;
    document.getElementById('metric-coverage-pct').innerText = `${data.coverage_percentage}%`;
    document.getElementById('metric-progress-fill').style.width = `${data.coverage_percentage}%`;
}

function updateLiveProgress(covered, total, apsUsed, apsAvailable) {
    const pct = total > 0 ? Math.round((covered / total) * 100 * 10) / 10 : 0;
    document.getElementById('metric-total-classrooms').innerText = total;
    document.getElementById('metric-aps-used').innerText = `${apsUsed} / ${apsAvailable}`;
    document.getElementById('metric-covered-rooms').innerText = covered;
    document.getElementById('metric-uncovered-rooms').innerText = total - covered;
    document.getElementById('metric-coverage-pct').innerText = `${pct}%`;
    document.getElementById('metric-progress-fill').style.width = `${pct}%`;
}

function updateMetricsSummary() {
    const total = state.classrooms.length;
    const covered = state.coveredRoomIds.size;
    const pct = total > 0 ? Math.round((covered / total) * 100 * 10) / 10 : 0;

    document.getElementById('metric-total-classrooms').innerText = total;
    document.getElementById('metric-aps-used').innerText = `${state.selectedAPs.length} / ${state.maxAps}`;
    document.getElementById('metric-covered-rooms').innerText = covered;
    document.getElementById('metric-uncovered-rooms').innerText = total - covered;
    document.getElementById('metric-coverage-pct').innerText = `${pct}%`;
    document.getElementById('metric-progress-fill').style.width = `${pct}%`;
}

function recalcCoverageLocally() {
    state.coveredRoomIds.clear();
    state.uncoveredRoomIds.clear();

    state.classrooms.forEach(room => {
        let isCovered = false;
        for (const ap of state.selectedAPs) {
            if (Math.hypot(ap.x - room.x, ap.y - room.y) <= (ap.coverage_radius || state.coverageRadius)) {
                isCovered = true;
                break;
            }
        }
        if (isCovered) {
            state.coveredRoomIds.add(String(room.id));
        } else {
            state.uncoveredRoomIds.add(String(room.id));
        }
    });
    updateMetricsSummary();
}

function clearAPsOnly() {
    clearInterval(state.stepTimer);
    state.selectedAPs = [];
    state.iterations = [];
    state.coveredRoomIds.clear();
    state.uncoveredRoomIds = new Set(state.classrooms.map(c => String(c.id)));
    clearIterationTimeline();
    renderIterationTimeline([]);
    updateMetricsSummary();
    setStatus('APs cleared. Ready to optimize.');
    render();
}

function resetAll() {
    clearInterval(state.stepTimer);
    state.classrooms = [];
    state.candidates = [];
    state.selectedAPs = [];
    state.iterations = [];
    state.coveredRoomIds.clear();
    state.uncoveredRoomIds.clear();
    roomCounter = 1;

    document.getElementById('preset-select').value = 'custom';
    clearIterationTimeline();
    renderIterationTimeline([]);
    updateCandBadge();
    updateMetricsSummary();
    setStatus('Canvas reset. Add classrooms to begin.');
    showToast('Floor plan reset to empty.');
    render();
}

function setStatus(text) {
    document.getElementById('canvas-status').innerText = text;
}

// -----------------------------------------------------------------------------
// HTML5 Canvas Rendering Loop
// -----------------------------------------------------------------------------
function render() {
    const width = 940;
    const height = 560;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Blueprint Background & Grid
    drawBlueprintGrid(width, height);

    // 2. Draw Candidate AP Markers
    if (state.showCandidates && state.candidates.length > 0) {
        drawCandidates();
    }

    // 3. Draw Coverage Radii & Signal Heatmap Waves
    if (state.showCoverage && state.selectedAPs.length > 0) {
        drawCoverageZones();
    }

    // 4. Draw Connecting Rays from APs to Covered Classrooms
    if (state.showRays && state.selectedAPs.length > 0) {
        drawConnectingRays();
    }

    // 5. Draw Classrooms
    drawClassrooms();

    // 6. Draw Placed Access Points
    drawPlacedAPs();
}

function drawBlueprintGrid(w, h) {
    // Deep technical blueprint canvas background
    ctx.fillStyle = '#080d1a';
    ctx.fillRect(0, 0, w, h);

    if (!state.showGrid) return;

    ctx.save();
    // Minor Grid Lines
    ctx.strokeStyle = '#111927';
    ctx.lineWidth = 1;
    const step = 20;

    ctx.beginPath();
    for (let x = 0; x <= w; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Major Grid Lines
    ctx.strokeStyle = '#1a263c';
    ctx.lineWidth = 1.2;
    const majorStep = 100;

    ctx.beginPath();
    for (let x = 0; x <= w; x += majorStep) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += majorStep) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Coordinate tick markers
    ctx.fillStyle = '#334155';
    ctx.font = '9px JetBrains Mono';
    for (let x = 100; x < w; x += 100) {
        ctx.fillText(`${x}`, x + 3, 14);
    }
    for (let y = 100; y < h; y += 100) {
        ctx.fillText(`${y}`, 4, y - 3);
    }

    ctx.restore();
}

function drawCandidates() {
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;

    state.candidates.forEach(cand => {
        // Small crosshair
        const size = 4;
        ctx.beginPath();
        ctx.moveTo(cand.x - size, cand.y);
        ctx.lineTo(cand.x + size, cand.y);
        ctx.moveTo(cand.x, cand.y - size);
        ctx.lineTo(cand.x, cand.y + size);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cand.x, cand.y, 2, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawCoverageZones() {
    ctx.save();
    const colors = [
        { fill: 'rgba(59, 130, 246, 0.16)', stroke: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
        { fill: 'rgba(139, 92, 246, 0.16)', stroke: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.4)' },
        { fill: 'rgba(6, 182, 212, 0.16)', stroke: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)' },
        { fill: 'rgba(16, 185, 129, 0.16)', stroke: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
        { fill: 'rgba(245, 158, 11, 0.16)', stroke: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' }
    ];

    state.selectedAPs.forEach((ap, idx) => {
        const color = colors[idx % colors.length];
        const r = ap.coverage_radius || state.coverageRadius;

        // Radial gradient wave
        const grad = ctx.createRadialGradient(ap.x, ap.y, 0, ap.x, ap.y, r);
        grad.addColorStop(0, color.glow);
        grad.addColorStop(0.7, color.fill);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ap.x, ap.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Perimeter boundary circle
        ctx.strokeStyle = color.stroke;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(ap.x, ap.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    });
    ctx.restore();
}

function drawConnectingRays() {
    ctx.save();
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);

    state.selectedAPs.forEach(ap => {
        const r = ap.coverage_radius || state.coverageRadius;
        state.classrooms.forEach(room => {
            const dist = Math.hypot(ap.x - room.x, ap.y - room.y);
            if (dist <= r) {
                ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)'; // Soft emerald ray
                ctx.beginPath();
                ctx.moveTo(ap.x, ap.y);
                ctx.lineTo(room.x, room.y);
                ctx.stroke();
            }
        });
    });
    ctx.restore();
}

function drawClassrooms() {
    ctx.save();

    state.classrooms.forEach(room => {
        const isCovered = state.coveredRoomIds.has(String(room.id));
        const color = isCovered ? '#10b981' : '#ef4444'; // Emerald green vs Red
        const bgFill = isCovered ? 'rgba(16, 185, 129, 0.22)' : 'rgba(239, 68, 68, 0.22)';

        // Outer glow
        ctx.shadowColor = color;
        ctx.shadowBlur = isCovered ? 12 : 6;

        // Classroom box/circle
        ctx.beginPath();
        ctx.arc(room.x, room.y, ROOM_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = bgFill;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = color;
        ctx.stroke();

        ctx.shadowBlur = 0; // Reset shadow

        // Inner status dot
        ctx.beginPath();
        ctx.arc(room.x, room.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Classroom Name Label
        ctx.font = 'bold 11px Plus Jakarta Sans, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(room.name || room.id, room.x, room.y - ROOM_RADIUS - 4);

        // Subtext status
        ctx.font = '9px JetBrains Mono';
        ctx.fillStyle = isCovered ? '#6ee7b7' : '#fca5a5';
        ctx.textBaseline = 'top';
        ctx.fillText(isCovered ? 'COVERED' : 'UNCOVERED', room.x, room.y + ROOM_RADIUS + 4);
    });

    ctx.restore();
}

function drawPlacedAPs() {
    ctx.save();

    state.selectedAPs.forEach((ap, idx) => {
        // Glowing halo
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 15;

        // Base circle
        ctx.beginPath();
        ctx.arc(ap.x, ap.y, AP_RADIUS, 0, Math.PI * 2);
        const grad = ctx.createLinearGradient(ap.x - AP_RADIUS, ap.y - AP_RADIUS, ap.x + AP_RADIUS, ap.y + AP_RADIUS);
        grad.addColorStop(0, '#3b82f6');
        grad.addColorStop(1, '#8b5cf6');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.shadowBlur = 0; // Reset shadow

        // Wi-Fi icon / wave symbol in center
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ap.x, ap.y - 2, 4, Math.PI * 1.2, Math.PI * 1.8);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(ap.x, ap.y - 2, 7, Math.PI * 1.25, Math.PI * 1.75);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(ap.x, ap.y + 2, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // AP Tag label badge
        ctx.font = 'bold 11px JetBrains Mono';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(ap.ap_id, ap.x, ap.y - AP_RADIUS - 6);
    });

    ctx.restore();
}

// -----------------------------------------------------------------------------
// Modals & Benchmark Engine
// -----------------------------------------------------------------------------
function initModalHandlers() {
    // Viva Guide Modal
    const vivaModal = document.getElementById('viva-modal');
    document.getElementById('btn-viva-guide').addEventListener('click', () => {
        vivaModal.classList.add('show');
    });
    document.getElementById('btn-close-viva').addEventListener('click', () => {
        vivaModal.classList.remove('show');
    });
    document.getElementById('btn-close-viva-footer').addEventListener('click', () => {
        vivaModal.classList.remove('show');
    });

    // Modal Tabs
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            const targetId = tab.dataset.tab;
            const targetPane = document.getElementById(targetId);
            if (targetPane) targetPane.classList.add('active');
        });
    });

    // Benchmark Modal
    const benchModal = document.getElementById('benchmark-modal');
    document.getElementById('btn-benchmark').addEventListener('click', runBenchmark);
    document.getElementById('btn-close-bench').addEventListener('click', () => {
        benchModal.classList.remove('show');
    });
    document.getElementById('btn-close-bench-footer').addEventListener('click', () => {
        benchModal.classList.remove('show');
    });

    // Close modal on outside backdrop click
    [vivaModal, benchModal].forEach(m => {
        m.addEventListener('click', (e) => {
            if (e.target === m) m.classList.remove('show');
        });
    });
}

async function runBenchmark() {
    if (state.classrooms.length === 0) {
        showToast('Please add classrooms or load a preset floor plan first!');
        return;
    }

    const modal = document.getElementById('benchmark-modal');
    const spinner = document.getElementById('benchmark-spinner');
    const results = document.getElementById('benchmark-results');

    modal.classList.add('show');
    spinner.style.display = 'flex';
    results.style.display = 'none';

    try {
        const resp = await fetch('/api/benchmark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                classrooms: state.classrooms,
                candidates: state.candidates,
                radius: state.coverageRadius,
                max_aps: state.maxAps
            })
        });

        const data = await resp.json();
        if (data.success) {
            document.getElementById('bench-greedy-pct').innerText = `${data.greedy.coverage_pct}%`;
            document.getElementById('bench-greedy-rooms').innerText = `${data.greedy.covered_count} / ${data.total_classrooms} rooms covered`;

            document.getElementById('bench-random-pct').innerText = `${data.random_baseline.coverage_pct}%`;
            document.getElementById('bench-random-rooms').innerText = `Avg ${data.random_baseline.avg_covered_count} rooms (${data.random_baseline.trials} trials)`;

            const advBanner = document.getElementById('bench-advantage-banner');
            advBanner.innerHTML = `
                <i class="fa-solid fa-trophy"></i>
                <span>Greedy algorithm delivers a <strong>+${data.greedy_advantage_pct}%</strong> coverage boost over random placement!</span>
            `;

            spinner.style.display = 'none';
            results.style.display = 'block';
        }
    } catch (err) {
        console.error('Benchmark error:', err);
        showToast('Failed to run benchmark.');
        modal.classList.remove('show');
    }
}

// -----------------------------------------------------------------------------
// Toast Notification Utility
// -----------------------------------------------------------------------------
let toastTimer;
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerHTML = `<i class="fa-solid fa-bell"></i> ${msg}`;
    toast.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}
