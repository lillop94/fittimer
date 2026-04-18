// ════════════════════════════════════════════════
//  DATABASE  (IndexedDB via idb)
// ════════════════════════════════════════════════
let db = null;

async function initDB() {
  db = await idb.openDB('fittimer', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('workouts')) {
        db.createObjectStore('workouts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('history')) {
        const hs = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        hs.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('music')) {
        db.createObjectStore('music', { keyPath: 'id', autoIncrement: true });
      }
    }
  });
}

// Workouts CRUD
async function dbGetAllWorkouts() { return await db.getAll('workouts'); }
async function dbSaveWorkout(w)   { await db.put('workouts', w); }
async function dbDeleteWorkout(id){ await db.delete('workouts', id); }

// History
async function dbAddHistory(entry){ await db.add('history', entry); }
async function dbGetHistory()     { return await db.getAll('history'); }
async function dbClearHistory()   { await db.clear('history'); }

// Music
async function dbGetAllTracks()   { return await db.getAll('music'); }
async function dbAddTrack(t)      { return await db.add('music', t); }
async function dbDeleteTrack(id)  { await db.delete('music', id); }
async function dbClearMusic()     { await db.clear('music'); }

// ════════════════════════════════════════════════
//  APP STATE
// ════════════════════════════════════════════════
let workouts = [];
let nextId   = 1;
let globalSettings = { beep:true, mid:true, countdown:false, volume:0.8 };

// ════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════
async function appInit() {
  await initDB();
  workouts = await dbGetAllWorkouts();

  // Seed defaults if empty
  if (workouts.length === 0) {
    const defaults = [
      { id:1, name:'Кардіо інтервали', mode:'timer', prep:10, prepOn:true, work:45, rest:15, sets:8, reps:10,
        bigRest:true, bigRestAfter:4, bigRestTime:60, midSignal:true, countdownSignal:false, badge:'Кардіо', badgeType:'green' },
      { id:2, name:'Табата', mode:'timer', prep:10, prepOn:true, work:20, rest:10, sets:8, reps:10,
        bigRest:false, bigRestAfter:4, bigRestTime:60, midSignal:true, countdownSignal:false, badge:'Інтенсивне', badgeType:'blue' },
      { id:3, name:'Силове тренування', mode:'timer', prep:15, prepOn:true, work:60, rest:30, sets:5, reps:10,
        bigRest:true, bigRestAfter:3, bigRestTime:90, midSignal:false, countdownSignal:false, badge:'Силове', badgeType:'green' },
    ];
    for (const w of defaults) await dbSaveWorkout(w);
    workouts = defaults;
  }

  nextId = Math.max(0, ...workouts.map(w => w.id)) + 1;

  // Load saved music tracks
  const savedTracks = await dbGetAllTracks();
  for (const t of savedTracks) {
    tracks.push({ dbId: t.id, name: t.name, dataUrl: t.dataUrl, duration: t.duration || 0 });
  }
  if (tracks.length > 0) { renderTrackList(); updateMusicPlayerVisibility(); }

  updateHomeCount();
  updateHomeMusicCount();
  await updateHomeHistoryCount();
}

// ════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════
function toggleGS(id) {
  const btn = document.getElementById(id);
  btn.classList.toggle('on');
  globalSettings[id.replace('gs-','')] = btn.classList.contains('on');
}

// ════════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════════
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

async function openWorkouts() {
  renderWorkoutList();
  updateHomeCount();
  show('screen-workouts');
}

function updateHomeCount() {
  const n = workouts.length;
  document.getElementById('home-workout-count').textContent =
    n === 0 ? 'Немає збережених програм'
    : n === 1 ? '1 програма збережена'
    : n < 5  ? `${n} програми збережено`
    : `${n} програм збережено`;
}

async function updateHomeHistoryCount() {
  const h = await dbGetHistory();
  const n = h.length;
  document.getElementById('home-history-count').textContent =
    n === 0 ? 'Немає записів' : `${n} тренувань записано`;
}

