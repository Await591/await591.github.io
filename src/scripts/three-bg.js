import * as THREE from 'three';
import { state } from './state.js';

/* ─── Configuration ──────────────────────────────────────────────────────── */
const MAX_PARTICLES        = 500;  // upper bound for buffer allocation
const FG_MOTE_COUNT        = 90;   // small foreground particle layer
const CONNECTION_THRESHOLD = 2.6;
const MAX_CONNECTIONS      = 700;  // max LineSegments endpoints (pairs × 2)
/* Particles are seeded as small even-sided polygons (hexagon/octagon/
 * decagon/dodecagon) rather than uniform random — each cluster has a
 * "disordered" base position (random within a small bbox) and an
 * "ordered" target position on a regular polygon. When the cursor lingers
 * near a cluster centre, the cluster smoothly snaps from disorder to the
 * ordered polygon. Connections are drawn only between particles inside a
 * radius around the cursor's world point, so lines follow the gaze. */
const POLYGON_SIDES        = [6, 8, 10, 12];
const TARGET_PARTICLES     = 360;  // approximate; actual = sum of cluster sizes
const CLUSTER_SCATTER      = 1.8;  // disorder radius around polygon center
const POLYGON_RADIUS_MIN   = 1.3;
const POLYGON_RADIUS_MAX   = 2.4;
const MOUSE_LINK_RADIUS    = 6.5;  // world-units; particles inside link to each other
const ORDER_RADIUS         = 5.5;  // cluster <-> mouse distance threshold for snap-to-polygon
/* Ripple parameters — significantly tightened from the previous version so
 * a click no longer launches a wave that crosses the whole field. */
const RIPPLE_MAX_R         = 7;    // world-units; max ripple effect radius
const RIPPLE_PEAK_SPEED    = 6;    // world-units (peak band radius at age=1)
const RIPPLE_BAND          = 1.8;  // band width for the wavefront
const RIPPLE_PUSH          = 0.85; // peak displacement magnitude

/* ─── Module-level scene references ─────────────────────────────────────── */
let renderer, scene, camera;
let particleSystem, icoMesh, icoMeshSmall, connectionLines;
let motes;
let particleBasePositions;     // disordered base (Float32Array)
let particleOrderedPositions;  // polygon-vertex target (Float32Array)
let particleClusterIdx;        // Int32Array: which cluster each particle belongs to
let clusters = [];             // [{cx, cy, cz, sides, radius, rot, startIdx}]
let clusterOrderEased;         // Float32Array: per-cluster smoothed 0..1 "ordered" amount
let activeParticleCount = 0;
let moteBasePositions;
const mouse = { x: 0, y: 0 };
const mouseWorld = { x: 0, y: 0, hasValue: false };
let connectionFrameCounter = 0;
/* Reusable scratch buffer so rebuildConnections doesn't allocate every call. */
const _candidateIdx = new Int32Array(MAX_PARTICLES);

/* Ripple state — when the user left-clicks anywhere, the click coords are
 * unprojected into world space and a decaying shockwave is broadcast through
 * the particle field around that point. Multiple ripples can overlap.
 * Pre-allocated scratch buffers reused each frame so the click-burst path
 * doesn't trigger GC churn. */
