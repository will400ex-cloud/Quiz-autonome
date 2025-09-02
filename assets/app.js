// UI logic (v5): Auto-list CSVs via GitHub API (Option A) + CORS-safe sendResults
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const app = { config:null, quizzes:[], state:null, timerInterval:null };

function pad(n){ return String(n).padStart(2,'0'); }
function fmtSec(s){ const m=Math.floor(s/60), r=s%60; return `${m}:${pad(r)}`; }
function shuffle(arr){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }

// --- GitHub Pages auto-discovery ---
function guessRepoInfoFromPagesURL() {
  const host = location.host; // e.g., will400ex-cloud.github.io
  const path = location.pathname; // /repo/...
  const owner = host.split('.')[0];
  const parts = path.split('/').filter(Boolean);
  const repo = parts.length ? parts[0] : '';
  return { owner, repo };
}
async function listCsvViaGitHubAPI(owner, repo, branchGuess='main') {
  const branches = [branchGuess, 'gh-pages', 'master'];
  for (const br of branches) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/data?ref=${br}`;
    try {
      const res = await fetch(url, { headers: { 'Accept':'application/vnd.github.v3+json' } });
      if (!res.ok) continue; // passe à la branche suivante sans bruit
      const items = await res.json();
      const csvs = (items||[])
        .filter(it => it.type==='file' && /\.csv$/i.test(it.name))
        .map(it => ({ id: it.name.replace(/\.csv$/i,''), title: it.name, csv: `data/${it.name}` }));
      if (csvs.length) return csvs;
    } catch { /* ignore et continue */ }
  }
  return [];
}


// --- Core ---
async function loadConfig() {
  const res = await fetch('data/config.json', { cache:'no-store' });
  if (!res.ok) throw new Error('Impossible de charger data/config.json');
  app.config = await res.json();

  // Try auto-index first if quizzes not provided
  if (!Array.isArray(app.config.quizzes) || app.config.quizzes.length===0) {
    try {
      const { owner, repo } = guessRepoInfoFromPagesURL();
      if (owner && repo && location.hostname.endsWith('github.io')) {
        const auto = await listCsvViaGitHubAPI(owner, repo);
        if (auto.length) app.quizzes = auto;
      }
    } catch (e) { console.warn('Auto-liste GitHub API échouée:', e); }
  }
  // Fallbacks
  if (!app.quizzes.length && app.config.quizzes && app.config.quizzes.length) {
    app.quizzes = app.config.quizzes.map(q=>({id:q.id, title:q.title||q.id, csv:q.csv}));
  }
  if (!app.quizzes.length) {
    app.quizzes = [{ id: app.config.quizId || 'quiz', title: app.config.title || 'Quiz autonome', csv: app.config.csvPath || 'data/questions.csv' }];
  }

const elTitle = $('#appTitle');
if (elTitle) elTitle.textContent = 'Questionnaire en TGÉ';

const elSubtitle = $('#appSubtitle');
if (elSubtitle) elSubtitle.textContent = app.config.subtitle || 'Répondez à votre rythme';

const elFoot = $('#foot');
if (elFoot) elFoot.textContent = `© ${new Date().getFullYear()} — Questionnaire en TGÉ`;

// Cette ligne ne fait plus rien si l’aperçu a été supprimé (pas d’erreur)
const elCfg = $('#configPreview');
if (elCfg) elCfg.textContent = JSON.stringify(app.config, null, 2);


  const sel = $('#quizSelect'); sel.innerHTML='';
  app.quizzes.forEach(q => { const opt=document.createElement('option'); opt.value=q.id; opt.textContent=q.title; sel.appendChild(opt); });
}

function selectedQuiz() {
  const id = $('#quizSelect').value;
  return app.quizzes.find(q => q.id === id) || app.quizzes[0];
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
  if (!cleaned.length) throw new Error('CSV chargé mais aucune question valide trouvée.');
  return cleaned;
}

function makeStudent(){ return { name: $('#studentName').value.trim(), id: $('#studentId').value.trim() }; }

function startTimer() {
  clearInterval(app.timerInterval); app.state.lastTick=Date.now();
  app.timerInterval = setInterval(() => {
    const i=app.state.index, now=Date.now(); const dt=Math.floor((now-app.state.lastTick)/1000);
    if (dt>0) {
      app.state.perQuestionTime[i]+=dt; app.state.lastTick=now; Engine.persist(app.state);
      const limit=app.state.questions[i].time, elapsed=app.state.perQuestionTime[i], remaining=Math.max(0, limit-elapsed);
      $('#timer').textContent = app.config.showTimer ? `Temps restant: ${fmtSec(remaining)}` : '';
      if (app.config.enforceTimer && remaining<=0) goNext();
    }
  }, 1000);
}

function showScreen(id){ ['#screenStart','#screenQuiz','#screenEnd'].forEach(s=>$(s).classList.add('hidden')); $(id).classList.remove('hidden'); }

function renderQuestion(){
  const i=app.state.index, q=app.state.questions[i];
  $('#progressText').textContent = `Question ${i+1}/${app.state.questions.length}`;
  let options=[
    {key:'A', text:q.option_a}, {key:'B', text:q.option_b}, {key:'C', text:q.option_c}, {key:'D', text:q.option_d}
  ];
  if (app.config.shuffleOptions) options=shuffle(options);
  const selected=(app.state.answers[i]||'').toUpperCase();
  const imgHtml = q.image ? `<img src="${q.image}" alt="" class="q-img">` : '';
  $('#questionCard').innerHTML = `
    <div class="q-title">${q.question}</div>
    ${imgHtml}
    <div class="options">
      ${options.map(o => o.text ? `
        <label class="option">
          <input type="radio" name="opt" value="${o.key}" ${selected===o.key?'checked':''}>
          <span><strong>${o.key}.</strong> ${o.text}</span>
        </label>` : '').join('')}
    </div>
    <div class="row">
      <span class="badge">Temps par question: ${fmtSec(q.time)}</span>
      ${app.config.feedbackMode==='immediate' && selected ? `<span class="badge">${selected===(q.correct||'').toUpperCase() ? 'Bonne réponse':'Mauvaise réponse'}</span>` : ''}
    </div>
    ${app.config.feedbackMode==='immediate' && selected && q.explanation ? `<div class="mt"><em>Explication:</em> ${q.explanation}</div>` : ''}
  `;
  if (!$$('input[name="opt"]').length) {
    $('#questionCard').insertAdjacentHTML('beforeend', `<div class="mt" style="color:#b91c1c"><strong>Erreur :</strong> aucune option trouvée. Vérifiez les colonnes <code>option_a</code>…<code>option_d</code> dans votre CSV.</div>`);
  }
  $$('input[name="opt"]').forEach(r => r.addEventListener('change', e => { app.state.answers[i]=e.target.value; Engine.persist(app.state); if(app.config.feedbackMode==='immediate') renderQuestion(); }));
  $('#prevBtn').disabled = !app.config.allowBack || i===0;
  $('#nextBtn').textContent = (i===app.state.questions.length-1) ? 'Terminer' : 'Suivant →';
  startTimer();
}

function goPrev(){ if(!app.config.allowBack) return; if(app.state.index>0){ app.state.index--; Engine.persist(app.state); renderQuestion(); } }
function goNext(){ if(app.state.index<app.state.questions.length-1){ app.state.index++; Engine.persist(app.state); renderQuestion(); } else { finish(); } }

function finish(){
  app.state.finishedAt=Date.now(); clearInterval(app.timerInterval);
  const sc=Engine.computeScore(app.state);
  showScreen('#screenEnd');
  $('#resultSummary').innerHTML = `
    <dl class="kv">
      <dt>Nom</dt><dd>${app.state.student.name} ${app.state.student.id ? '('+app.state.student.id+')' : ''}</dd>
      <dt>Quiz</dt><dd>${app.state.quizId}</dd>
      <dt>Score</dt><dd>${sc.raw} / ${sc.max} (${sc.percent}%)</dd>
      <dt>Temps total</dt><dd>${fmtSec(app.state.perQuestionTime.reduce((a,b)=>a+b,0))}</dd>
      <dt>Réussite</dt><dd>${sc.percent >= (app.config.passingScore||60) ? 'Réussi' : 'Non réussi'}</dd>
    </dl>`;
  $('#reviewList').innerHTML='';
  if (app.config.feedbackMode !== 'immediate') renderReview(sc);
}

function renderReview(sc){
  const out=[];
  app.state.questions.forEach((q,i)=>{
    const sel=(app.state.answers[i]||'').toUpperCase();
    const ok=sel===(q.correct||'').toUpperCase();
    out.push(`<div class="card mt">
      <div><strong>Q${i+1}.</strong> ${q.question}</div>
      <div class="mt"><strong>Votre réponse:</strong> ${sel || '—'} ${sel ? `(${ok?'correcte':'incorrecte'})` : ''}</div>
      <div><strong>Bonne réponse:</strong> ${q.correct || '—'}</div>
      ${q.explanation ? `<div class="mt"><em>Explication:</em> ${q.explanation}</div>` : ''}
    </div>`);
  });
  $('#reviewList').innerHTML = out.join('');
}

function buildPayload(){
  const sc=Engine.computeScore(app.state);
  return {
    quizId: app.state.quizId,
    student: app.state.student,
    score: { raw: sc.raw, max: sc.max, percent: sc.percent },
    time: { totalSec: app.state.perQuestionTime.reduce((a,b)=>a+b,0), perQuestion: app.state.perQuestionTime },
    answers: sc.details,
    meta: { ua: navigator.userAgent, ts: Math.floor(Date.now()/1000) }
  };
}
function downloadResults() {
  if (!app.state) { alert('Aucun résultat à télécharger.'); return; }
  const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const name = (app.state.student?.name || 'etudiant').replace(/\s+/g,'-');
  a.href = URL.createObjectURL(blob);
  a.download = `resultat_${app.state.quizId}_${name}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
// --- CORS-safe sender ---
async function sendResults() {
  const cfg = app.config.sendResults || {};
  if (!cfg.enabled || !cfg.endpoint) {
    alert('Envoi non configuré.');
    return;
  }
  const payload = buildPayload();
  // ⚠️ pas d'en-têtes customs; si tu veux une clé, ajoute-la DANS le body :
  if (cfg.apiKey) payload.apiKey = cfg.apiKey;

  try {
    await fetch(cfg.endpoint, {
      method: 'POST',
      mode: 'no-cors',                  // évite toute preflight
      headers: { 'Content-Type': 'text/plain' }, // "simple request"
      body: JSON.stringify(payload)     // JSON envoyé comme texte
    });
    // Réponse "opaque": on ne peut pas la lire, c’est normal.
    alert('Résultats envoyés (mode compatible CORS). Vérifie la feuille Google pour confirmer.');
  } catch (err) {
    console.error(err);
    alert('Échec de l’envoi. Vérifie l’URL du Web App et redéploie-le.');
  }
}

function applyThemeToggle(){
  const btn=$('#themeToggle'); if(!btn) return;
  const apply=(mode)=>{ document.documentElement.dataset.theme=mode; try{localStorage.setItem('theme',mode);}catch(_){}};
  btn.addEventListener('click', ()=>{ const cur=document.documentElement.dataset.theme==='dark'?'dark':'light'; apply(cur==='dark'?'light':'dark'); });
}

function wireEvents(){
  $('#prevBtn').addEventListener('click', goPrev);
  $('#nextBtn').addEventListener('click', goNext);
  $('#downloadBtn').addEventListener('click', downloadResults);
  $('#sendBtn').addEventListener('click', sendResults);
  $('#resetBtn').addEventListener('click', ()=>{ if(confirm('Voulez-vous vraiment effacer toutes vos réponses sauvegardées localement et recommencer le quiz à zéro ?')){ Engine.clearAll(); alert('Données locales effacées.'); } });
  $('#resumeBtn').addEventListener('click', async ()=>{
    const q=selectedQuiz(); const student=makeStudent(); if(!student.name){ alert('Entrez votre nom pour reprendre.'); return; }
    const attempt=Engine.loadAttempt(q.id, student); if(!attempt){ alert('Aucune tentative sauvegardée pour cet étudiant.'); return; }
    app.state=attempt; showScreen('#screenQuiz'); renderQuestion();
  });
  $('#startForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const student=makeStudent(); if(!student.name){ alert('Veuillez indiquer votre nom.'); return; }
    const q=selectedQuiz(); let questions;
    try { questions=await loadQuestions(q.csv); } catch(err){ alert('Erreur de chargement des questions:\\n'+err.message); return; }
    let qs=questions; if(app.config.shuffleQuestions) qs=shuffle(qs);
    app.state=Engine.createState({ quizId:q.id, questions:qs, config:app.config, student });
    Engine.persist(app.state); showScreen('#screenQuiz'); renderQuestion();
  });
}

window.addEventListener('DOMContentLoaded', async ()=>{
  try { await loadConfig(); } catch(e){ alert('Erreur de configuration: '+e.message); }
  applyThemeToggle();
  wireEvents();
});