// ════════════════════════════════════════════════
//  WORKOUT LIST
// ════════════════════════════════════════════════
function renderWorkoutList() {
  const container = document.getElementById('workout-list');
  container.innerHTML = '';
  if (workouts.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">💪</div><div>Ще немає тренувань.<br>Створіть перше!</div></div>`;
  } else {
    workouts.forEach(w => {
      const card = document.createElement('div');
      card.className = 'workout-card';
      const modeIcon = w.mode === 'reps' ? '🔢' : '⏱';
      const metaText = w.mode === 'reps'
        ? `${w.sets} підходів · ${w.reps || 10} повторень · ${w.rest} сек відпочинок`
        : `${w.sets} підходів · ${w.work} сек робота · ${w.rest} сек відпочинок`;
      card.innerHTML = `
        <div style="padding-right:72px;">
          <div class="workout-name">${esc(w.name)} <span style="font-size:12px;">${modeIcon}</span></div>
          <div class="workout-meta">${metaText}</div>
          <span class="badge badge-${w.badgeType||'green'}">${esc(w.badge||'')}</span>
        </div>
        <div class="workout-card-actions">
          <button class="card-action-btn" onclick="event.stopPropagation();openEdit(${w.id})">✏️</button>
          <button class="card-action-btn delete" onclick="event.stopPropagation();deleteWorkout(${w.id})">🗑</button>
        </div>`;
      card.addEventListener('click', () => startWorkout(w.id));
      container.appendChild(card);
    });
  }
  const addBtn = document.createElement('div');
  addBtn.className = 'add-btn';
  addBtn.textContent = '+ Створити тренування';
  addBtn.onclick = () => openEdit(null);
  container.appendChild(addBtn);
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function deleteWorkout(id) {
  await dbDeleteWorkout(id);
  workouts = workouts.filter(w => w.id !== id);
  renderWorkoutList();
  updateHomeCount();
}

// ════════════════════════════════════════════════
//  EDIT SCREEN
// ════════════════════════════════════════════════
let editingId = null;
let editMode  = 'timer'; // 'timer' | 'reps'
const steppers = { prep:10, work:45, rest:15, sets:8, reps:10, bigrest:4, bigresttime:60 };
const stepMin  = { prep:5, work:5, rest:5, sets:1, reps:1, bigrest:1, bigresttime:10 };
const stepMax  = { prep:60, work:300, rest:120, sets:20, reps:100, bigrest:10, bigresttime:300 };

function openEdit(id) {
  editingId = id;
  const w = id ? workouts.find(x => x.id === id) : null;
  document.getElementById('edit-title').textContent = w ? 'Редагування' : 'Нове тренування';
  document.getElementById('edit-name').value = w ? w.name : '';

  editMode             = w ? (w.mode || 'timer') : 'timer';
  steppers.prep        = w ? (w.prep || 10) : 10;
  steppers.work        = w ? w.work : 45;
  steppers.rest        = w ? w.rest : 15;
  steppers.sets        = w ? w.sets : 8;
  steppers.reps        = w ? (w.reps || 10) : 10;
  steppers.bigrest     = w ? w.bigRestAfter : 4;
  steppers.bigresttime = w ? w.bigRestTime  : 60;

  refreshSteppers();
  applyEditMode();

  const prepOn = w ? (w.prepOn !== false) : true;
  document.getElementById('prep-toggle').className = 'toggle' + (prepOn ? ' on' : '');
  document.getElementById('prep-row-time').style.display = prepOn ? '' : 'none';

  const bigOn = w ? w.bigRest : true;
  document.getElementById('bigrest-toggle').className = 'toggle' + (bigOn ? ' on' : '');
  document.getElementById('bigrest-row-after').style.display = bigOn ? '' : 'none';
  document.getElementById('bigrest-row-time').style.display  = bigOn ? '' : 'none';

  document.getElementById('mid-toggle').className = 'toggle' + ((w ? w.midSignal : true) ? ' on' : '');

  // phase tracks
  const ptOn = w ? (w.phaseTracksOn || false) : false;
  document.getElementById('phasetracks-toggle').className = 'toggle' + (ptOn ? ' on' : '');
  document.getElementById('phasetracks-card').style.opacity = ptOn ? '1' : '0.45';
  document.getElementById('phasetracks-card').style.pointerEvents = ptOn ? '' : 'none';
  editPhaseTrack = { work: w?.phaseTrackWork ?? null, rest: w?.phaseTrackRest ?? null, bigrest: w?.phaseTrackBigrest ?? null };
  refreshPhaseTrackLabels();

  show('screen-edit');
}

function setWorkoutMode(m) {
  editMode = m;
  applyEditMode();
}

function applyEditMode() {
  document.getElementById('mode-tab-timer').classList.toggle('active', editMode === 'timer');
  document.getElementById('mode-tab-reps').classList.toggle('active',  editMode === 'reps');
  document.getElementById('edit-row-work').style.display  = editMode === 'timer' ? '' : 'none';
  document.getElementById('edit-row-reps').style.display  = editMode === 'reps'  ? '' : 'none';
  document.getElementById('mode-sub').textContent =
    editMode === 'timer' ? 'Підхід на час' : 'Підхід на кількість повторень';
  document.getElementById('bigrest-section').style.display       = editMode === 'reps' ? 'none' : '';
  document.getElementById('bigrest-section-label').style.display = editMode === 'reps' ? 'none' : '';
  // фазова музика тільки для таймера
  document.getElementById('phase-music-section').style.display   = editMode === 'reps' ? 'none' : '';
}

function refreshSteppers() {
  Object.keys(steppers).forEach(k => {
    const el = document.getElementById(k + '-val');
    if (el) el.textContent = steppers[k];
  });
}

function change(key, delta) {
  steppers[key] = Math.min(stepMax[key], Math.max(stepMin[key], steppers[key] + delta));
  document.getElementById(key + '-val').textContent = steppers[key];
}

function togglePrep() {
  const btn = document.getElementById('prep-toggle');
  btn.classList.toggle('on');
  document.getElementById('prep-row-time').style.display = btn.classList.contains('on') ? '' : 'none';
}

function toggleBigRest() {
  const btn = document.getElementById('bigrest-toggle');
  btn.classList.toggle('on');
  const on = btn.classList.contains('on');
  document.getElementById('bigrest-row-after').style.display = on ? '' : 'none';
  document.getElementById('bigrest-row-time').style.display  = on ? '' : 'none';
}

function buildWorkoutFromEdit() {
  const name   = document.getElementById('edit-name').value.trim() || 'Тренування';
  const prepOn = document.getElementById('prep-toggle').classList.contains('on');
  const bigOn  = document.getElementById('bigrest-toggle').classList.contains('on');
  const midOn  = document.getElementById('mid-toggle').classList.contains('on');
  const ptOn   = document.getElementById('phasetracks-toggle').classList.contains('on');
  return {
    id: editingId || nextId++, name, mode: editMode,
    prepOn, prep: steppers.prep,
    work: steppers.work, rest: steppers.rest, sets: steppers.sets, reps: steppers.reps,
    bigRest: editMode === 'reps' ? false : bigOn,
    bigRestAfter: steppers.bigrest, bigRestTime: steppers.bigresttime,
    midSignal: midOn, countdownSignal: false,
    phaseTracksOn: ptOn,
    phaseTrackWork:    ptOn ? editPhaseTrack.work    : null,
    phaseTrackRest:    ptOn ? editPhaseTrack.rest    : null,
    phaseTrackBigrest: ptOn ? editPhaseTrack.bigrest : null,
    badge: name.length > 10 ? name.slice(0,10)+'…' : name, badgeType: 'green',
  };
}

async function saveWorkout() {
  const w = buildWorkoutFromEdit();
  await upsertWorkout(w);
  renderWorkoutList(); updateHomeCount();
  show('screen-workouts');
}

async function saveAndStart() {
  const w = buildWorkoutFromEdit();
  await upsertWorkout(w);
  renderWorkoutList(); updateHomeCount();
  startWorkout(w.id);
}

async function upsertWorkout(w) {
  await dbSaveWorkout(w);
  const idx = workouts.findIndex(x => x.id === w.id);
  if (idx !== -1) workouts[idx] = w; else workouts.push(w);
}

// ════════════════════════════════════════════════
//  START WORKOUT — router
// ════════════════════════════════════════════════
function startWorkout(id) {
  const w = workouts.find(x => x.id === id);
  if (!w) return;
  if (w.mode === 'reps') launchReps(w);
  else                   launchTimer(w);
}

// ════════════════════════════════════════════════
//  TIMER MODE
// ════════════════════════════════════════════════
const CIRCUMFERENCE = 2 * Math.PI * 88;
let timerInterval  = null;
let isRunning      = false;
let currentTime    = 0, totalTime = 0;
let currentSet     = 0;
let activeWorkout  = null;
let phase          = 'prep';
let workoutStartMs = 0;
let skippedSets    = 0;

function launchTimer(w) {
  activeWorkout  = w;
  lastWorkout    = w;
  stopTimer();
  currentSet     = 0;
  skippedSets    = 0;
  workoutStartMs = Date.now();

  if (w.prepOn) { phase='prep'; currentTime=w.prep; totalTime=w.prep; }
  else          { phase='work'; currentTime=w.work; totalTime=w.work; }

  document.getElementById('timer-workout-name').textContent = w.name;
  document.getElementById('timer-title').textContent        = w.name;
  buildDots();
  updateDisplay();
  show('screen-timer');
  if (w.phaseTracksOn) {
    stopMusic();
    // грати трек початкової фази (prep не має треку, тому якщо prep — чекаємо work)
    if (phase !== 'prep') handlePhaseTrackChange(phase, w);
  } else if (tracks.length > 0 && !musicIsPlaying) {
    playMusic();
  }
}

function buildDots() {
  const c = document.getElementById('sets-dots');
  c.innerHTML = '';
  const n = activeWorkout ? activeWorkout.sets : 0;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'set-dot';
    c.appendChild(d);
  }
  updateDots();
}

