import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const Q = new URLSearchParams(location.search);
const FF = parseFloat(Q.get('t') || '0');

// ---------- renderer/scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d10);
scene.fog = new THREE.Fog(0x0b0d10, 8, 20);
const camera = new THREE.PerspectiveCamera(40, 2, 0.1, 100);
camera.position.set(0, 2.1, 4.6);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.45, 0);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0x39424e, 0.7));
const key = new THREE.SpotLight(0xffffff, 90, 25, 0.7, 0.5, 1.3);
key.position.set(0, 6, 2.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x7fa8ff, 0.5); rim.position.set(-3, 2, -3); scene.add(rim);

// ---------- shared geometry/materials ----------
const tableMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.8 });
const table = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.08, 2.6), tableMat);
table.position.y = -0.04; table.receiveShadow = true; scene.add(table);
const divider = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 2.6), new THREE.MeshStandardMaterial({ color: 0x2a2f36 }));
divider.position.set(0, 0.25, 0); scene.add(divider);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x101318, roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.081; floor.receiveShadow = true; scene.add(floor);

const BLOCK = 0.13;
const blockColors = [0x3b82f6, 0x4ade80, 0xfacc15, 0xf87171, 0xc084fc, 0x38bdf8];
function makeBlock() {
  const m = new THREE.Mesh(new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK),
    new THREE.MeshStandardMaterial({ color: blockColors[(Math.random() * blockColors.length) | 0], roughness: 0.5 }));
  m.castShadow = true; return m;
}

// ---------- arm ----------
const WHITE = new THREE.MeshStandardMaterial({ color: 0xe9ebee, roughness: 0.35, metalness: 0.25 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.45, metalness: 0.4 });
const ACCENT_S = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 });
const ACCENT_R = new THREE.MeshStandardMaterial({ color: 0xf87171, roughness: 0.4 });

function makeArm(accent) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.07, 20), DARK);
  base.position.y = 0.035; base.castShadow = true;
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), accent);
  shoulder.position.y = 0.12;
  const L1 = 0.42, L2 = 0.42;
  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, L1, 6, 12), WHITE);
  const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, L2, 6, 12), WHITE);
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), DARK);
  const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), accent);
  const gripL = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.07, 0.03), DARK);
  const gripR = gripL.clone();
  upper.castShadow = fore.castShadow = true;
  g.add(base, shoulder, upper, fore, elbow, wrist, gripL, gripR);
  return { g, base, shoulder, upper, fore, elbow, wrist, gripL, gripR, L1, L2 };
}

const _up = new THREE.Vector3(0, 1, 0);
function placeSeg(mesh, a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(_up, d.normalize());
}
// pose arm so gripper center reaches local target (arm group space)
function poseArm(arm, target, gripOpen) {
  const S = new THREE.Vector3(0, 0.12, 0);
  const yaw = Math.atan2(target.x - S.x, target.z - S.z);
  const r = Math.hypot(target.x - S.x, target.z - S.z);
  let d = Math.hypot(r, target.y - S.y);
  const maxD = (arm.L1 + arm.L2) * 0.98, minD = 0.12;
  d = THREE.MathUtils.clamp(d, minD, maxD);
  const h = target.y - S.y;
  const cosA = THREE.MathUtils.clamp((arm.L1 * arm.L1 + d * d - arm.L2 * arm.L2) / (2 * arm.L1 * d), -1, 1);
  const a = Math.acos(cosA);
  const elev = Math.atan2(h, r);
  const th1 = elev + a;                       // shoulder angle from horizontal (in the r-y plane)
  const E = new THREE.Vector3(Math.sin(yaw) * Math.cos(th1) * arm.L1, S.y + Math.sin(th1) * arm.L1, Math.cos(yaw) * Math.cos(th1) * arm.L1);
  const W2 = new THREE.Vector3(Math.sin(yaw) * r, target.y, Math.cos(yaw) * r);
  placeSeg(arm.upper, S, E);
  placeSeg(arm.fore, E, W2);
  arm.elbow.position.copy(E);
  arm.wrist.position.copy(W2);
  const down = new THREE.Vector3(0, -0.055, 0);
  arm.gripL.position.copy(W2).add(down); arm.gripR.position.copy(W2).add(down);
  arm.gripL.position.x += Math.cos(yaw) * gripOpen; arm.gripL.position.z -= Math.sin(yaw) * gripOpen;
  arm.gripR.position.x -= Math.cos(yaw) * gripOpen; arm.gripR.position.z += Math.sin(yaw) * gripOpen;
  return W2;
}

