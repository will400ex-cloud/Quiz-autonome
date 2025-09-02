// Quiz engine (state, scoring, persistence)
const Engine = (() => {
  const LS_KEY = (quizId, studentKey) => `quizrun:${quizId}:${studentKey}`;

  function createState({ quizId, questions, config, student }) {
    return {
      quizId,
      student,
      index: 0,
      questions,
      answers: Array(questions.length).fill(null),
      startedAt: Date.now(),
      perQuestionTime: Array(questions.length).fill(0),
      lastTick: Date.now(),
      finishedAt: null,
      config
    };
  }

  function computeScore(state) {
    let raw = 0;
    const details = [];
    state.questions.forEach((q, i) => {
      const isCorrect = (state.answers[i] || '').toUpperCase() === (q.correct || '').toUpperCase();
      if (isCorrect) raw++;
      details.push({ q: i+1, choice: (state.answers[i] || ''), correct: (q.correct || ''), isCorrect });
    });
    return {
      raw,
      max: state.questions.length,
      percent: state.questions.length ? Math.round((raw*100)/state.questions.length) : 0,
      details
    };
  }

  function persist(state) {
    const studentKey = (state.student.name + '|' + (state.student.id||'')).trim().toLowerCase();
    localStorage.setItem(LS_KEY(state.quizId, studentKey), JSON.stringify(state));
  }

  function loadPersisted(quizId) {
    // return list of attempts for this quiz
    const all = [];
    for (let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if (k.startsWith(`quizrun:${quizId}:`)) {
        const raw = localStorage.getItem(k);
        try { all.push(JSON.parse(raw)); } catch {}
      }
    }
    return all;
  }

  function loadAttempt(quizId, student) {
    const studentKey = (student.name + '|' + (student.id||'')).trim().toLowerCase();
    const raw = localStorage.getItem(LS_KEY(quizId, studentKey));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function clearAll() {
    const keys = [];
    for (let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if (k.startsWith('quizrun:')) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }

  return { createState, computeScore, persist, loadPersisted, loadAttempt, clearAll };
})();