function updateDots() {
  document.querySelectorAll('#sets-dots .set-dot').forEach((d, i) => {
    d.classList.remove('done','active');
    if (phase === 'prep') { /* all grey */ }
    else if (i < currentSet) d.classList.add('done');
    else if (i === currentSet) d.classList.add('active');
  });
}

function updateDisplay() {
  if (!activeWorkout) return;
  const w = activeWorkout;
  document.getElementById('timer-display').textContent = currentTime;
  const offset = CIRCUMFERENCE * (1 - currentTime / totalTime);
  const ring = document.getElementById('progress-ring');
  ring.style.strokeDashoffset = Math.round(offset);
  const colors = { prep:'#F59E0B', work:'#1D9E75', rest:'#378ADD', bigrest:'#378ADD' };
  ring.style.stroke = colors[phase];
  const phaseTexts = {
    prep:    'Підготовка — займіть позицію',
    work:    `Підхід ${currentSet+1} з ${w.sets} — Робота`,
    rest:    `Підхід ${currentSet+1} з ${w.sets} — Відпочинок`,
    bigrest: `Великий перерив (після ${currentSet} підходів)`,
  };
  document.getElementById('phase-label').textContent = phaseTexts[phase];
  document.getElementById('timer-sublabel').textContent = phase==='work' ? 'секунд роботи' : 'секунд відпочинку';
  document.getElementById('prep-banner').classList.toggle('visible', phase==='prep');
  document.getElementById('bigrest-banner').classList.toggle('visible', phase==='bigrest');
  const pb = document.getElementById('play-btn');
  if (pb) {
    pb.classList.toggle('prep-mode', phase==='prep' && isRunning);
    pb.classList.toggle('running', (phase==='rest'||phase==='bigrest') && isRunning);
    if (isRunning && phase==='work') { pb.classList.remove('prep-mode','running'); pb.style.background='#1D9E75'; pb.style.borderColor='#1D9E75'; }
    else if (!isRunning) { pb.style.background=''; pb.style.borderColor=''; }
  }
  updateDots();
}

function toggleTimer() {
  const buttons = document.querySelectorAll('.play-btn');

  if (isRunning) {
    clearInterval(timerInterval);
    isRunning = false;

    if (!phaseAudioEl.paused) phaseAudioEl.pause();

    buttons.forEach(btn => {
      btn.textContent = '▶';
      btn.classList.remove('running','prep-mode');
      btn.style.background = '';
      btn.style.borderColor = '';
    });

  } else {
    isRunning = true;

    buttons.forEach(btn => {
      btn.textContent = '⏸';
    });

    timerInterval = setInterval(tick, 1000);

    if (phaseAudioEl.src && phaseAudioEl.paused && activeWorkout?.phaseTracksOn) {
      const p = phaseAudioEl.play();
      if (p && p.catch) p.catch(() => {});
    }

    updateDisplay();
  }
}

function tick() {
  const w = activeWorkout; if (!w) return;
  if (phase==='work' && w.midSignal && globalSettings.mid && currentTime===Math.ceil(totalTime/2)) beep('mid');
  // 3-2-1 завжди грає перед кінцем будь-якої фази
  if (currentTime<=3 && currentTime>0) beep('tick');
  currentTime--;
  if (currentTime <= 0) { advancePhase(); return; }
  updateDisplay();
}

function advancePhase() {
  const w = activeWorkout;
  if (phase === 'prep') {
    beep('end'); phase='work'; currentTime=w.work; totalTime=w.work;
  } else if (phase === 'work') {
    const done = currentSet + 1;
    if (done >= w.sets) { finishWorkout(); return; }
    beep('end');
    if (w.bigRest && done % w.bigRestAfter === 0) {
      currentSet=done; phase='bigrest'; currentTime=w.bigRestTime; totalTime=w.bigRestTime;
    } else {
      currentSet=done; phase='rest'; currentTime=w.rest; totalTime=w.rest;
    }
  } else if (phase==='rest' || phase==='bigrest') {
    beep('end'); phase='work'; currentTime=w.work; totalTime=w.work;
  }
  handlePhaseTrackChange(phase, w);
  updateDisplay();
}