// ---------- a cell: one arm + its task world ----------
const STACK_N = 6;
function makeCell(cx, noisy, accent) {
  const arm = makeArm(accent);
  arm.g.position.set(cx, 0, 0.55);
  scene.add(arm.g);
  const cell = {
    arm, noisy, cx,
    pickup: new THREE.Vector3(cx + 0.02, BLOCK / 2, 1.05),   // in world
    stackBase: new THREE.Vector3(cx, BLOCK / 2, 0.12),
    stack: [], supply: null, carried: null,
    phase: 0, t: 0, jitter: new THREE.Vector3(), slipAt: -1,
    attempts: 0, successes: 0, towers: 0, history: [],
    flash: 0,
  };
  spawnSupply(cell);
  return cell;
}
function spawnSupply(cell) {
  const b = makeBlock();
  b.position.copy(cell.pickup);
  scene.add(b);
  cell.supply = b;
}
const smooth = k => k * k * (3 - 2 * k);

// waypoints: [pos(world), gripOpen, duration]
function waypoints(cell) {
  const j = cell.noisy ? cell.jitter : ZERO;
  const st = cell.stackBase.clone(); st.y += cell.stack.length * BLOCK;
  const up = new THREE.Vector3(0, 0.30, 0);
  const pk = cell.pickup.clone().add(j);
  const sk = st.clone().add(j);
  return [
    [pk.clone().add(up), 0.05, 0.55],
    [pk, 0.05, 0.4],
    [pk, 0.008, 0.3],                     // close grip
    [pk.clone().add(up), 0.008, 0.45],
    [sk.clone().add(up), 0.008, 0.6],
    [sk, 0.008, 0.4],
    [sk, 0.05, 0.3],                      // release
    [sk.clone().add(up), 0.05, 0.45],
  ];
}
const ZERO = new THREE.Vector3();
const HOME = new THREE.Vector3(0, 0.5, 0);   // arm-local-ish above base

const P = { noise: 45, drift: 35, speed: 100 };
let driftVec = new THREE.Vector3();
for (const k of ['noise', 'drift', 'speed']) {
  const el = document.getElementById(k);
  if (Q.has(k)) { el.value = +Q.get(k); P[k] = +Q.get(k); }
  el.addEventListener('input', () => P[k] = +el.value);
}
document.getElementById('recal').onclick = () => { driftVec.set(0, 0, 0); };
document.getElementById('reset').onclick = () => init();

function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }

const cells = [makeCell(-1.35, false, ACCENT_S), makeCell(1.35, true, ACCENT_R)];

function startCycle(cell) {
  cell.phase = 0; cell.t = 0;
  if (cell.noisy) {
    const n = P.noise / 100 * 0.055;
    cell.jitter.set(gauss() * n, gauss() * n * 0.4, gauss() * n).add(driftVec);
    cell.slipAt = Math.random() < (P.noise / 100) * 0.30 ? 0.3 + Math.random() * 0.5 : -1;
  }
}

// falling blocks
const debris = [];
function dropBlock(b, vel) {
  debris.push({ b, age: 0, vel: vel || new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.4, (Math.random() - 0.5) * 0.6), spin: new THREE.Vector3(gauss() * 3, gauss() * 3, gauss() * 3) });
}

function stepCell(cell, dt) {
  const wps = waypoints(cell);
  if (cell.phase >= wps.length) {          // cycle complete
    startCycle(cell);
    return;
  }
  const [target, grip, dur] = wps[cell.phase];
  cell.t += dt;
  const total = dur / (P.speed / 100);
  const k = Math.min(1, cell.t / total);
  // from previous waypoint (or home)
  const prev = cell.phase === 0 ? cell.arm.g.localToWorld(HOME.clone()) : waypoints(cell)[cell.phase - 1][0];
  const p = prev.clone().lerp(target, smooth(k));
  // grip slip: mid-carry on the noisy arm
  if (cell.noisy && cell.carried && cell.slipAt > 0 && cell.phase >= 3 && cell.phase <= 5) {
    const carryK = (cell.phase - 3 + k) / 2.6;
    if (carryK >= cell.slipAt) {
      const b = cell.carried; cell.carried = null;
      dropBlock(b, new THREE.Vector3(gauss() * 0.8, 0.2, gauss() * 0.8));
      cell.slipAt = -1;
      cell.failed = true;
    }
  }
  const wristLocal = cell.arm.g.worldToLocal(p.clone());
  poseArm(cell.arm, wristLocal, grip);
  if (cell.carried) {
    cell.carried.position.copy(p).add(new THREE.Vector3(0, -0.11, 0));
  }
  if (k >= 1) {
    // events on phase end
    if (cell.phase === 2 && cell.supply && !cell.failed) {   // gripped
      cell.carried = cell.supply; cell.supply = null;
    }
    if (cell.phase === 6) {                                   // released
      cell.attempts++;
      if (cell.carried) {
        const b = cell.carried; cell.carried = null;
        const dx = Math.hypot(b.position.x - cell.stackBase.x, b.position.z - cell.stackBase.z);
        if (!cell.failed && dx < BLOCK * 0.55) {
          b.position.set(cell.stackBase.x, BLOCK / 2 + cell.stack.length * BLOCK, cell.stackBase.z);
          cell.stack.push(b); cell.successes++;
          if (cell.stack.length >= STACK_N) {
            cell.towers++; cell.flash = 1;
            for (const sb of cell.stack) scene.remove(sb);
            cell.stack = [];
          }
        } else dropBlock(b, new THREE.Vector3(gauss() * 0.5, 0.1, gauss() * 0.5));
      } else if (!cell.failed) { /* nothing carried: shouldn't happen on sim arm */ }
      cell.failed = false;
      if (!cell.supply) spawnSupply(cell);
    }
    cell.phase++; cell.t = 0;
  }
  cell.flash = Math.max(0, cell.flash - dt * 1.5);
}