const ripples = [];
const RIPPLE_LIFETIME_MS = 700;
const MAX_RIPPLES = 8;
const _ripX    = new Float32Array(MAX_RIPPLES);
const _ripY    = new Float32Array(MAX_RIPPLES);
const _ripPeak = new Float32Array(MAX_RIPPLES);
const _ripWave = new Float32Array(MAX_RIPPLES);

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ─── Scene init ─────────────────────────────────────────────────────────── */
export function initThree() {
  if (navigator.webdriver) return;

  const canvas = document.getElementById('scene');
  if (!canvas) return;

  /* Renderer */
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);

  /* Scene + Camera */
  scene  = new THREE.Scene();
  /* Atmospheric fog gives depth-cueing — far meshes fade into the bg colour
   * so the layered geometry reads as receding into space. */
  scene.fog = new THREE.Fog(0x0a0a0a, 22, 60);
  camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 26);

  /* ── Particles — seeded as small even-sided polygon clusters ──
   * For each cluster: random position; pick polygon size (6/8/10/12);
   * each particle gets BOTH a "disordered" base position (random within
   * a small bbox around the cluster centre) AND an "ordered" position
   * on the polygon vertex. The animate loop blends between the two
   * based on cursor proximity. */
  const positions = new Float32Array(MAX_PARTICLES * 3);
  particleOrderedPositions = new Float32Array(MAX_PARTICLES * 3);
  particleClusterIdx = new Int32Array(MAX_PARTICLES);
  clusters = [];

  let idx = 0;
  while (idx < MAX_PARTICLES) {
    const sides = POLYGON_SIDES[Math.floor(Math.random() * POLYGON_SIDES.length)];
    if (idx + sides > MAX_PARTICLES) break;
    if (idx >= TARGET_PARTICLES) break;

    const cx = (Math.random() - 0.5) * 42;
    const cy = (Math.random() - 0.5) * 28;
    const cz = (Math.random() - 0.5) * 18;
    const radius = POLYGON_RADIUS_MIN + Math.random() * (POLYGON_RADIUS_MAX - POLYGON_RADIUS_MIN);
    const rot = Math.random() * Math.PI * 2;
    const cIndex = clusters.length;
    clusters.push({ cx, cy, cz, sides, radius, rot, startIdx: idx });

    for (let v = 0; v < sides; v++) {
      particleClusterIdx[idx] = cIndex;
      // Disordered base
      positions[idx * 3]     = cx + (Math.random() - 0.5) * CLUSTER_SCATTER * 2;
      positions[idx * 3 + 1] = cy + (Math.random() - 0.5) * CLUSTER_SCATTER * 2;
      positions[idx * 3 + 2] = cz + (Math.random() - 0.5) * CLUSTER_SCATTER;
      // Ordered polygon vertex (XY-plane; Z = cluster z)
      const a = rot + (v / sides) * Math.PI * 2;
      particleOrderedPositions[idx * 3]     = cx + Math.cos(a) * radius;
      particleOrderedPositions[idx * 3 + 1] = cy + Math.sin(a) * radius;
      particleOrderedPositions[idx * 3 + 2] = cz;
      idx++;
    }
  }
  activeParticleCount = idx;
  particleBasePositions = positions.slice(0, activeParticleCount * 3);
  clusterOrderEased = new Float32Array(clusters.length);

  const particlesGeo = new THREE.BufferGeometry();
  particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // Only the first `activeParticleCount` slots are valid; the rest are ignored.
  particlesGeo.setDrawRange(0, activeParticleCount);

  const particlesMat = new THREE.PointsMaterial({
    color: getCSSVar('--primary') || '#33ff00',
    size: 0.09,
    transparent: true,
    opacity: 0.72,
    sizeAttenuation: true,
  });

  particleSystem = new THREE.Points(particlesGeo, particlesMat);
  scene.add(particleSystem);

  /* ── Connection Lines (network graph) ── */
  // Pre-allocate a fixed buffer; setDrawRange controls how many are visible
  const linePositions = new Float32Array(MAX_CONNECTIONS * 6);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  lineGeo.setDrawRange(0, 0);

  const lineMat = new THREE.LineBasicMaterial({
    color: getCSSVar('--primary') || '#33ff00',
    transparent: true,
    opacity: 0.12,
  });

  connectionLines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(connectionLines);
  rebuildConnections(); // initial pass

  /* ── Wireframe Icosahedron (large, off-center) ── */
  const icoGeo = new THREE.IcosahedronGeometry(3.2, 1);
  const icoMat = new THREE.MeshBasicMaterial({
    color: getCSSVar('--muted') || '#1f521f',
    wireframe: true,
    transparent: true,
    opacity: 0.20,
    fog: true,
  });
  icoMesh = new THREE.Mesh(icoGeo, icoMat);
  icoMesh.position.set(8, 2.5, -6);
  scene.add(icoMesh);

  /* ── Smaller secondary icosahedron on the opposite side ── */
  const icoGeoSmall = new THREE.IcosahedronGeometry(1.6, 0);
  const icoMatSmall = new THREE.MeshBasicMaterial({
    color: getCSSVar('--muted') || '#1f521f',
    wireframe: true,
    transparent: true,
    opacity: 0.16,
    fog: true,
  });
  icoMeshSmall = new THREE.Mesh(icoGeoSmall, icoMatSmall);
  icoMeshSmall.position.set(-9, -3.4, -10);
  scene.add(icoMeshSmall);

  /* ── Foreground motes — small fast particles closer to camera ── */
  const motePositions = new Float32Array(FG_MOTE_COUNT * 3);
  for (let i = 0; i < FG_MOTE_COUNT; i++) {
    motePositions[i * 3]     = (Math.random() - 0.5) * 28;
    motePositions[i * 3 + 1] = (Math.random() - 0.5) * 18;
    motePositions[i * 3 + 2] =  6 + Math.random() * 8; // closer to camera
  }
  moteBasePositions = motePositions.slice();
  const motesGeo = new THREE.BufferGeometry();
  motesGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motesMat = new THREE.PointsMaterial({
    color: getCSSVar('--secondary') || '#ffb000',
    size: 0.06,
    transparent: true,
    opacity: 0.55,
    sizeAttenuation: true,
    fog: true,
  });
  motes = new THREE.Points(motesGeo, motesMat);
  scene.add(motes);

  /* ── Mouse parallax + world-space projection for cursor-centered links ── */
  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    /* Project NDC -> z=0 plane in world space. We reuse this each frame so
     * the connection-graph candidate set follows the cursor. */
    const ndc = new THREE.Vector3(mouse.x, -mouse.y, 0.5).unproject(camera);
    const dir = ndc.sub(camera.position).normalize();
    if (Math.abs(dir.z) > 1e-6) {
      const t = -camera.position.z / dir.z;
      mouseWorld.x = camera.position.x + dir.x * t;
      mouseWorld.y = camera.position.y + dir.y * t;
      mouseWorld.hasValue = true;
    }
  }, { passive: true });

  /* ── Resize ── */
  window.addEventListener('resize', onResize);

  /* ── Cross-module events ── */
  document.addEventListener('await591:theme-change',  updateThreeColors);
  document.addEventListener('await591:motion-change', (e) => {
    state.motionEnabled = e.detail.enabled;
  });

  /* Click-burst → world-space shockwave. Unproject screen px to a point on
   * the camera's z=0 plane so the ripple lines up with where the user clicked
   * in the visible scene. */
  document.addEventListener('await591:click-burst', (e) => {
    const { x, y } = e.detail || {};
    if (typeof x !== 'number' || typeof y !== 'number') return;
    const ndc = new THREE.Vector3(
      (x / window.innerWidth)  *  2 - 1,
      (y / window.innerHeight) * -2 + 1,
      0.5,
    );
    ndc.unproject(camera);
    const dir = ndc.sub(camera.position).normalize();
    // Solve for t where camera.position + dir*t lands on z=0
    const t = -camera.position.z / dir.z;
    const world = camera.position.clone().add(dir.multiplyScalar(t));
    ripples.push({ x: world.x, y: world.y, born: performance.now() });
    if (ripples.length > MAX_RIPPLES) ripples.shift();
  });

  animate();
}

