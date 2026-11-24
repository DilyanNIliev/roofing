/* Логика за автоматично заместване. Работи в браузър и в Node (за тестове). */
(function (root) {
  function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
  function dayOf(s) { return parseDate(s).getUTCDay(); } // 0=нд, 1=пн ... 5=пт
  function norm(s) { return String(s || '').trim().toLowerCase(); }
  function absCovers(a, h) { return !a.hours || a.hours.includes(h); }
  function hasSpec(t, subject) { const n = norm(subject); return !!n && t.subjects.some(s => norm(s) === n); }

  // Унгарски алгоритъм (минимална цена), n реда <= m колони
  function hungarian(cost) {
    const n = cost.length, m = cost[0].length, INF = 1e12;
    const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i; let j0 = 0;
      const minv = Array(m + 1).fill(INF), used = Array(m + 1).fill(false);
      do {
        used[j0] = true;
        const i0 = p[j0]; let delta = INF, j1 = 0;
        for (let j = 1; j <= m; j++) if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= m; j++) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const res = Array(n).fill(-1);
    for (let j = 1; j <= m; j++) if (p[j]) res[p[j] - 1] = j - 1;
    return res;
  }

  const COST = { specialist: 0, specialistAfter: 5, afterschool: 30, free: 50, load: 3, none: 1000 };

  // Кои учители са свободни в даден час (за ръчен избор)
  function availableAt(state, date, h) {
    const dow = dayOf(date), key = dow + '-' + h;
    const absentNow = new Set((state.absences[date] || []).filter(a => absCovers(a, h)).map(a => a.teacherId));
    const teaching = new Set();
    for (const c of state.classes) { const l = c.lessons[key]; if (l && l.teacherId) teaching.add(l.teacherId); }
    return state.teachers.filter(t => !absentNow.has(t.id) && !teaching.has(t.id) &&
      !(t.busy && t.busy[key]));
  }

  function compute(state, date) {
    const dow = dayOf(date);
    if (dow < 1 || dow > 5) return { weekend: true, items: [], load: {} };
    const H = state.settings.hours, abs = state.absences[date] || [];
    const tById = Object.fromEntries(state.teachers.map(t => [t.id, t]));
    const items = [], load = {};

    for (let h = 1; h <= H; h++) {
      const key = dow + '-' + h;
      const absentNow = new Set(abs.filter(a => absCovers(a, h)).map(a => a.teacherId));
      const teaching = new Set(), need = [];
      for (const c of state.classes) {
        const l = c.lessons[key];
        if (!l || !l.teacherId) continue;
        if (absentNow.has(l.teacherId)) need.push({ c, l }); else teaching.add(l.teacherId);
      }
      if (!need.length) continue;

      const used = new Set(), free = [], hourItems = [];
      const mk = (n, subId, kind) => ({
        hour: h, classId: n.c.id, className: n.c.name, subject: n.l.subject,
        absentId: n.l.teacherId, subId, kind
      });

      for (const n of need) {            // ръчно фиксирани
        const pin = (state.pins || {})[date + '|' + n.c.id + '|' + h];
        if (pin === 'none') { hourItems.push({ ...mk(n, null, 'none'), pinned: true }); continue; }
        if (pin && tById[pin] && !absentNow.has(pin) && !teaching.has(pin) && !used.has(pin)) {
          used.add(pin); hourItems.push({ ...mk(n, pin, 'pinned'), pinned: true }); continue;
        }
        free.push(n);
      }

      if (free.length) {
        const cands = state.teachers.filter(t => !absentNow.has(t.id) && !teaching.has(t.id) && !used.has(t.id) &&
          !(t.busy && t.busy[key]) && (t.kind === 'afterschool' || state.settings.allowFree));
        const cols = cands.length + free.length;
        const cost = free.map(n => {
          const row = [];
          for (const t of cands) {
            const sp = hasSpec(t, n.l.subject);
            let c = sp ? (t.kind === 'afterschool' ? COST.specialistAfter : COST.specialist)
                       : (t.kind === 'afterschool' ? COST.afterschool : COST.free);
            row.push(c + COST.load * (load[t.id] || 0));
          }
          for (let k = 0; k < free.length; k++) row.push(COST.none);
          return row;
        });
        const asg = hungarian(cost);
        free.forEach((n, i) => {
          const j = asg[i];
          if (j >= 0 && j < cands.length) {
            const t = cands[j];
            const kind = hasSpec(t, n.l.subject) ? 'specialist' : (t.kind === 'afterschool' ? 'afterschool' : 'free');
            hourItems.push(mk(n, t.id, kind));
          } else hourItems.push(mk(n, null, 'none'));
        });
      }
      for (const it of hourItems) if (it.subId) load[it.subId] = (load[it.subId] || 0) + 1;
      hourItems.sort((a, b) => state.classes.findIndex(c => c.id === a.classId) - state.classes.findIndex(c => c.id === b.classId));
      items.push(...hourItems);
    }
    return { weekend: false, items, load };
  }

  const api = { compute, availableAt, dayOf, hasSpec, norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Scheduler = api;
})(typeof window !== 'undefined' ? window : globalThis);