async function finishWorkout() {
  stopTimer(); stopMusic(); stopPhaseAudio(); beepVictory();
  const w = activeWorkout;
  const elapsed      = Math.round((Date.now() - workoutStartMs) / 1000);
  const completed    = currentSet + 1;
  const tooFast      = elapsed < 60;                              // менше 1 хвилини
  const toofewSets   = completed < 2;                             // менше 2 підходів
  const tooManySkips = skippedSets > Math.floor(w.sets / 2);     // більше половини пропущено
  const isFail       = tooFast || toofewSets || tooManySkips;
  const status       = isFail ? 'fail'
    : completed >= w.sets && skippedSets === 0 ? 'done'
    : completed >= Math.ceil(w.sets * 0.5) ? 'partial'
    : 'fail';
  document.querySelectorAll('#sets-dots .set-dot').forEach(d => { d.classList.remove('active'); d.classList.add('done'); });
  document.getElementById('done-sets').textContent     = completed;
  document.getElementById('done-time').textContent     = fmtTime(elapsed);
  document.getElementById('done-subtitle').textContent =
    status === 'done'    ? `${w.name} — молодець! 💪` :
    status === 'partial' ? `${w.name} — ${completed} з ${w.sets} підходів` :
                           `${w.name} — тренування не зараховано`;
  await dbAddHistory({ date: Date.now(), name: w.name, mode: 'timer', sets: w.sets, completedSets: completed, totalReps: null, duration: elapsed, status });
  await updateHomeHistoryCount();
  show('screen-done');
}

function skipPhase() {
  if (phase === 'work') skippedSets++;
  currentTime = 1;
}

function restartTimer() {
  stopTimer();
  if (!activeWorkout) return;
  const w = activeWorkout;
  currentSet = 0; skippedSets = 0; workoutStartMs = Date.now();
  if (w.prepOn) { phase='prep'; currentTime=w.prep; totalTime=w.prep; }
  else          { phase='work'; currentTime=w.work; totalTime=w.work; }
  buildDots(); updateDisplay();
}

function stopTimer() {
  clearInterval(timerInterval);
  isRunning = false;

  const btns = document.querySelectorAll('.play-btn');

  btns.forEach(btn => {
    btn.textContent = '▶';
    btn.classList.remove('running', 'prep-mode');
    btn.style.background = '';
    btn.style.borderColor = '';
  });
}

// ════════════════════════════════════════════════
//  REPS MODE
// ════════════════════════════════════════════════
let repsWorkout     = null;
let repsCurrentSet  = 0;
let repsCurrentReps = 0;   // what user will do this set
let repsPhase       = 'prep'; // 'prep' | 'work' | 'rest'
let repsRestInterval = null;
let repsRestTime    = 0;
let repsTotalReps   = 0;
let repsStartMs     = 0;
let repsPrepInterval = null;
let repsPrepTime    = 0;

function launchReps(w) {
  repsWorkout    = w;
  lastWorkout    = w;
  repsCurrentSet = 0;
  repsTotalReps  = 0;
  repsStartMs    = Date.now();
  repsCurrentReps = w.reps || 10;
  repsPhase      = w.prepOn ? 'prep' : 'work';
  repsPrepTime   = w.prep || 10;

  document.getElementById('reps-workout-name').textContent = w.name;
  document.getElementById('reps-title').textContent        = w.name;
  buildRepsDots();
  updateRepsDisplay();
  show('screen-reps');
  if (tracks.length > 0 && !musicIsPlaying) playMusic();

  if (repsPhase === 'prep') startRepsPrepCountdown();
}

function buildRepsDots() {
  const c = document.getElementById('reps-dots');
  c.innerHTML = '';
  const n = repsWorkout ? repsWorkout.sets : 0;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'set-dot' + (i === 0 ? ' active' : '');
    c.appendChild(d);
  }
}

function updateRepsDots() {
  document.querySelectorAll('#reps-dots .set-dot').forEach((d, i) => {
    d.classList.remove('done','active');
    if (i < repsCurrentSet) d.classList.add('done');
    else if (i === repsCurrentSet) d.classList.add('active');
  });
}

function updateRepsDisplay() {
  const w = repsWorkout; if (!w) return;
  const ring     = document.getElementById('reps-progress-ring');
  const display  = document.getElementById('reps-display');
  const sublabel = document.getElementById('reps-sublabel');
  const doneBtn  = document.getElementById('reps-done-btn');
  const adjustBtns = document.getElementById('reps-adjust-btns');
  const setInfo  = document.getElementById('reps-set-info');
  const prepBanner = document.getElementById('reps-prep-banner');

  prepBanner.classList.toggle('visible', repsPhase === 'prep');

  if (repsPhase === 'prep') {
    ring.style.stroke = '#F59E0B';
    const pct = repsPrepTime / (w.prep || 10);
    ring.style.strokeDashoffset = Math.round(CIRCUMFERENCE * (1 - pct));
    display.textContent = repsPrepTime;
    sublabel.textContent = 'секунд до старту';
    doneBtn.disabled = true;
    doneBtn.textContent = '⏳ Підготовка...';
    adjustBtns.style.visibility = 'hidden';
    setInfo.textContent = `Підхід 1 з ${w.sets}`;

  } else if (repsPhase === 'work') {
    ring.style.stroke = '#1D9E75';
    ring.style.strokeDashoffset = 0; // full ring — no time-based progress for reps
    display.textContent = repsCurrentReps;
    sublabel.textContent = 'повторень';
    doneBtn.disabled = false;
    doneBtn.textContent = '✓ Виконано';
    adjustBtns.style.visibility = 'visible';
    setInfo.textContent = `Підхід ${repsCurrentSet+1} з ${w.sets}`;

  } else if (repsPhase === 'rest') {
    ring.style.stroke = '#378ADD';
    const pct = repsRestTime / w.rest;
    ring.style.strokeDashoffset = Math.round(CIRCUMFERENCE * (1 - pct));
    display.textContent = repsRestTime;
    sublabel.textContent = 'відпочинок';
    doneBtn.disabled = false;
    doneBtn.textContent = '⏭ Пропустити відпочинок';
    adjustBtns.style.visibility = 'hidden';
    setInfo.textContent = `Підхід ${repsCurrentSet} виконано ✓`;
  }

  updateRepsDots();
}

function startRepsPrepCountdown() {
  repsPrepInterval = setInterval(() => {
    repsPrepTime--;
    if (repsPrepTime <= 3 && repsPrepTime > 0) beep('tick');
    if (repsPrepTime <= 0) {
      clearInterval(repsPrepInterval);
      repsPhase = 'work';
      repsCurrentReps = repsWorkout.reps || 10;
      beep('end');
    }
    updateRepsDisplay();
  }, 1000);
}