// ---------- metrics ----------
const cyclesEl = document.getElementById('cycles');
const chart = document.getElementById('chart'), cctx = chart.getContext('2d');
const roll = [];
function metrics() {
  const [sim, real] = cells;
  const sr = sim.attempts ? sim.successes / sim.attempts : 1;
  const rr = real.attempts ? real.successes / real.attempts : 1;
  simRate.textContent = (sr * 100).toFixed(0) + '%';
  realRate.textContent = (rr * 100).toFixed(0) + '%';
  gap.textContent = 'gap ' + Math.max(0, (sr - rr) * 100).toFixed(0) + '%';
  simTowers.textContent = sim.towers; realTowers.textContent = real.towers;
  cyclesEl.textContent = real.attempts;
  cctx.fillStyle = '#0b0d10'; cctx.fillRect(0, 0, 360, 70);
  cctx.fillStyle = '#7d8a97'; cctx.font = '9px JetBrains Mono';
  cctx.fillText('"real" rolling success rate', 8, 12);
  if (roll.length > 1) {
    cctx.strokeStyle = '#f87171'; cctx.lineWidth = 1.5; cctx.beginPath();
    roll.forEach((r, i) => {
      const x = 8 + i / 99 * 344, y = 66 - r * 48;
      i ? cctx.lineTo(x, y) : cctx.moveTo(x, y);
    });
    cctx.stroke();
  }
}
let lastRollPush = 0;

// ---------- loop ----------
function init() {
  for (const cell of cells) {
    for (const sb of cell.stack) scene.remove(sb);
    cell.stack = []; cell.attempts = 0; cell.successes = 0; cell.towers = 0;
    if (cell.carried) { scene.remove(cell.carried); cell.carried = null; }
    startCycle(cell);
  }
  driftVec.set(0, 0, 0);
  roll.length = 0;
}
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const sdt = dt * (P.speed / 100);
  // calibration drift accrues on the "real" arm
  driftVec.x += (P.drift / 100) * sdt * 0.012 * (Math.random() > 0.5 ? 1 : -0.6);
  driftVec.x = THREE.MathUtils.clamp(driftVec.x, -0.09, 0.09);
  driftVec.z += (P.drift / 100) * sdt * 0.01 * (Math.random() > 0.5 ? 1 : -0.6);
  driftVec.z = THREE.MathUtils.clamp(driftVec.z, -0.07, 0.07);
  for (const cell of cells) stepCell(cell, sdt);
  // debris physics
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.age += dt;
    if (d.age > 18) { scene.remove(d.b); debris.splice(i, 1); continue; }
    d.vel.y -= 4 * dt;
    d.b.position.addScaledVector(d.vel, dt);
    d.b.rotation.x += d.spin.x * dt; d.b.rotation.z += d.spin.z * dt;
    if (d.b.position.y < BLOCK / 2) {
      d.b.position.y = BLOCK / 2;
      d.vel.y *= -0.25; d.vel.x *= 0.6; d.vel.z *= 0.6;
      d.spin.multiplyScalar(0.5);
      if (d.vel.length() < 0.25) debris.splice(i, 1);
    }
  }
  if (performance.now() - lastRollPush > 900) {
    const real = cells[1];
    roll.push(real.attempts ? real.successes / real.attempts : 1);
    if (roll.length > 100) roll.shift();
    lastRollPush = performance.now();
  }
  metrics();
  controls.update();
  renderer.render(scene, camera);
}
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  if (camera.aspect < 1) {
    camera.fov = 58;
    camera.position.set(0, 3.0, 8.2);
  } else {
    camera.fov = 40;
    camera.position.set(0, 2.1, 4.6);
  }
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
init();
if (FF > 0) { const s = 1 / 60; let t = 0; while (t < FF) { stepCell(cells[0], s); stepCell(cells[1], s); t += s; } }
resize();
frame();