/* ─── Rebuild connection LineSegments ───────────────────────────────────── */
/* Candidates are restricted to particles inside MOUSE_LINK_RADIUS of the
 * cursor's world-space position. This collapses the previous O(N²) inner
 * loop (≈125k checks per rebuild) to O(K²) where K is typically 30–80,
 * which is what the user feels as the post-click frame-rate fix.
 * If the mouse hasn't moved yet we fall back to a small global subset so
 * the scene doesn't appear empty. */
function rebuildConnections() {
  if (!particleSystem || !connectionLines) return;

  const pos     = particleSystem.geometry.attributes.position;
  const arr     = pos.array;
  const linePos = connectionLines.geometry.attributes.position;
  const lineArr = linePos.array;
  let   pairIdx = 0;

  /* Collect particle indices near the cursor (XY-only — depth is shallow). */
  let candCount = 0;
  const mx = mouseWorld.x;
  const my = mouseWorld.y;
  const radSq = MOUSE_LINK_RADIUS * MOUSE_LINK_RADIUS;
  if (mouseWorld.hasValue) {
    for (let i = 0; i < activeParticleCount; i++) {
      const dx = arr[i * 3]     - mx;
      const dy = arr[i * 3 + 1] - my;
      if (dx * dx + dy * dy < radSq) {
        _candidateIdx[candCount++] = i;
      }
    }
  } else {
    /* Pre-cursor fallback: sample a small subset so we still draw something. */
    for (let i = 0; i < activeParticleCount; i += 6) _candidateIdx[candCount++] = i;
  }

  const threshSq = CONNECTION_THRESHOLD * CONNECTION_THRESHOLD;
  for (let a = 0; a < candCount && pairIdx < MAX_CONNECTIONS; a++) {
    const i  = _candidateIdx[a];
    const ix = i * 3;
    const ax = arr[ix], ay = arr[ix + 1], az = arr[ix + 2];
    for (let b = a + 1; b < candCount && pairIdx < MAX_CONNECTIONS; b++) {
      const j  = _candidateIdx[b];
      const jx = j * 3;
      const dx = ax - arr[jx];
      const dy = ay - arr[jx + 1];
      const dz = az - arr[jx + 2];
      if (dx * dx + dy * dy + dz * dz < threshSq) {
        const base = pairIdx * 6;
        lineArr[base]     = ax;
        lineArr[base + 1] = ay;
        lineArr[base + 2] = az;
        lineArr[base + 3] = arr[jx];
        lineArr[base + 4] = arr[jx + 1];
        lineArr[base + 5] = arr[jx + 2];
        pairIdx++;
      }
    }
  }

  connectionLines.geometry.setDrawRange(0, pairIdx * 2);
  linePos.needsUpdate = true;
}