function adjustReps(delta) {
  if (repsPhase !== 'work') return;
  repsCurrentReps = Math.max(1, repsCurrentReps + delta);
  updateRepsDisplay();
}

function repsDone() {
  const w = repsWorkout; if (!w) return;

  if (repsPhase === 'work') {
    repsTotalReps += repsCurrentReps;
    const completedSet = repsCurrentSet + 1;
    beep('end');
    if (completedSet >= w.sets) { finishReps(); return; }
    repsCurrentSet = completedSet;
    repsPhase      = 'rest';
    repsRestTime   = w.rest;
    updateRepsDisplay();
    repsRestInterval = setInterval(() => {
      repsRestTime--;
      if (repsRestTime <= 3 && repsRestTime > 0) beep('tick');
      if (repsRestTime <= 0) {
        clearInterval(repsRestInterval);
        repsPhase = 'work';
        repsCurrentReps = w.reps || 10;
        beep('end');
      }
      updateRepsDisplay();
    }, 1000);

  } else if (repsPhase === 'rest') {
    clearInterval(repsRestInterval);
    repsPhase = 'work';
    repsCurrentReps = w.reps || 10;
    updateRepsDisplay();
  }
}

async function finishReps() {
  clearInterval(repsRestInterval);
  stopMusic();
  beepVictory();
  const w = repsWorkout;
  const elapsed    = Math.round((Date.now() - repsStartMs) / 1000);
  const completed  = repsCurrentSet;
  const tooFast    = elapsed < 60;
  const toofewSets = completed < 2;
  const isFail     = tooFast || toofewSets;
  const status     = isFail ? 'fail'
    : completed >= w.sets ? 'done'
    : completed >= Math.ceil(w.sets * 0.5) ? 'partial'
    : 'fail';
  document.querySelectorAll('#reps-dots .set-dot').forEach(d => { d.classList.remove('active'); d.classList.add('done'); });
  document.getElementById('done-sets').textContent     = completed;
  document.getElementById('done-time').textContent     = fmtTime(elapsed);
  document.getElementById('done-subtitle').textContent =
    status === 'done'    ? `${w.name} — ${repsTotalReps} повторень! 💪` :
    status === 'partial' ? `${w.name} — ${completed} з ${w.sets} підходів` :
                           `${w.name} — тренування не зараховано`;
  await dbAddHistory({ date: Date.now(), name: w.name, mode: 'reps', sets: w.sets, completedSets: completed, totalReps: repsTotalReps, duration: elapsed, status });
  await updateHomeHistoryCount();
  show('screen-done');
}

function stopRepsTimer() {
  clearInterval(repsRestInterval);
  clearInterval(repsPrepInterval);
}

let lastWorkout = null; // завжди зберігає останнє запущене тренування

function replayWorkout() {
  if (!lastWorkout) return;
  if (lastWorkout.mode === 'reps') {
    launchReps(lastWorkout);
  } else {
    restartTimer();
    show('screen-timer');
  }
}

// ════════════════════════════════════════════════
//  HISTORY SCREEN
// ════════════════════════════════════════════════
// ════════════════════════════════════════════════
//  HISTORY + CALENDAR
// ════════════════════════════════════════════════
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-based

async function openHistory() {
  await renderHistory();
  await renderCalendar();
  show('screen-history');
}

function switchHistoryTab(tab) {
  document.getElementById('tab-calendar').classList.toggle('active', tab === 'calendar');
  document.getElementById('tab-list').classList.toggle('active', tab === 'list');
  document.getElementById('history-tab-calendar').style.display = tab === 'calendar' ? '' : 'none';
  document.getElementById('history-tab-list').style.display     = tab === 'list'     ? '' : 'none';
}

// ── CALENDAR ──
async function renderCalendar() {
  const history = await dbGetHistory();
  const today   = new Date();
  today.setHours(0,0,0,0);

  // find first ever workout date
  let firstDate = null;
  if (history.length > 0) {
    const earliest = Math.min(...history.map(h => h.date));
    firstDate = new Date(earliest);
    firstDate.setHours(0,0,0,0);
  }

  // build day → best status map for current month
  const dayMap = {}; // 'YYYY-MM-DD' → 'done' | 'partial' | 'fail'
  history.forEach(h => {
    const d   = new Date(h.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const cur = dayMap[key];
    const st  = h.status || 'done';
    // best status wins: done > partial > fail
    const rank = { done:3, partial:2, fail:1 };
    if (!cur || rank[st] > rank[cur]) dayMap[key] = st;
  });

  // month label
  const monthNames = ['Січень','Лютий','Березень','Квітень','Травень','Червень',
                      'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
  document.getElementById('cal-month-label').textContent = `${monthNames[calMonth]} ${calYear}`;

  // stats for month
  const monthEntries = history.filter(h => {
    const d = new Date(h.date);
    return d.getFullYear() === calYear && d.getMonth() === calMonth;
  });
  const doneDays    = new Set(monthEntries.filter(h => (h.status||'done')==='done').map(h => new Date(h.date).getDate())).size;
  const partialDays = new Set(monthEntries.filter(h => (h.status||'done')==='partial').map(h => new Date(h.date).getDate())).size;
  const totalMin    = Math.round(monthEntries.reduce((s,h) => s + (h.duration||0), 0) / 60);
  document.getElementById('cal-stats').innerHTML = `
    <div class="cal-stat-card"><div class="cal-stat-val" style="color:var(--green);">${doneDays}</div><div class="cal-stat-label">виконано</div></div>
    <div class="cal-stat-card"><div class="cal-stat-val" style="color:var(--amber);">${partialDays}</div><div class="cal-stat-label">частково</div></div>
    <div class="cal-stat-card"><div class="cal-stat-val">${totalMin}</div><div class="cal-stat-label">хвилин</div></div>`;

  // build grid
  const grid      = document.getElementById('cal-grid');
  grid.innerHTML  = '';
  const firstDay  = new Date(calYear, calMonth, 1);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  // Monday-based: getDay() returns 0=Sun, convert to Mon=0
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  // empty cells
  for (let i = 0; i < startDow; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(calYear, calMonth, day);
    date.setHours(0,0,0,0);
    const key  = `${calYear}-${calMonth}-${day}`;
    const el   = document.createElement('div');
    const isToday   = date.getTime() === today.getTime();
    const isFuture  = date > today;
    const isPast    = date < today;
    const hasFirst  = firstDate && date >= firstDate;

    let cls = 'cal-day';
    if (isFuture) {
      cls += ' future';
    } else if (dayMap[key]) {
      cls += ' ' + dayMap[key];
    } else if (isPast && hasFirst) {
      cls += ' miss';
    } else {
      cls += ' no-data';
    }
    if (isToday) cls += ' today';

    el.className    = cls;
    el.textContent  = day;
    grid.appendChild(el);
  }
}

async function calPrev() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  await renderCalendar();
}
async function calNext() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  await renderCalendar();
}

