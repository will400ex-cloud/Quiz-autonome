// UI logic and wiring
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const app = {
  config: null,
  quizzes: [],
  state: null,
  timerInterval: null,
};

function pad(n){ return String(n).padStart(2,'0'); }
function fmtSec(s){
  const m = Math.floor(s/60), r = s%60;
  return `${m}:${pad(r)}`;
}
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

async function loadConfig() {
  const res = await fetch('data/config.json', { cache: 'no-store' });
  app.config = await res.json();
  app.quizzes = [{
    id: app.config.quizId,
    title: app.config.title || 'Quiz autonome',
    csv: app.config.csvPath || 'data/questions.csv'
  }];
  $('#appTitle').textContent = app.config.title || 'Quiz autonome';
  $('#appSubtitle').textContent = app.config.subtitle || 'Répondez à votre rythme';
  $('#foot').textContent = `© ${new Date().getFullYear()} — ${app.config.title || 'Quiz autonome'}`;
  $('#configPreview').textContent = JSON.stringify(app.config, null, 2);
  const sel = $('#quizSelect');
  sel.innerHTML = '';
  app.quizzes.forEach(q => {
    const opt = document.createElement('option');
    opt.value = q.id; opt.textContent = q.title;
    sel.appendChild(opt);
  });
}

async function loadQuestions(csvPath) {
  const rows = await loadCSV(csvPath);
  const cleaned = rows.map((r, idx) => ({
    index: idx,
    question: r.question,
    option_a: r.option_a, option_b: r.option_b, option_c: r.option_c, option_d: r.option_d,
    correct: r.correct || '',
    time: Number(r.time || app.config.defaultTimeSec || 180),
    explanation: r.explanation || '',
    feedback: r.feedback || '',
    image: r.image || ''
  })).filter(q => (q.question||'').trim() !== '');
  return cleaned;
}

function makeStudent() {
  const name = $('#studentName').value.trim();
  const id = $('#studentId').value.trim();
  return { name, id };
}

function startTimer() {
  clearInterval(app.timerInterval);
  app.state.lastTick = Date.now();
  app.timerInterval = setInterval(() => {
    const i = app.state.index;
    const now = Date.now();
    const dt = Math.floor((now - app.state.lastTick) / 1000);
    if (dt > 0) {
      app.state.perQuestionTime[i] += dt;
      app.state.lastTick = now;
      Engine.persist(app.state);
      const limit = app.state.questions[i].time;
      const elapsed = app.state.perQuestionTime[i];
      const remaining = Math.max(0, limit - elapsed);
      $('#timer').textContent = app.config.showTimer ? `Temps restant: ${fmtSec(remaining)}` : '';
      if (app.config.enforceTimer && remaining <= 0) {
        goNext();
      }
    }
  }, 1000);
}

function showScreen(id) {
  $('#screenStart').classList.add('hidden');
  $('#screenQuiz').classList.add('hidden');
  $('#screenEnd').classList.add('hidden');
  $(id).classList.remove('hidden');
}

function renderQuestion() {
  const i = app.state.index;
  const q = app.state.questions[i];
  $('#progressText').textContent = `Question ${i+1}/${app.state.questions.length}`;

  let options = [
    { key: 'A', text: q.option_a },
    { key: 'B', text: q.option_b },
    { key: 'C', text: q.option_c },
    { key: 'D', text: q.option_d },
  ];
  if (app.config.shuffleOptions) options = shuffle(options);

  const selected = (app.state.answers[i] || '').toUpperCase();

  const imgHtml = q.image ? `<img src="${q.image}" alt="" class="q-img">` : '';

  $('#questionCard').innerHTML = `
    <div class="q-title">${q.question}</div>
    ${imgHtml}
    <div class="options">
      ${options.map(o => `
        <label class="option">
          <input type="radio" name="opt" value="${o.key}" ${selected===o.key?'checked':''}>
          <span><strong>${o.key}.</strong> ${o.text}</span>
        </label>
      `).join('')}
    </div>
    <div class="row">
      <span class="badge">Temps par question: ${fmtSec(q.time)}</span>
      ${app.config.feedbackMode === 'immediate' && selected ?
        `<span class="badge">${selected.toUpperCase() === q.correct.toUpperCase() ? 'Bonne réponse' : 'Mauvaise réponse'}</span>`
       : ''}
    </div>
    ${app.config.feedbackMode === 'immediate' && selected && q.explanation ?
      `<div class="mt"><em>Explication:</em> ${q.explanation}</div>` : ''}
  `;

  $$('input[name="opt"]').forEach(r => {
    r.addEventListener('change', (e) => {
      app.state.answers[i] = e.target.value;
      Engine.persist(app.state);
      if (app.config.feedbackMode === 'immediate') {
        renderQuestion();
      }
    });
  });

  $('#prevBtn').disabled = !app.config.allowBack || i === 0;
  $('#nextBtn').textContent = (i === app.state.questions.length - 1) ? 'Terminer' : 'Suivant →';
  startTimer();
}

function goPrev() {
  if (!app.config.allowBack) return;
  if (app.state.index > 0) {
    app.state.index--;
    Engine.persist(app.state);
    renderQuestion();
  }
}

function goNext() {
  if (app.state.index < app.state.questions.length - 1) {
    app.state.index++;
    Engine.persist(app.state);
    renderQuestion();
  } else {
    finish();
  }
}