/* ─── Update material colours after theme change ────────────────────────── */
export function updateThreeColors() {
  if (!particleSystem) return;
  const primary   = getCSSVar('--primary');
  const secondary = getCSSVar('--secondary');
  const muted     = getCSSVar('--muted');
  particleSystem.material.color.set(primary);
  connectionLines.material.color.set(primary);
  icoMesh.material.color.set(muted);
  if (icoMeshSmall) icoMeshSmall.material.color.set(muted);
  if (motes)        motes.material.color.set(secondary);
}

/* ─── Resize handler ─────────────────────────────────────────────────────── */
function onResize() {
  if (!renderer || !camera) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/* ─── Main animation loop ────────────────────────────────────────────────── */
function animate() {
  state.animationFrame = requestAnimationFrame(animate);
  if (!renderer || !scene || !camera) return;

  const time = performance.now() * 0.00016;

  if (state.motionEnabled) {
    /* Slow global rotation of particle field */
    particleSystem.rotation.y = time * 1.15;
    particleSystem.rotation.x = Math.sin(time * 1.3) * 0.07;

    /* Decay old ripples */
    const now = performance.now();
    for (let i = ripples.length - 1; i >= 0; i--) {
      if (now - ripples[i].born > RIPPLE_LIFETIME_MS) ripples.splice(i, 1);
    }

    /* Hoist ripple parameters out of the inner loop — these are the same for
     * every particle so we don't want to recompute age/wave per particle.
     * Squared-distance gating on `RIP_MAX_R_SQ` lets us skip the sqrt for the
     * majority of particle/ripple pairs. RIP_MAX_R was tightened from 14 to
     * 7 so a single click only disturbs a small ring around it. */
    const rN = Math.min(ripples.length, MAX_RIPPLES);
    for (let r = 0; r < rN; r++) {
      const age = (now - ripples[r].born) / RIPPLE_LIFETIME_MS;
      _ripX[r] = ripples[r].x;
      _ripY[r] = ripples[r].y;
      _ripPeak[r] = age * RIPPLE_PEAK_SPEED;
      _ripWave[r] = Math.sin(age * Math.PI);
    }
    const RIP_MAX_R_SQ = RIPPLE_MAX_R * RIPPLE_MAX_R;

    /* Cluster ordering — smoothly lerp each cluster's `order` value toward
     * 1 when the cursor is within ORDER_RADIUS of its centre, else toward 0.
     * This single per-cluster pass is much cheaper than checking the cursor
     * distance once per particle. */
    const cN = clusters.length;
    const ORDER_RADIUS_SQ = ORDER_RADIUS * ORDER_RADIUS;
    for (let c = 0; c < cN; c++) {
      let target = 0;
      if (mouseWorld.hasValue) {
        const cl = clusters[c];
        const dx = mouseWorld.x - cl.cx;
        const dy = mouseWorld.y - cl.cy;
        const dSq = dx * dx + dy * dy;
        if (dSq < ORDER_RADIUS_SQ) {
          target = 1 - Math.sqrt(dSq) / ORDER_RADIUS;
        }
      }
      // Asymmetric easing — order builds slowly (snap-to feels deliberate)
      // and decays a bit faster (cursor leaving feels responsive).
      const k = target > clusterOrderEased[c] ? 0.06 : 0.10;
      clusterOrderEased[c] += (target - clusterOrderEased[c]) * k;
    }

    /* Per-particle breathing / drift + polygon-snap blend + ripple push */
    const pos = particleSystem.geometry.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < activeParticleCount; i++) {
      const ix = i * 3;
      const order = clusterOrderEased[particleClusterIdx[i]];
      const disorder = 1 - order;

      // Breathing drift — scaled down by `disorder` so ordered polygons
      // hold their shape cleanly instead of jiggling.
      const bx = particleBasePositions[ix]     + Math.sin(time * 10 + i * 0.17) * 0.34 * disorder;
      const by = particleBasePositions[ix + 1] + Math.sin(time * 14 + i * 0.23) * 0.27 * disorder;

      // Lerp between disordered base + drift and the ordered polygon vertex.
      let px = bx + (particleOrderedPositions[ix]     - bx) * order;
      let py = by + (particleOrderedPositions[ix + 1] - by) * order;

      for (let r = 0; r < rN; r++) {
        const dx = px - _ripX[r];
        const dy = py - _ripY[r];
        const dSq = dx * dx + dy * dy;
        if (dSq < 0.000001 || dSq > RIP_MAX_R_SQ) continue;
        const d = Math.sqrt(dSq);
        const band = 1 - Math.abs(d - _ripPeak[r]) / RIPPLE_BAND;
        if (band <= 0) continue;
        const push = _ripWave[r] * band * RIPPLE_PUSH;
        const inv = push / d;
        px += dx * inv;
        py += dy * inv;
      }

      arr[ix]     = px;
      arr[ix + 1] = py;
      // Z stays at base — no per-frame Z update needed.
      arr[ix + 2] = particleBasePositions[ix + 2] +
        (particleOrderedPositions[ix + 2] - particleBasePositions[ix + 2]) * order;
    }
    pos.needsUpdate = true;

    /* Briefly brighten connection lines while a ripple is active. Reuse the
     * already-computed ripWave array — Math.max(...arr.map(...)) allocates
     * per frame and was a measurable cost during click bursts. */
    let liveRipple = 0;
    for (let r = 0; r < rN; r++) {
      if (_ripWave[r] > liveRipple) liveRipple = _ripWave[r];
    }
    connectionLines.material.opacity = 0.12 + liveRipple * 0.35;

    /* Rebuild network connections — more often when the cursor is moving so
     * the cursor-centered link cluster keeps up, but throttle harder while
     * ripples are active so we keep frame-rate during the click burst. */
    connectionFrameCounter++;
    const rebuildEvery = rN > 0 ? 8 : 4;
    if (connectionFrameCounter % rebuildEvery === 0) rebuildConnections();

    /* Icosahedron rotation */
    icoMesh.rotation.x += 0.0025;
    icoMesh.rotation.y += 0.004;
    icoMesh.rotation.z += 0.002;

    /* Smaller icosahedron — opposite spin axis for visual contrast */
    icoMeshSmall.rotation.x -= 0.003;
    icoMeshSmall.rotation.y += 0.0055;
    icoMeshSmall.rotation.z -= 0.0015;

    /* Foreground motes — drift faster + opposite Y so the layers read as
     * counter-flowing depth */
    const motePos = motes.geometry.attributes.position;
    for (let i = 0; i < FG_MOTE_COUNT; i++) {
      motePos.setX(i, moteBasePositions[i * 3]     + Math.sin(time * 18 + i * 0.31) * 0.55);
      motePos.setY(i, moteBasePositions[i * 3 + 1] + Math.cos(time * 22 + i * 0.27) * 0.45);
    }
    motePos.needsUpdate = true;
    motes.rotation.z = time * 0.4;

    /* Camera mouse-parallax lerp */
    camera.position.x += (mouse.x *  1.4 - camera.position.x) * 0.018;
    camera.position.y += (-mouse.y * 0.9 - camera.position.y) * 0.018;
    camera.lookAt(0, 0, 0);
  }

  renderer.render(scene, camera);
}