// ── LIST ──
async function renderHistory() {
  const history = await dbGetHistory();
  const container = document.getElementById('history-list');
  container.innerHTML = '';

  if (history.length === 0) {
    container.innerHTML = `<div class="history-empty"><div class="icon">📅</div><div>Ще немає записів.<br>Завершіть перше тренування!</div></div>`;
    return;
  }

  [...history].reverse().forEach(h => {
    const card = document.createElement('div');
    card.className = 'history-card';
    const d       = new Date(h.date);
    const dateStr = d.toLocaleDateString('uk-UA', { day:'numeric', month:'short', year:'numeric' });
    const timeStr = d.toLocaleTimeString('uk-UA', { hour:'2-digit', minute:'2-digit' });
    const modeIcon = h.mode === 'reps' ? '🔢' : '⏱';
    const status   = h.status || 'done';
    const statusLabel = { done:'✓ Виконано', partial:'~ Частково', fail:'✗ Незараховано' }[status];
    const statusClass = { done:'status-done', partial:'status-partial', fail:'status-fail' }[status];

    let statsHtml = `
      <div class="history-stat"><div class="history-stat-val">${h.completedSets ?? h.sets}</div><div class="history-stat-label">підходів</div></div>
      <div class="history-stat"><div class="history-stat-val">${fmtTime(h.duration)}</div><div class="history-stat-label">час</div></div>`;
    if (h.mode === 'reps' && h.totalReps) {
      statsHtml += `<div class="history-stat"><div class="history-stat-val">${h.totalReps}</div><div class="history-stat-label">повторень</div></div>`;
    }

    card.innerHTML = `
      <div class="history-header">
        <div>
          <div class="history-name">${esc(h.name)} ${modeIcon}</div>
          <div class="history-date">${dateStr}, ${timeStr}</div>
          <span class="status-badge ${statusClass}">${statusLabel}</span>
        </div>
        <button onclick="deleteHistoryEntry(${h.id})" style="background:none;border:none;cursor:pointer;font-size:15px;color:var(--text-tertiary);padding:4px;border-radius:6px;">🗑</button>
      </div>
      <div class="history-stats">${statsHtml}</div>`;
    container.appendChild(card);
  });
}

async function clearHistory() {
  if (!confirm('Очистити всю історію тренувань?')) return;
  await dbClearHistory();
  await updateHomeHistoryCount();
  renderHistory();
  renderCalendar();
}

async function deleteHistoryEntry(id) {
  await db.delete('history', id);
  await updateHomeHistoryCount();
  renderHistory();
  renderCalendar();
}

// ════════════════════════════════════════════════
//  COUNTDOWN OVERLAY
// ════════════════════════════════════════════════
function runCountdown(from, label, cb) {
  const overlay = document.getElementById('countdown-overlay');
  const numEl   = document.getElementById('countdown-num');
  const lblEl   = document.getElementById('countdown-label');
  lblEl.textContent = label || 'готуйся';
  overlay.classList.add('visible');
  let n = from;
  numEl.textContent = n; beep('tick');
  const iv = setInterval(() => {
    n--;
    if (n <= 0) { clearInterval(iv); overlay.classList.remove('visible'); cb(); }
    else { numEl.textContent = n; beep('tick'); }
  }, 1000);
}

// ════════════════════════════════════════════════
//  AUDIO — BEEPS
// ════════════════════════════════════════════════
let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function tone(freq, start, dur, vol) {
  const ctx = getCtx(), osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  gain.gain.setValueAtTime(vol, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + dur + 0.01);
}
function beep(type) {
  if (!globalSettings.beep) return;
  const v = globalSettings.volume * 0.45;
  try {
    if (type==='end')  { tone(880,0,0.14,v); tone(1100,0.18,0.18,v); }
    else if (type==='mid')  { tone(660,0,0.12,v*0.7); }
    else if (type==='tick') { tone(440,0,0.08,v*0.6); }
  } catch(e) {}
}
function beepVictory() {
  const v = globalSettings.volume * 0.45;
  try { [523,659,784,1047].forEach((f,i) => tone(f, i*0.18, 0.25, v)); } catch(e) {}
}

// ════════════════════════════════════════════════
//  MUSIC PLAYER  (FileReader / base64 + IndexedDB)
// ════════════════════════════════════════════════
let tracks         = [];
let currentTrack   = 0;
let musicIsPlaying = false;
let musicMode      = 0;
let audioEl        = new Audio();
audioEl.volume     = 0.7;
audioEl.preload    = 'auto';

const MODE_LABELS = ['🔁 Повтор плейлисту', '🔂 Повтор треку', '🔀 Перемішати'];

audioEl.addEventListener('ended', () => {
  if (musicMode===1) { audioEl.currentTime=0; doPlay(); }
  else if (musicMode===2) { currentTrack=Math.floor(Math.random()*tracks.length); playTrack(currentTrack); }
  else { nextTrack(); }
});
audioEl.addEventListener('timeupdate', updateMusicUI);
audioEl.addEventListener('loadedmetadata', () => {
  if (tracks[currentTrack]) tracks[currentTrack].duration = audioEl.duration;
  renderTrackList(); updateMusicUI();
});

function doPlay() {
  const p = audioEl.play();
  if (p && p.catch) p.catch(err => console.warn('play():', err));
}

