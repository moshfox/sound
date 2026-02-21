import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, addDoc, serverTimestamp,
  query, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/** TU CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyCaqfhSsRJ7YWUXmO9WiONWMOTZXlJWzeA",
  authDomain: "calculadoravip-9a0a3.firebaseapp.com",
  projectId: "calculadoravip-9a0a3",
  storageBucket: "calculadoravip-9a0a3.firebasestorage.app",
  messagingSenderId: "517200718717",
  appId: "1:517200718717:web:8545e974fc980f792ffa14",
  measurementId: "G-PKQV5241GQ"
};

const ADMIN_EMAIL = "hodely@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// UI (Auth)
const authModal = document.getElementById("authModal");
const authMsg = document.getElementById("authMsg");
const emailEl = document.getElementById("email");
const passEl = document.getElementById("pass");
const btnLogin = document.getElementById("btnLogin");
const btnSignup = document.getElementById("btnSignup");
const btnLogout = document.getElementById("btnLogout");

// UI (Top)
const userLabel = document.getElementById("userLabel");
const userRole = document.getElementById("userRole");
const statusMsg = document.getElementById("statusMsg");
const modeSub = document.getElementById("modeSub");
const modeChip = document.getElementById("modeChip");
const volLabel = document.getElementById("volLabel");
const btnCalibrate = document.getElementById("btnCalibrate");

// UI (Board)
const grid = document.getElementById("grid");
const search = document.getElementById("search");

// UI (Admin Drawer)
const btnAdminToggle = document.getElementById("btnAdminToggle");
const adminDrawer = document.getElementById("adminDrawer");
const btnAdminClose = document.getElementById("btnAdminClose");
const tabs = document.querySelectorAll(".tab");
const tabControl = document.getElementById("tab-control");
const tabSounds = document.getElementById("tab-sounds");
const tabUsers = document.getElementById("tab-users");

// Admin Control
const btnModeLocal = document.getElementById("btnModeLocal");
const btnModeGlobal = document.getElementById("btnModeGlobal");
const volSlider = document.getElementById("volSlider");
const allowPlayToggle = document.getElementById("allowPlayToggle");
const btnStopAll = document.getElementById("btnStopAll");
const adminControlMsg = document.getElementById("adminControlMsg");

// Admin Sounds
const dropZone = document.getElementById("dropZone");
const soundName = document.getElementById("soundName");
const soundUrl = document.getElementById("soundUrl");
const btnAddSound = document.getElementById("btnAddSound");
const btnTestUrl = document.getElementById("btnTestUrl");
const adminMsg = document.getElementById("adminMsg");
const soundsList = document.getElementById("soundsList");
const usersList = document.getElementById("usersList");

// Overlays (Mode + Lock)
const modeOverlay = document.getElementById("modeOverlay");
const modeInner = document.getElementById("modeInner");
const modeFront = document.getElementById("modeFront");
const modeBack = document.getElementById("modeBack");
const modeFromTitle = document.getElementById("modeFromTitle");
const modeFromDesc = document.getElementById("modeFromDesc");
const modeToTitle = document.getElementById("modeToTitle");
const modeToDesc = document.getElementById("modeToDesc");
const lockOverlay = document.getElementById("lockOverlay");

// --- AUDIO (1 player global para STOP) ---
const player = new Audio();
player.preload = "auto";
let globalVolume = 0.7;

function setPlayerVolume(v01){
  globalVolume = Math.max(0, Math.min(1, v01));
  player.volume = globalVolume;
  volLabel.textContent = `${Math.round(globalVolume * 100)}%`;
}
function playUrl(url){
  if (!url) return;
  player.pause();
  player.currentTime = 0;
  player.src = url;
  player.volume = globalVolume;
  player.play().catch(()=>{});
}
function stopAudio(){
  try { player.pause(); player.currentTime = 0; } catch(_) {}
}

// --- CALIBRACIÓN (BEEP) ---
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
async function beepTest() {
  ensureAudio();
  await audioCtx.resume();
  const ctx = ensureAudio();
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.28);
}

// --- HELPERS ---
function safeName(name){
  return (name || "").trim().replace(/[^\w\-\. ]+/g, "_").slice(0, 80);
}
function looksLikeAudioUrl(url){
  const u = (url || "").trim();
  return /^https?:\/\/.+/i.test(u) && /\.(mp3|wav|ogg)(\?|#|$)/i.test(u);
}
function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// --- STATE ---
let currentUserDoc = null;
let appConfig = { mode: "local", volume: 0.7, allowPlay: true };
let soundsCache = [];

// 🔥 ESTA es la clave: modo realmente mostrado en pantalla (no el de Firestore)
let shownMode = null;

// unsub
let unsubUser=null, unsubSounds=null, unsubState=null, unsubUsers=null, unsubConfig=null;

// --- AUTH UI ---
btnLogin.onclick = async () => {
  authMsg.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
  } catch (e) {
    authMsg.textContent = `Firebase: ${e.code || e.message}`;
  }
};
btnSignup.onclick = async () => {
  authMsg.textContent = "";
  try {
    const cred = await createUserWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
    await ensureUserDoc(cred.user);
  } catch (e) {
    authMsg.textContent = `Firebase: ${e.code || e.message}`;
  }
};
btnLogout.onclick = async () => { await signOut(auth); };

// --- ADMIN DRAWER ---
btnAdminToggle.onclick = () => adminDrawer.classList.toggle("hidden");
btnAdminClose.onclick = () => adminDrawer.classList.add("hidden");

// Tabs
tabs.forEach(t => {
  t.onclick = () => {
    tabs.forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    const which = t.dataset.tab;
    tabControl.classList.toggle("hidden", which !== "control");
    tabSounds.classList.toggle("hidden", which !== "sounds");
    tabUsers.classList.toggle("hidden", which !== "users");
  };
});

// --- ADMIN CHECK ---
function isAdminNow(user){
  return ((user?.email || "").toLowerCase() === ADMIN_EMAIL) || (currentUserDoc?.role === "admin");
}

// --- USER DOC ensure + admin email ---
async function ensureUserDoc(user) {
  const uref = doc(db, "users", user.uid);
  const usnap = await getDoc(uref);
  const isAdminEmail = (user.email || "").toLowerCase() === ADMIN_EMAIL;

  if (!usnap.exists()) {
    await setDoc(uref, {
      email: user.email,
      role: isAdminEmail ? "admin" : "user",
      disabled: false,
      canBroadcast: true,
      calibrated: false,
      createdAt: serverTimestamp()
    }, { merge: true });
    return;
  }

  const data = usnap.data();
  if (isAdminEmail && data.role !== "admin") {
    await setDoc(uref, { role: "admin" }, { merge: true });
  }
}

// --- ensure appConfig exists (admin) ---
async function ensureAppConfigExistsIfAdmin(isAdmin){
  if (!isAdmin) return;
  const cref = doc(db, "appConfig", "config");
  const csnap = await getDoc(cref);
  if (!csnap.exists()) {
    await setDoc(cref, {
      mode: "local",
      volume: 0.7,
      allowPlay: true,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}

// --- MODE OVERLAY ANIMATION ---
function modeText(mode){
  if (mode === "global") return { title: "GLOBAL", desc: "Suena en todos" };
  return { title: "LOCAL", desc: "Solo suena en tu PC" };
}

// Inicializa la carta SIN animación al modo actual (para que si entras ya en GLOBAL, se vea bien)
function initModeVisual(mode){
  mode = (mode === "global") ? "global" : "local";

  // Texto coherente (front y back igual, no se verá overlay)
  const t = modeText(mode);
  modeFromTitle.textContent = t.title;
  modeFromDesc.textContent = t.desc;
  modeToTitle.textContent = t.title;
  modeToDesc.textContent = t.desc;

  modeFront.classList.remove("local","global");
  modeBack.classList.remove("local","global");
  modeFront.classList.add(mode);
  modeBack.classList.add(mode);

  modeInner.classList.add("noAnim");
  modeInner.classList.remove("toGlobal","toLocal");
  modeInner.classList.add(mode === "global" ? "toGlobal" : "toLocal");
  void modeInner.offsetWidth;
  modeInner.classList.remove("noAnim");
}

// Animación FROM -> TO (dirección correcta)
function showModeSwitch(fromMode, toMode){
  fromMode = (fromMode === "global") ? "global" : "local";
  toMode   = (toMode === "global")   ? "global" : "local";

  const from = modeText(fromMode);
  const to = modeText(toMode);

  modeFromTitle.textContent = from.title;
  modeFromDesc.textContent = from.desc;
  modeToTitle.textContent = to.title;
  modeToDesc.textContent = to.desc;

  // IMPORTANT: nada de toggle
  modeFront.classList.remove("local","global");
  modeBack.classList.remove("local","global");
  modeFront.classList.add(fromMode); // FROM (cara inicial)
  modeBack.classList.add(toMode);    // TO (cara final)

  // Show overlay
  modeOverlay.classList.remove("hidden","out");

  // 1) Setear estado inicial (FROM) sin animación
  modeInner.classList.add("noAnim");
  modeInner.classList.remove("toGlobal","toLocal");
  modeInner.classList.add(fromMode === "global" ? "toGlobal" : "toLocal");
  void modeInner.offsetWidth;

  // 2) Animar al TO
  modeInner.classList.remove("noAnim");
  modeInner.classList.remove("toGlobal","toLocal");
  modeInner.classList.add(toMode === "global" ? "toGlobal" : "toLocal");

  // cerrar overlay
  clearTimeout(showModeSwitch._t);
  showModeSwitch._t = setTimeout(() => {
    modeOverlay.classList.add("out");
    setTimeout(() => modeOverlay.classList.add("hidden"), 230);
  }, 1150);
}

// --- EMIT GLOBAL (play/stop) ---
async function emitSoundOrStop({ action, soundId=null }) {
  const user = auth.currentUser;
  if (!user) return;

  const now = Date.now();
  const playAtMs = now + 650;
  const nonce = Math.random().toString(36).slice(2) + "-" + now;

  try {
    await setDoc(doc(db, "soundState", "state"), {
      action,
      soundId: soundId || null,
      by: user.uid,
      playAtMs,
      nonce,
      updatedAt: serverTimestamp()
    }, { merge: true });

    statusMsg.textContent = action === "stop" ? "STOP ALL ✅" : "Emitido ✅";
  } catch (e) {
    statusMsg.textContent = "No se pudo emitir (permiso/calibración).";
  }
}

// --- RENDER GRID ---
function renderGrid(filterText=""){
  const q = (filterText || "").toLowerCase().trim();
  const filtered = q ? soundsCache.filter(s => s.name.toLowerCase().includes(q)) : soundsCache;

  grid.innerHTML = "";
  if (!filtered.length){
    grid.innerHTML = `<div class="muted">No hay sonidos. (Admin: añade URLs)</div>`;
    return;
  }

  const user = auth.currentUser;
  const admin = isAdminNow(user);
  const mode = (appConfig?.mode === "global") ? "global" : "local";
  const allowPlay = (appConfig?.allowPlay !== false);

  // 🔥 Si allowPlay=false, SOLO admin puede tocar
  const allowTouch = allowPlay || admin;

  const canBroadcast = allowTouch
    && !currentUserDoc?.disabled
    && !!currentUserDoc?.calibrated
    && !!currentUserDoc?.canBroadcast;

  filtered.forEach(s => {
    const btn = document.createElement("div");
    btn.className = "soundBtn";

    const badgeText = mode === "global" ? "GLOBAL" : "LOCAL";
    const badgeClass = mode === "global" ? "ok" : "no";

    btn.innerHTML = `
      <div class="badge ${badgeClass}">${badgeText}</div>
      <div>
        <div class="soundName">${escapeHtml(s.name)}</div>
        <div class="soundMeta">${
          allowTouch
            ? (mode === "global" ? "Click emite (si tienes permiso)" : "Click local")
            : "Bloqueado por admin"
        }</div>
      </div>
      <div class="soundMeta">${allowTouch ? "Click para sonar" : "—"}</div>
    `;

    btn.onclick = async () => {
      if (!allowTouch) return;

      if (mode === "local") {
        // Local = suena en tu PC
        playUrl(s.url);
        return;
      }

      // Global: NO suena local aquí (evita doble). Suena por listener global (incluye emisor).
      if (!canBroadcast) {
        statusMsg.textContent = "No puedes emitir global (sin calibrar o sin permiso).";
        return;
      }
      await emitSoundOrStop({ action: "play", soundId: s.id });
    };

    grid.appendChild(btn);
  });
}
search.addEventListener("input", () => renderGrid(search.value));

// --- APPLY CONFIG TO UI (CORRECTO) ---
function applyConfigToUI(){
  const user = auth.currentUser;
  const admin = isAdminNow(user);

  const mode = (appConfig?.mode === "global") ? "global" : "local";
  const vol = Number(appConfig?.volume);
  const volume = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 0.7;
  const allowPlay = (appConfig?.allowPlay !== false);

  // top labels
  modeSub.textContent = `Modo: ${mode.toUpperCase()}`;
  modeChip.textContent = (mode === "global") ? "🌍 GLOBAL" : "📍 LOCAL";

  // volume
  setPlayerVolume(volume);
  volSlider.value = String(Math.round(globalVolume * 100));

  // lock overlay SOLO para no-admin
  const lockedForThisUser = (!allowPlay) && !admin;
  lockOverlay.classList.toggle("hidden", !lockedForThisUser);

  // reflect admin controls
  allowPlayToggle.checked = allowPlay;
  btnModeLocal.classList.toggle("active", mode === "local");
  btnModeGlobal.classList.toggle("active", mode === "global");

  // 🔥 animación correcta siempre:
  // - primera vez: inicializa visualmente (sin overlay)
  // - siguientes: anima FROM -> TO
  if (shownMode === null) {
    shownMode = mode;
    initModeVisual(mode);
  } else if (mode !== shownMode) {
    showModeSwitch(shownMode, mode);
    shownMode = mode;
  }

  // rerender
  renderGrid(search.value);
}

// --- ADMIN CONTROL EVENTS ---
async function setAppConfig(patch){
  const user = auth.currentUser;
  if (!isAdminNow(user)) return;

  adminControlMsg.textContent = "";
  try {
    await setDoc(doc(db, "appConfig", "config"), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
    adminControlMsg.textContent = "Actualizado ✅";
  } catch (e) {
    adminControlMsg.textContent = `Error: ${e.code || e.message}`;
  }
}
btnModeLocal.onclick = async () => setAppConfig({ mode: "local" });
btnModeGlobal.onclick = async () => setAppConfig({ mode: "global" });

let volDebounce = null;
volSlider.oninput = () => {
  setPlayerVolume(Number(volSlider.value) / 100);
  clearTimeout(volDebounce);
  volDebounce = setTimeout(() => setAppConfig({ volume: Number(volSlider.value) / 100 }), 250);
};
allowPlayToggle.onchange = async () => setAppConfig({ allowPlay: allowPlayToggle.checked });
btnStopAll.onclick = async () => emitSoundOrStop({ action: "stop" });

// --- ADMIN SOUNDS ---
btnTestUrl.onclick = () => {
  const url = (soundUrl.value || "").trim();
  if (!looksLikeAudioUrl(url)) return alert("URL no directa a .mp3/.wav/.ogg");
  playUrl(url);
};

btnAddSound.onclick = async () => {
  adminMsg.textContent = "";
  const name = safeName(soundName.value);
  const url = (soundUrl.value || "").trim();
  if (!name) return (adminMsg.textContent = "Pon un nombre.");
  if (!looksLikeAudioUrl(url)) return (adminMsg.textContent = "Pon una URL directa a .mp3/.wav/.ogg");

  try {
    await addDoc(collection(db, "sounds"), { name, url, createdAt: serverTimestamp() });
    adminMsg.textContent = "Añadido ✅";
    soundName.value = "";
    soundUrl.value = "";
  } catch (e) {
    adminMsg.textContent = `Error: ${e.code || e.message}`;
  }
};

dropZone.addEventListener("dragover", (e)=>{ e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", ()=> dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e)=>{
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const f = e.dataTransfer.files?.[0];
  if (!f) return;
  soundName.value = safeName(f.name);
  adminMsg.textContent = `Archivo detectado: ${f.name}. Pega la URL directa.`;
});

function renderSoundsList(admin){
  soundsList.innerHTML = "";
  if (!soundsCache.length){
    soundsList.innerHTML = `<div class="muted">No hay sonidos.</div>`;
    return;
  }
  soundsCache.forEach(s => {
    const it = document.createElement("div");
    it.className = "item";
    it.innerHTML = `
      <div class="itemTitle">${escapeHtml(s.name)}</div>
      <div class="itemSub">${escapeHtml(s.url)}</div>
      <div class="itemBtns">
        <button class="btn ghost" data-act="play">Probar</button>
        <button class="btn danger" data-act="del" ${admin ? "" : "disabled"}>Borrar</button>
      </div>
    `;
    it.querySelector('[data-act="play"]').onclick = () => playUrl(s.url);
    it.querySelector('[data-act="del"]').onclick = async () => {
      if (!confirm(`¿Borrar "${s.name}"?`)) return;
      await deleteDoc(doc(db, "sounds", s.id));
    };
    soundsList.appendChild(it);
  });
}

function renderUsersList(users){
  usersList.innerHTML = "";
  if (!users.length){
    usersList.innerHTML = `<div class="muted">No hay usuarios.</div>`;
    return;
  }
  users.forEach(u => {
    const it = document.createElement("div");
    it.className = "item";
    it.innerHTML = `
      <div class="itemTitle">${escapeHtml(u.email || u.id)}</div>
      <div class="itemSub">role: ${u.role || "user"} • disabled: ${u.disabled ? "sí" : "no"} • canBroadcast: ${u.canBroadcast ? "sí" : "no"} • calibrated: ${u.calibrated ? "sí" : "no"}</div>
      <div class="itemBtns">
        <button class="btn ghost" data-act="toggleDisabled">${u.disabled ? "Habilitar" : "Deshabilitar"}</button>
        <button class="btn ghost" data-act="toggleBroadcast">${u.canBroadcast ? "Quitar emitir" : "Permitir emitir"}</button>
        <button class="btn ghost" data-act="resetCalib">Reset calibración</button>
      </div>
    `;
    it.querySelector('[data-act="toggleDisabled"]').onclick = async () => {
      await updateDoc(doc(db, "users", u.id), { disabled: !u.disabled });
    };
    it.querySelector('[data-act="toggleBroadcast"]').onclick = async () => {
      await updateDoc(doc(db, "users", u.id), { canBroadcast: !u.canBroadcast });
    };
    it.querySelector('[data-act="resetCalib"]').onclick = async () => {
      await updateDoc(doc(db, "users", u.id), { calibrated: false });
    };
    usersList.appendChild(it);
  });
}

// Calibrar
btnCalibrate.onclick = async () => {
  const u = auth.currentUser;
  if (!u) return;
  await beepTest();
  const ok = confirm("¿Has oído el beep claramente? Si no, sube el volumen y repite.");
  if (!ok) return;
  try { await updateDoc(doc(db, "users", u.uid), { calibrated: true }); } catch(_){}
};

// --- LIVE LISTENERS ---
onAuthStateChanged(auth, async (user) => {
  cleanup();
  shownMode = null; // <- reset visual mode when session changes

  if (!user) {
    currentUserDoc = null;
    authModal.style.display = "flex";
    userLabel.textContent = "No sesión";
    userRole.textContent = "—";
    btnLogout.classList.add("hidden");
    btnAdminToggle.classList.add("hidden");
    statusMsg.textContent = "";
    grid.innerHTML = "";
    lockOverlay.classList.add("hidden");
    return;
  }

  authModal.style.display = "none";
  btnLogout.classList.remove("hidden");

  await ensureUserDoc(user);

  // User doc listener
  unsubUser = onSnapshot(doc(db, "users", user.uid), async (snap) => {
    currentUserDoc = snap.data();

    userLabel.textContent = currentUserDoc?.email || user.email || "usuario";
    userRole.textContent = currentUserDoc?.role || "user";

    const admin = isAdminNow(user);
    btnAdminToggle.classList.toggle("hidden", !admin);

    if (currentUserDoc?.disabled) statusMsg.textContent = "Estás deshabilitado por un admin.";
    else if (!currentUserDoc?.calibrated) statusMsg.textContent = "Calibra para poder emitir (si el modo es GLOBAL).";
    else if (!currentUserDoc?.canBroadcast) statusMsg.textContent = "Sin permiso para emitir global (si el modo es GLOBAL).";
    else statusMsg.textContent = "";

    await ensureAppConfigExistsIfAdmin(admin);

    // No fuerces shownMode aquí: deja que applyConfigToUI lo haga con config real
    renderGrid(search.value);
    renderSoundsList(admin);
  });

  // App config listener
  unsubConfig = onSnapshot(doc(db, "appConfig", "config"), (snap) => {
    if (snap.exists()) appConfig = snap.data();
    applyConfigToUI();
  });

  // Sounds
  unsubSounds = onSnapshot(query(collection(db, "sounds"), orderBy("createdAt", "desc")), (snap) => {
    soundsCache = [];
    snap.forEach(d => {
      const s = d.data();
      soundsCache.push({ id: d.id, name: s.name, url: s.url });
    });
    renderGrid(search.value);
    renderSoundsList(isAdminNow(user));
  });

  // Global play/stop
  let lastNonceLocal = null;
  unsubState = onSnapshot(doc(db, "soundState", "state"), (snap) => {
    if (!snap.exists()) return;
    const ev = snap.data();
    if (!ev?.nonce || ev.nonce === lastNonceLocal) return;
    lastNonceLocal = ev.nonce;

    if (currentUserDoc?.disabled) return;

    if (ev.action === "stop") {
      stopAudio();
      return;
    }

    if (ev.action === "play") {
      const s = soundsCache.find(x => x.id === ev.soundId);
      if (!s?.url) return;
      const delay = Math.max(0, (ev.playAtMs || Date.now()) - Date.now());
      setTimeout(() => playUrl(s.url), delay);
    }
  });

  // Users list for admin (solo el email admin para simplificar)
  if (((user.email || "").toLowerCase() === ADMIN_EMAIL)) {
    unsubUsers = onSnapshot(query(collection(db, "users"), orderBy("email", "asc")), (snap) => {
      const users = [];
      snap.forEach(d => users.push({ id: d.id, ...d.data() }));
      renderUsersList(users);
    });
  }
});

function cleanup(){
  if (unsubUser) { unsubUser(); unsubUser=null; }
  if (unsubConfig) { unsubConfig(); unsubConfig=null; }
  if (unsubSounds) { unsubSounds(); unsubSounds=null; }
  if (unsubState) { unsubState(); unsubState=null; }
  if (unsubUsers) { unsubUsers(); unsubUsers=null; }

}