function finish() {
  app.state.finishedAt = Date.now();
  clearInterval(app.timerInterval);
  const sc = Engine.computeScore(app.state);
  showScreen('#screenEnd');
  $('#resultSummary').innerHTML = `
    <dl class="kv">
      <dt>Nom</dt><dd>${app.state.student.name} ${app.state.student.id ? '('+app.state.student.id+')' : ''}</dd>
      <dt>Quiz</dt><dd>${app.state.quizId}</dd>
      <dt>Score</dt><dd>${sc.raw} / ${sc.max} (${sc.percent}%)</dd>
      <dt>Temps total</dt><dd>${fmtSec(app.state.perQuestionTime.reduce((a,b)=>a+b,0))}</dd>
      <dt>Réussite</dt><dd>${sc.percent >= (app.config.passingScore||60) ? 'Réussi' : 'Non réussi'}</dd>
    </dl>
  `;
  $('#reviewList').innerHTML = '';
  if (app.config.feedbackMode !== 'immediate') renderReview(sc);
}

function renderReview(sc) {
  const out = [];
  app.state.questions.forEach((q, i) => {
    const sel = (app.state.answers[i] || '').toUpperCase();
    const ok = sel === (q.correct || '').toUpperCase();
    out.push(`
      <div class="card mt">
        <div><strong>Q${i+1}.</strong> ${q.question}</div>
        <div class="mt"><strong>Votre réponse:</strong> ${sel || '—'} ${sel ? `(${ok?'correcte':'incorrecte'})` : ''}</div>
        <div><strong>Bonne réponse:</strong> ${q.correct || '—'}</div>
        ${q.explanation ? `<div class="mt"><em>Explication:</em> ${q.explanation}</div>` : ''}
      </div>
    `);
  });
  $('#reviewList').innerHTML = out.join('');
}

function buildPayload() {
  const sc = Engine.computeScore(app.state);
  return {
    quizId: app.state.quizId,
    student: app.state.student,
    score: { raw: sc.raw, max: sc.max, percent: sc.percent },
    time: {
      totalSec: app.state.perQuestionTime.reduce((a,b)=>a+b,0),
      perQuestion: app.state.perQuestionTime
    },
    answers: sc.details,
    meta: {
      ua: navigator.userAgent,
      ts: Math.floor(Date.now()/1000)
    }
  };
}

async function sendResults() {
  const cfg = app.config.sendResults || {};
  if (!cfg.enabled || !cfg.endpoint) {
    alert('Envoi non configuré.');
    return;
  }
  const payload = buildPayload();

  // ⚠️ PAS d'en-têtes custom (pas de X-API-Key en header).
  //     Si tu veux une clé, mets-la DANS le body (payload.apiKey).
  if (cfg.apiKey) payload.apiKey = cfg.apiKey;

  // 1) tentative "propre" (si un jour Google autorise CORS ici)
  try {
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // <-- déclenche souvent un preflight
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    await res.json().catch(() => ({}));
    alert('Résultats envoyés. Merci!');
    return;
  } catch (_) {
    // 2) Fallback CORS-safe : "simple request" => pas de preflight
    await fetch(cfg.endpoint, {
      method: 'POST',
      mode: 'no-cors',                     // réponse opaque (on ne la lit pas)
      headers: { 'Content-Type': 'text/plain' }, // simple request
      body: JSON.stringify(payload)        // on envoie quand même du JSON en texte
    });
    alert('Résultats envoyés (mode compatible CORS). Vérifie la feuille Google pour confirmer.');
  }
}



function downloadResults() {
  const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const base = (app.state.quizId || 'quiz') + '_' + (app.state.student.name || 'etudiant').replace(/\s+/g,'-');
  a.href = URL.createObjectURL(blob);
  a.download = `resultat_${base}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function applyThemeToggle() {
  const btn = $('#themeToggle');
  if (!btn) return;
  const apply = (mode) => {
    document.documentElement.dataset.theme = mode;
    try { localStorage.setItem('theme', mode); } catch(_){}
  };
  btn.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    apply(cur === 'dark' ? 'light' : 'dark');
  });
}

function wireEvents() {
  $('#prevBtn').addEventListener('click', goPrev);
  $('#nextBtn').addEventListener('click', goNext);
  $('#reviewBtn').addEventListener('click', () => renderReview(Engine.computeScore(app.state)));
  $('#downloadBtn').addEventListener('click', downloadResults);
  $('#sendBtn').addEventListener('click', sendResults);
  $('#resetBtn').addEventListener('click', () => {
    if (confirm('Effacer toutes les tentatives locales sur cet appareil ?')) {
      Engine.clearAll();
      alert('Données locales effacées.');
    }
  });
  $('#resumeBtn').addEventListener('click', async () => {
    const q = app.quizzes[0];
    const student = makeStudent();
    if (!student.name) { alert('Entrez votre nom pour reprendre.'); return; }
    const attempt = Engine.loadAttempt(q.id, student);
    if (!attempt) { alert('Aucune tentative sauvegardée pour cet étudiant.'); return; }
    app.state = attempt;
    showScreen('#screenQuiz');
    renderQuestion();
  });

  $('#startForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const student = makeStudent();
    if (!student.name) { alert('Veuillez indiquer votre nom.'); return; }
    const q = app.quizzes[0];
    const questions = await loadQuestions(q.csv);
    let qs = questions;
    if (app.config.shuffleQuestions) qs = shuffle(qs);
    app.state = Engine.createState({ quizId: q.id, questions: qs, config: app.config, student });
    Engine.persist(app.state);
    showScreen('#screenQuiz');
    renderQuestion();
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  applyThemeToggle();
  wireEvents();
});