function handleFileInput(input) { [...input.files].forEach(readTrack); input.value=''; }
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag-over');
  [...e.dataTransfer.files].filter(f => f.type.startsWith('audio/')).forEach(readTrack);
}

function readTrack(file) {
  const name = file.name.replace(/\.[^/.]+$/, '');
  const idx  = tracks.length;
  tracks.push({ dbId: null, name, dataUrl: null, duration: 0, loading: true });
  renderTrackList(); updateHomeMusicCount();

  const reader = new FileReader();
  reader.onload = async (ev) => {
    const dataUrl = ev.target.result;
    tracks[idx].dataUrl = dataUrl;
    tracks[idx].loading = false;

    // Save to IndexedDB
    const dbId = await dbAddTrack({ name, dataUrl, duration: 0 });
    tracks[idx].dbId = dbId;

    // probe duration
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.src = dataUrl;
    probe.addEventListener('loadedmetadata', async () => {
      tracks[idx].duration = probe.duration;
      if (tracks[idx].dbId) await db.put('music', { id: tracks[idx].dbId, name, dataUrl, duration: probe.duration });
      renderTrackList();
    });

    renderTrackList(); updateHomeMusicCount();
    if (idx === 0 && !musicIsPlaying) playTrack(0);
  };
  reader.onerror = () => { tracks[idx].loading=false; tracks[idx].name+=' ⚠'; renderTrackList(); };
  reader.readAsDataURL(file);
}

async function removeTrack(idx) {
  if (currentTrack===idx && musicIsPlaying) { audioEl.pause(); musicIsPlaying=false; }
  if (tracks[idx].dbId) await dbDeleteTrack(tracks[idx].dbId);
  tracks.splice(idx, 1);
  if (currentTrack >= tracks.length) currentTrack = Math.max(0, tracks.length-1);
  renderTrackList(); updateHomeMusicCount(); updateMusicPlayerVisibility();
}

function renderTrackList() {
  const list = document.getElementById('track-list');
  list.innerHTML = '';
  tracks.forEach((t, i) => {
    const isActive = i===currentTrack && musicIsPlaying;
    const item = document.createElement('div');
    item.className = 'track-item' + (isActive ? ' playing' : '');
    const dur = t.duration > 0 ? fmtTime(t.duration) : (t.loading ? '⏳' : '—');
    item.innerHTML = `
      <span class="track-num">${isActive ? '▶' : i+1}</span>
      <div class="track-info"><div class="track-name">${esc(t.name)}</div><div class="track-dur">${dur}</div></div>
      <button class="track-delete" onclick="event.stopPropagation();removeTrack(${i})">✕</button>`;
    item.addEventListener('click', () => playTrack(i));
    list.appendChild(item);
  });
  const hasAny = tracks.length > 0;
  document.getElementById('drop-zone-wrap').style.display  = hasAny ? 'none' : '';
  document.getElementById('track-list-wrap').style.display = hasAny ? '' : 'none';
  document.getElementById('fullplayer-wrap').style.display = hasAny ? '' : 'none';
  updateFullPlayer();
}

function updateMusicPlayerVisibility() {
  const vis = tracks.length > 0;
  document.getElementById('music-player').classList.toggle('visible', vis);
  const rmp = document.getElementById('reps-music-player');
  if (rmp) rmp.classList.toggle('visible', vis);
}

function updateHomeMusicCount() {
  const n = tracks.length;
  document.getElementById('home-music-count').textContent =
    n===0 ? 'Немає треків' : n===1 ? '1 трек' : `${n} треки`;
}

function playTrack(idx) {
  if (!tracks[idx] || !tracks[idx].dataUrl) return;
  currentTrack = idx; audioEl.src = tracks[idx].dataUrl; audioEl.currentTime = 0;
  doPlay(); musicIsPlaying = true;
  updateMusicUI(); renderTrackList(); updateMusicPlayerVisibility();
}
function playMusic() { if (tracks.length && tracks[currentTrack]?.dataUrl) playTrack(currentTrack); }
function stopMusic()  { audioEl.pause(); audioEl.currentTime=0; musicIsPlaying=false; updateMusicUI(); updateMusicPlayerVisibility(); }

function toggleMusicPlay() {
  if (!tracks.length) return;
  if (musicIsPlaying && !audioEl.paused) { audioEl.pause(); musicIsPlaying=false; }
  else { if (!tracks[currentTrack]?.dataUrl) return; if (!audioEl.src) audioEl.src=tracks[currentTrack].dataUrl; doPlay(); musicIsPlaying=true; }
  updateMusicUI(); updateMusicPlayerVisibility();
}
function nextTrack() { if (!tracks.length) return; currentTrack=(currentTrack+1)%tracks.length; playTrack(currentTrack); }
function prevTrack() { if (!tracks.length) return; if (audioEl.currentTime>3) { audioEl.currentTime=0; return; } currentTrack=(currentTrack-1+tracks.length)%tracks.length; playTrack(currentTrack); }
function cycleMusicMode() { musicMode=(musicMode+1)%3; const el=document.getElementById('fp-mode'); el.textContent=MODE_LABELS[musicMode]; el.classList.toggle('active',musicMode!==0); }

function seekMusic(e) {
  if (!tracks.length || !audioEl.duration) return;
  const rect=document.getElementById('fp-progress').getBoundingClientRect();
  audioEl.currentTime = Math.min(1,Math.max(0,(e.clientX-rect.left)/rect.width)) * audioEl.duration;
}
function setMusicVolume(v) { audioEl.volume = v; }

function updateMusicUI() {
  const t = isFinite(audioEl.currentTime) ? audioEl.currentTime : 0;
  const d = isFinite(audioEl.duration)    ? audioEl.duration    : 0;
  const pct = d>0 ? (t/d*100).toFixed(2)+'%' : '0%';
  document.getElementById('fp-bar').style.width     = pct;
  document.getElementById('fp-current').textContent = fmtTime(t);
  document.getElementById('fp-total').textContent   = fmtTime(d);
  const playing = musicIsPlaying && !audioEl.paused;
  document.getElementById('fp-play-btn').textContent   = playing ? '⏸' : '▶';
  document.getElementById('mini-play-btn').textContent = playing ? '⏸' : '▶';
  const rmpb = document.getElementById('reps-mini-play-btn');
  if (rmpb) rmpb.textContent = playing ? '⏸' : '▶';
  if (tracks[currentTrack]) {
    const name = tracks[currentTrack].name;
    document.getElementById('fp-track-name').textContent    = name;
    document.getElementById('fp-track-index').textContent   = `${currentTrack+1} / ${tracks.length}`;
    document.getElementById('mini-track-name').textContent  = name;
    const rmtn = document.getElementById('reps-mini-track-name');
    if (rmtn) rmtn.textContent = name;
  }
}
function updateFullPlayer() {
  if (!tracks.length) return;
  document.getElementById('fp-track-name').textContent  = tracks[currentTrack]?.name || '—';
  document.getElementById('fp-track-index').textContent = `${currentTrack+1} / ${tracks.length}`;
}

function fmtTime(s) {
  if (!s || !isFinite(s)) return '0:00';
  const m=Math.floor(s/60), sec=Math.floor(s%60);
  return `${m}:${String(sec).padStart(2,'0')}`;
}

// ════════════════════════════════════════════════
//  THEMES
// ════════════════════════════════════════════════
function applyTheme(id, name) {
  const phone = document.getElementById('phone');
  phone.setAttribute('data-theme', id === 'forest' ? '' : id);
  localStorage.setItem('fittimer_theme', id);
  localStorage.setItem('fittimer_theme_name', name);
  document.getElementById('home-theme-name').textContent = name;
  document.querySelectorAll('.theme-card').forEach(c => {
    c.classList.toggle('active', c.dataset.t === id);
  });
}

function loadTheme() {
  const id   = localStorage.getItem('fittimer_theme') || 'forest';
  const name = localStorage.getItem('fittimer_theme_name') || 'Forest';
  applyTheme(id, name);
}

// ════════════════════════════════════════════════
//  PHASE TRACKS
// ════════════════════════════════════════════════
let editPhaseTrack   = { work: null, rest: null, bigrest: null };
let activeTrackModal = null; // 'work' | 'rest' | 'bigrest'
let phaseAudioEl     = new Audio();
phaseAudioEl.preload = 'auto';

const PHASE_LABELS = { work: '💪 Робота', rest: '😮‍💨 Відпочинок', bigrest: '🏋️ Великий перерив' };

function togglePhaseTracks() {
  const btn = document.getElementById('phasetracks-toggle');
  btn.classList.toggle('on');
  const on = btn.classList.contains('on');
  const card = document.getElementById('phasetracks-card');
  card.style.opacity       = on ? '1' : '0.45';
  card.style.pointerEvents = on ? '' : 'none';
  // enable/disable pickers
  ['work','rest','bigrest'].forEach(k => {
    const el = document.getElementById(`pt-${k}-label`);
    el.classList.toggle('disabled', !on);
  });
}

function refreshPhaseTrackLabels() {
  ['work','rest','bigrest'].forEach(k => {
    const el  = document.getElementById(`pt-${k}-label`);
    const idx = editPhaseTrack[k];
    el.textContent = (idx !== null && tracks[idx]) ? tracks[idx].name : 'Не обрано';
  });
}

function openTrackModal(phase) {
  if (!document.getElementById('phasetracks-toggle').classList.contains('on')) return;
  activeTrackModal = phase;
  document.getElementById('track-modal-title').textContent = PHASE_LABELS[phase];
  const list = document.getElementById('track-modal-list');
  list.innerHTML = '';

  // "None" option
  const noneEl = document.createElement('div');
  noneEl.className = 'track-modal-none' + (editPhaseTrack[phase] === null ? ' selected' : '');
  noneEl.innerHTML = `<span style="font-size:16px;">🚫</span><span>Без треку</span>`;
  noneEl.onclick = () => { editPhaseTrack[phase] = null; refreshPhaseTrackLabels(); closeTrackModal(); };
  list.appendChild(noneEl);

  if (tracks.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:16px 20px;font-size:13px;color:var(--text-tertiary);text-align:center;';
    empty.textContent = 'Додайте треки в розділі Музика';
    list.appendChild(empty);
  } else {
    tracks.forEach((t, i) => {
      const item = document.createElement('div');
      item.className = 'track-modal-item' + (editPhaseTrack[phase] === i ? ' selected' : '');
      item.innerHTML = `
        <span style="font-size:18px;">🎵</span>
        <span class="track-modal-item-name">${esc(t.name)}</span>
        <span class="track-modal-item-dur">${fmtTime(t.duration)}</span>`;
      item.onclick = () => { editPhaseTrack[phase] = i; refreshPhaseTrackLabels(); closeTrackModal(); };
      list.appendChild(item);
    });
  }

  document.getElementById('track-modal-overlay').classList.add('visible');
}

function closeTrackModal() {
  document.getElementById('track-modal-overlay').classList.remove('visible');
  activeTrackModal = null;
}

// ── Phase audio playback ──
function playPhaseTrack(trackIdx) {
  if (trackIdx === null || trackIdx === undefined || !tracks[trackIdx]?.dataUrl) return;
  phaseAudioEl.src         = tracks[trackIdx].dataUrl;
  phaseAudioEl.currentTime = 0;
  phaseAudioEl.volume      = audioEl.volume;
  const p = phaseAudioEl.play();
  if (p && p.catch) p.catch(() => {});
}

function stopPhaseAudio() {
  phaseAudioEl.pause();
  phaseAudioEl.currentTime = 0;
}

function handlePhaseTrackChange(newPhase, workout) {
  if (!workout?.phaseTracksOn) return;
  stopPhaseAudio();
  if (newPhase === 'work')    playPhaseTrack(workout.phaseTrackWork);
  if (newPhase === 'rest')    playPhaseTrack(workout.phaseTrackRest);
  if (newPhase === 'bigrest') playPhaseTrack(workout.phaseTrackBigrest);
}
// ════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════
loadTheme();
appInit();


// ════════════════════════════════════════════════
//  SERVICE WORKER REGISTRATION
// ════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .catch(err => console.log('SW registration failed:', err));
  });
}
