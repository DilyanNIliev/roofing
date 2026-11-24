'use strict';
const KEY = 'school-substitutions-v1';
const DAYS = ['', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък'];
const KIND_LABEL = { specialist: 'по специалност', afterschool: 'от занималня', free: 'свободен час', pinned: 'ръчно избран', none: 'НЯМА ЗАМЕСТНИК' };
const $app = document.getElementById('app');

const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function blank() {
  return { settings: { hours: 7, allowFree: true, norm: 18, weeks: 36 }, teachers: [], classes: [], absences: {}, pins: {}, log: {}, ui: { tab: 'sub', date: todayStr(), classId: null } };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) return Object.assign(blank(), s, { ui: Object.assign(blank().ui, s.ui || {}, { date: todayStr() }) });
  } catch (e) {}
  return blank();
}
let state = load();
state.teachers.forEach((t, i) => { if (!t.color) t.color = teacherColor(i); });
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

const teacherColor = i => `hsl(${Math.round((i * 137.508) % 360)},${i % 2 ? 72 : 62}%,${i % 3 === 0 ? 74 : i % 3 === 1 ? 82 : 68}%)`;
const GREY = '#c6c9d1';
const colorOf = id => (tById(id) || {}).color || GREY;
const shortName = id => { const t = tById(id); if (!t) return '—'; const p = t.name.split(' '); return p.length > 1 ? p[0][0] + '. ' + p.slice(1).join(' ') : t.name; };
const weeklyLoad = id => state.classes.reduce((n, c) => n + Object.values(c.lessons).filter(l => l.teacherId === id).length, 0) + 5 * (Number((state.teachers.find(t => t.id === id) || {}).afterHours) || 0);
function workdays(from, to) {
  const out = [], a = new Date(from + 'T00:00:00Z'), b = new Date((to || from) + 'T00:00:00Z');
  for (let d = a; d <= b && out.length < 400; d = new Date(d.getTime() + 864e5)) { const w = d.getUTCDay(); if (w >= 1 && w <= 5) out.push(d.toISOString().slice(0, 10)); }
  return out;
}
const NORM = () => Number(state.settings.norm) || 18, WEEKS = () => Number(state.settings.weeks) || 36;
const dayLoad = id => [1, 2, 3, 4, 5].map(d => (Number((state.teachers.find(t => t.id === id) || {}).afterHours) || 0) + state.classes.reduce((n, c) => n + Object.entries(c.lessons).filter(([k, l]) => l.teacherId === id && k.startsWith(d + '-')).length, 0));
function normCell(t) {
  const w = weeklyLoad(t.id), days = dayLoad(t.id).join('/');
  const fr = freeCount(t), tot = 5 * state.settings.hours, frc = `<td>${fr}/${tot}</td>`;
  if (!w) return `<td><b>0</b></td><td>0/0/0/0/0</td><td>0</td>${frc}<td><span class="badge b-none">няма часове!</span></td>`;
  if (t.kind !== 'teacher' && !t.afterHours) return `<td><b>${w}</b></td><td>${days}</td><td>${w * WEEKS()}</td>${frc}<td class="muted">няма норма</td>`;
  const diff = w - NORM(), cls = diff < 0 ? 'b-free' : diff <= 4 ? 'b-specialist' : 'b-none', sg = diff > 0 ? '+' : '';
  return `<td><b>${w}</b></td><td>${days}</td><td>${w * WEEKS()}</td>${frc}<td><span class="badge ${cls}">${sg}${diff} ч. (${sg}${diff * WEEKS()}/год.)</span></td>`;
}
function teacherSlot(id, key) {
  for (const c of state.classes) { const l = c.lessons[key]; if (l && l.teacherId === id) return { cls: c.name, subject: l.subject }; }
  return null;
}
function freeCount(t) {
  let n = 0;
  for (let d = 1; d <= 5; d++) for (let h = 1; h <= state.settings.hours; h++) { const k = d + '-' + h; if (!teacherSlot(t.id, k) && !(t.busy || {})[k]) n++; }
  return n;
}
function scheduleGrid(t) {
  const H = state.settings.hours;
  let g = `<div class="tablewrap"><table class="tg"><tr><th>Час</th>${[1, 2, 3, 4, 5].map(d => `<th>${DAYS[d]}</th>`).join('')}</tr>`;
  for (let n = 1; n <= H; n++) {
    g += `<tr><th>${n}</th>`;
    for (let d = 1; d <= 5; d++) {
      const k = d + '-' + n, s = teacherSlot(t.id, k);
      if (s) g += `<td class="lesson" style="background:${t.color}" title="${esc(s.subject)}"><b>${esc(s.cls)}</b><br><span>${esc(s.subject.slice(0, 22))}</span></td>`;
      else if ((t.busy || {})[k]) g += `<td class="blocked" data-act="busy" data-id="${t.id}" data-key="${k}" title="Кликни, за да го освободиш">заето</td>`;
      else g += `<td class="free" data-act="busy" data-id="${t.id}" data-key="${k}" title="Свободен – може да замества. Кликни, за да го отбележиш като заето">свободен</td>`;
    }
    g += `</tr>`;
  }
  const ah = Number(t.afterHours) || 0;
  for (let n = 1; n <= ah; n++) g += `<tr><th class="muted">зан. ${n}</th>${[1, 2, 3, 4, 5].map(() => `<td class="lesson" style="background:${t.color}"><b>Занималня</b></td>`).join('')}</tr>`;
  return g + `</table></div>`;
}
const byName = (a, b) => a.name.localeCompare(b.name, 'bg');
const sortedTeachers = () => [...state.teachers].sort(byName);
const tById = id => state.teachers.find(t => t.id === id);
const tName = id => (tById(id) || {}).name || '—';
const norm = Scheduler.norm;
function allSubjects() {
  const set = new Set();
  state.teachers.forEach(t => t.subjects.forEach(s => set.add(s)));
  state.classes.forEach(c => Object.values(c.lessons).forEach(l => l.subject && set.add(l.subject)));
  return [...set].sort((a, b) => a.localeCompare(b, 'bg'));
}

/* ---------- Заместване ---------- */
function snapshot() {
  const map = new Map();
  Scheduler.compute(state, state.ui.date).items.forEach(i => map.set(i.classId + '|' + i.hour, i));
  return map;
}
function recordChanges(before, reason) {
  const after = snapshot(), lines = [];
  const keys = new Set([...before.keys(), ...after.keys()]);
  const sorted = [...keys].sort((a, b) => Number(a.split('|')[1]) - Number(b.split('|')[1]));
  for (const k of sorted) {
    const b = before.get(k), a = after.get(k);
    const bs = b ? b.subId : undefined, as = a ? a.subId : undefined;
    if (b && a && bs === as) continue;
    const it = a || b, cls = state.classes.find(c => c.id === it.classId);
    const nm = x => x === undefined ? null : (x ? tName(x) : 'без заместник');
    if (!a) lines.push(`${it.hour}. час, ${cls.name} (${it.subject}): вече не се нуждае от заместник`);
    else if (!b) lines.push(`${it.hour}. час, ${cls.name} (${it.subject}): заместник → <b>${esc(nm(as))}</b>`);
    else lines.push(`${it.hour}. час, ${cls.name} (${it.subject}): ${esc(nm(bs))} → <b>${esc(nm(as))}</b>`);
  }
  state.log[state.ui.date] = { reason, lines };
  save();
}
function changeAbsences(reason, fn) {
  const before = snapshot();
  fn();
  recordChanges(before, reason);
  render();
}

function viewSub() {
  const date = state.ui.date, res = Scheduler.compute(state, date);
  const abs = state.absences[date] || [];
  const H = state.settings.hours;
  const absentIds = new Set(abs.map(a => a.teacherId));
  const endOk = state.ui.endDate && state.ui.endDate > date;
  const opts = sortedTeachers().filter(t => !absentIds.has(t.id))
    .map(t => `<option value="${t.id}">${esc(t.name)}${t.kind === 'afterschool' ? ' (занималня)' : ''}</option>`).join('');
  let h = `<div class="card"><h2>Дата и отсъстващи учители</h2>
  <div class="row noprint"><label class="small">От <input type="date" id="date" value="${date}"></label>
   <label class="small">до (по избор) <input type="date" id="endDate" value="${state.ui.endDate || ''}" min="${date}"></label>
   <select id="absSel"><option value="">— избери отсъстващ учител —</option>${opts}</select>
   <button class="btn pri" data-act="add-abs">Добави отсъствие${endOk ? ' за периода' : ''}</button></div>
   ${endOk ? `<p class="muted small noprint">Период: ${date} – ${state.ui.endDate} (${workdays(date, state.ui.endDate).length} работни дни; събота и неделя се пропускат).</p>` : ''}`;
  if (res.weekend) h += `<p class="muted">Избраната дата е почивен ден.</p>`;
  if (!state.teachers.length) h += `<p class="alert">Още няма въведени учители. Започни от таба „Учители“ или зареди примерни данни от „Данни“.</p>`;
  h += abs.map(a => {
    const chips = Array.from({ length: H }, (_, i) => i + 1).map(n =>
      `<span class="chip ${!a.hours || a.hours.includes(n) ? 'on' : ''}" data-act="abs-hour" data-id="${a.teacherId}" data-h="${n}">${n}</span>`).join('');
    return `<div class="abs"><b>${esc(tName(a.teacherId))}</b><span class="muted small">отсъства в часове:</span><div class="chips">${chips}</div>
      <button class="btn del noprint" data-act="del-abs" data-id="${a.teacherId}">✕ Премахни</button>
      ${endOk ? `<button class="btn del noprint" data-act="del-abs-range" data-id="${a.teacherId}">✕ Премахни за периода</button>` : ''}</div>`;
  }).join('');
  h += `</div>`;

  if (!res.weekend && state.classes.length) h += viewGrid(date, res);
  const lg = state.log[date];
  if (lg && lg.lines.length) h += `<div class="card"><h2>Последни промени в разпределението</h2><div class="muted small">${esc(lg.reason)}</div><ul class="log">${lg.lines.map(l => `<li>${l}</li>`).join('')}</ul></div>`;

  if (!res.weekend && abs.length) {
    const none = res.items.filter(i => !i.subId).length;
    h += `<div class="card"><div class="row" style="justify-content:space-between"><h2>Замествания</h2><button class="btn noprint" onclick="print()">🖨 Печат</button></div>`;
    if (!res.items.length) h += `<p class="muted">Отсъстващите нямат часове в този ден.</p>`;
    else {
      if (none) h += `<div class="alert bad">⚠ ${none} час(а) остават без заместник.</div>`;
      else h += `<div class="alert ok">✓ Всички часове имат заместник.</div>`;
      h += `<div class="tablewrap"><table><tr><th>Час</th><th>Клас</th><th>Предмет</th><th>Отсъства</th><th>Заместник</th><th>Основание</th></tr>`;
      for (const i of res.items) {
        const av = Scheduler.availableAt(state, date, i.hour).sort(byName);
        const pin = (state.pins || {})[date + '|' + i.classId + '|' + i.hour];
        const so = av.map(t => `<option value="${t.id}" ${pin === t.id ? 'selected' : ''}>${esc(t.name)}${t.kind === 'afterschool' ? ' (занималня)' : ''}${Scheduler.hasSpec(t, i.subject) ? ' ★' : ''}</option>`).join('');
        h += `<tr><td>${i.hour}</td><td>${esc(i.className)}</td><td>${esc(i.subject)}</td><td>${esc(tName(i.absentId))}</td>
          <td><b>${esc(i.subId ? tName(i.subId) : '—')}</b>
          <select class="noprint" data-pin="${date}|${i.classId}|${i.hour}" style="margin-left:6px;max-width:170px">
            <option value="" ${!pin ? 'selected' : ''}>Автоматично</option>
            <option value="none" ${pin === 'none' ? 'selected' : ''}>Без заместник</option>${so}</select></td>
          <td><span class="badge b-${i.kind}">${KIND_LABEL[i.kind]}</span></td></tr>`;
      }
      h += `</table></div><p class="muted small noprint">★ = специалист по предмета. Ръчният избор е фиксиран и автоматиката го запазва; „Автоматично“ го освобождава.</p>`;
      const ld = Object.entries(res.load);
      if (ld.length) h += `<p class="small"><b>Натоварване:</b> ${ld.map(([id, n]) => `${esc(tName(id))} – ${n} зам.`).join(', ')}</p>`;
    }
    h += `</div>`;
  }
  return h;
}

function viewGrid(date, res) {
  const dow = Scheduler.dayOf(date), H = state.settings.hours;
  const lastAny = Math.max(0, ...state.classes.flatMap(c => Object.keys(c.lessons).filter(k => k.startsWith(dow + '-')).map(k => Number(k.split('-')[1]))));
  const cols = Math.min(H, lastAny);
  const byClass = {}; res.items.forEach(i => (byClass[i.classId] = byClass[i.classId] || []).push(i));
  let h = `<div class="card"><h2>Визуален преглед на деня</h2>
  <div class="legend">${sortedTeachers().map(t => `<span class="lg"><span class="sw" style="background:${t.color}"></span>${esc(shortName(t.id))}</span>`).join('')}</div>
  <p class="muted small">Всеки учител е със свой цвят. Час на отсъстващ учител е <b>наполовина сив</b>, а другата половина е в цвета на заместника. Изцяло сив с червено = няма заместник.</p>
  <table class="vgrid"><tr><th>Клас</th>${Array.from({ length: cols }, (_, i) => `<th>${i + 1} ч.</th>`).join('')}<th class="subcol">Заместване</th></tr>`;
  for (const c of state.classes) {
    const its = byClass[c.id] || [];
    h += `<tr><th>${esc(c.name)}</th>`;
    for (let n = 1; n <= cols; n++) {
      const l = c.lessons[dow + '-' + n];
      if (!l || !l.teacherId) { h += `<td class="noclass">–</td>`; continue; }
      const it = its.find(i => i.hour === n), sj = esc(l.subject.length > 24 ? l.subject.slice(0, 23) + '…' : l.subject);
      if (!it) h += `<td style="background:${colorOf(l.teacherId)}"><b>${sj}</b><br><span>${esc(shortName(l.teacherId))}</span></td>`;
      else if (it.subId) h += `<td style="background:linear-gradient(135deg,${GREY} 50%,${colorOf(it.subId)} 50%)"><b>${sj}</b><br><span class="gone">${esc(shortName(l.teacherId))}</span><br><span>→ ${esc(shortName(it.subId))}</span></td>`;
      else h += `<td class="nosub"><b>${sj}</b><br><span class="gone">${esc(shortName(l.teacherId))}</span><br><span>няма заместник</span></td>`;
    }
    h += `<td class="subcol">${its.length ? its.map(i => i.subId ? `<div>${i.hour}. ч.: <b>${esc(shortName(i.subId))}</b> замества ${esc(shortName(i.absentId))}</div>` : `<div class="nosubtxt">${i.hour}. ч.: няма заместник за ${esc(shortName(i.absentId))}</div>`).join('') : '<span class="muted">без замествания</span>'}</td></tr>`;
  }
  h += `</table>`;
  // кой кого замества (по заместник)
  const by = {}; res.items.filter(i => i.subId).forEach(i => (by[i.subId] = by[i.subId] || []).push(i));
  const ids = Object.keys(by).sort((a, b) => tName(a).localeCompare(tName(b), 'bg'));
  h += `<h3 style="margin:16px 0 6px;font-size:15px">Кой кого замества</h3>`;
  if (!ids.length) h += `<p class="muted small">Няма замествания за този ден.</p>`;
  else h += `<ul class="who">${ids.map(id => `<li><span class="sw" style="background:${colorOf(id)}"></span><b>${esc(tName(id))}</b> замества: ${by[id].map(i => `${esc(tName(i.absentId))} (${i.hour}. час, ${esc(i.className)}, ${esc(i.subject)})`).join('; ')}</li>`).join('')}</ul>`;
  const none = res.items.filter(i => !i.subId);
  if (none.length) h += `<p class="alert bad">Без заместник: ${none.map(i => `${i.hour}. час, ${esc(i.className)} (${esc(i.subject)}, отсъства ${esc(tName(i.absentId))})`).join('; ')}</p>`;
  return h + `</div>`;
}

/* ---------- Учители ---------- */
function viewTeachers() {
  const H = state.settings.hours;
  let h = `<div class="card"><h2>Добави учител</h2><div class="row noprint">
   <input id="nt-name" placeholder="Име и фамилия">
   <select id="nt-kind"><option value="teacher">Учител</option><option value="afterschool">Учител от занималня</option></select>
   <input id="nt-subj" list="subjects" placeholder="Специалности (със запетая)" size="34">
   <button class="btn pri" data-act="add-teacher">Добави</button></div></div>
  <div class="card"><h2>Учители (${state.teachers.length})</h2>`;
  if (!state.teachers.length) h += `<p class="muted">Няма учители.</p>`;
  else {
    h += `<div class="tablewrap"><table class="tt"><tr><th></th><th>Име</th><th>Вид</th><th>Специалности</th><th>Ч./седм.</th><th>Пн/Вт/Ср/Чт/Пт</th><th>Ч./год.</th><th>Свободни</th><th>Норма ${NORM()} ч.</th><th></th></tr>`;
    for (const t of sortedTeachers()) {
      h += `<tr><td><span class="sw" style="background:${t.color}"></span></td><td><input data-t="${t.id}" data-f="name" value="${esc(t.name)}"></td>
       <td><select data-t="${t.id}" data-f="kind"><option value="teacher" ${t.kind === 'teacher' ? 'selected' : ''}>Учител</option><option value="afterschool" ${t.kind === 'afterschool' ? 'selected' : ''}>Занималня</option></select></td>
       <td><input data-t="${t.id}" data-f="subjects" list="subjects" value="${esc(t.subjects.join(', '))}"></td>
       ${normCell(t)}<td><button class="btn del" data-act="del-teacher" data-id="${t.id}" title="Изтрий учителя">✕</button></td></tr>`;
      const open = t.kind === 'afterschool' ? state.ui.open?.[t.id] !== false : !!state.ui.open?.[t.id];
      h += `<tr><td colspan="10" class="small">${'' }${t.kind === 'afterschool' ? `<label>Занималня след часовете: <input type="number" min="0" max="8" data-t="${t.id}" data-f="afterHours" value="${t.afterHours || 0}" style="width:60px"> ч./ден</label> ` : ''}<button class="btn" data-act="toggle-grid" data-id="${t.id}">${open ? '▾ Скрий графика' : '▸ График със заети и свободни часове'}</button> <span class="muted">${t.kind === 'afterschool' ? 'Свободният час (зелен) е място за заместване; часовете на занималнята са след уроците – кликни, за да го отбележиш като заето.' : ''}</span>
        ${open ? `<div style="margin-top:6px">${scheduleGrid(t)}</div>` : ''}</td></tr>`;
    }
    h += `</table></div>`;
  }
  return h + `</div>`;
}

/* ---------- Програма ---------- */
function viewSchedule() {
  const H = state.settings.hours;
  let h = `<div class="card"><h2>Класове</h2><div class="row noprint">
   <input id="nc-name" placeholder="напр. 5А"><button class="btn pri" data-act="add-class">Добави клас</button></div><div class="row" style="margin-top:10px">`;
  if (!state.classes.some(c => c.id === state.ui.classId)) state.ui.classId = state.classes[0] ? state.classes[0].id : null;
  h += state.classes.map(c => `<span class="chip ${c.id === state.ui.classId ? 'on' : ''}" data-act="pick-class" data-id="${c.id}" style="padding:5px 12px">${esc(c.name)}</span>`).join('') + `</div></div>`;
  const cls = state.classes.find(c => c.id === state.ui.classId);
  if (!cls) return h + `<p class="muted">Добави клас, за да въведеш програмата му.</p>`;

  const usage = {}; // teacher+slot -> брой класове
  state.classes.forEach(c => Object.entries(c.lessons).forEach(([k, l]) => { if (l.teacherId) usage[l.teacherId + '|' + k] = (usage[l.teacherId + '|' + k] || 0) + 1; }));
  h += `<div class="card"><div class="row" style="justify-content:space-between"><h2>Програма на ${esc(cls.name)}</h2>
   <button class="btn del noprint" data-act="del-class" data-id="${cls.id}">Изтрий класа</button></div>
   <div class="tablewrap"><table><tr><th>Час</th>${[1, 2, 3, 4, 5].map(d => `<th>${DAYS[d]}</th>`).join('')}</tr>`;
  const lastUsed = Math.max(0, ...Object.keys(cls.lessons).map(k => Number(k.split('-')[1])));
  for (let n = 1; n <= Math.min(H, lastUsed + 1); n++) {
    h += `<tr><th>${n}</th>`;
    for (let d = 1; d <= 5; d++) {
      const key = d + '-' + n, l = cls.lessons[key] || { subject: '', teacherId: '' };
      const conflict = l.teacherId && usage[l.teacherId + '|' + key] > 1;
      const spec = sortedTeachers().filter(t => t.kind === 'teacher' && Scheduler.hasSpec(t, l.subject));
      const other = sortedTeachers().filter(t => t.kind === 'teacher' && !spec.includes(t));
      const o = t => `<option value="${t.id}" ${l.teacherId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`;
      h += `<td><div class="cell ${conflict ? 'conflict' : ''}" style="background:${colorOf(l.teacherId)}" ${conflict ? 'title="Учителят има друг час по същото време!"' : ''}>
        <input list="subjects" data-cell="${key}" data-p="subject" value="${esc(l.subject)}" placeholder="предмет">
        <select data-cell="${key}" data-p="teacherId"><option value="">— учител —</option>
        ${spec.length ? `<optgroup label="Специалисти">${spec.map(o).join('')}</optgroup>` : ''}
        <optgroup label="Други">${other.map(o).join('')}</optgroup></select></div></td>`;
    }
    h += `</tr>`;
  }
  return h + `</table></div><p class="muted small">Показани са часовете до първия свободен ред; добави предмет в него, за да се появи нов ред. Червена клетка = учителят е записан в два класа по едно и също време.</p></div>`;
}

/* ---------- Данни ---------- */
function viewData() {
  return `<div class="card"><h2>Настройки</h2><div class="row">
   <label>Часове на ден: <input type="number" id="hours" min="1" max="12" value="${state.settings.hours}" style="width:70px"></label>
   <label>Норма часове/седмица: <input type="number" id="norm" min="1" max="40" value="${NORM()}" style="width:70px"></label>
   <label>Учебни седмици: <input type="number" id="weeks" min="1" max="52" value="${WEEKS()}" style="width:70px"></label>
   <label><input type="checkbox" id="allowFree" ${state.settings.allowFree ? 'checked' : ''}> Редовни учители със свободен час могат да заместват (ако няма по-добър вариант)</label></div></div>
  <div class="card"><h2>Данни</h2><div class="row">
   <button class="btn" data-act="demo">Зареди примерни данни</button>
   <button class="btn" data-act="export">⬇ Свали резервно копие (JSON)</button>
   <label class="btn">⬆ Зареди копие <input type="file" id="import" accept=".json" hidden></label>
   <button class="btn del" data-act="reset">Изчисти всичко</button></div>
   <p class="muted small">Данните се пазят в този браузър. За ползване от няколко души/компютри свалете копие и го заредете там.</p></div>
  <div class="card"><h2>Как работи заместването</h2><ol class="small">
   <li>Първо се търси <b>специалист</b> по предмета, който е свободен в този час.</li>
   <li>После – учител от <b>занималня</b> (според свободните му места).</li>
   <li>После – друг учител със свободен час.</li>
   <li>При всяка промяна на отсъствията разпределението на целия ден се <b>изчислява наново оптимално</b>, така че заместникът по математика, който покрива БЕЛ, се премества към математиката, когато колега по математика отсъства, а БЕЛ се поема от друг. Промените се показват в „Последни промени“.</li></ol></div>`;
}

/* ---------- Примерни данни ---------- */
function demoData() {
  const s = JSON.parse(JSON.stringify(window.DEMO_DATA));
  s.ui = Object.assign(blank().ui, { classId: s.classes[0].id });
  return s;
}

/* ---------- Рендер и събития ---------- */
function render() {
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.ui.tab));
  const views = { sub: viewSub, teachers: viewTeachers, schedule: viewSchedule, data: viewData };
  $app.innerHTML = views[state.ui.tab]();
  document.getElementById('subjects').innerHTML = allSubjects().map(s => `<option value="${esc(s)}">`).join('');
  save();
}

document.getElementById('nav').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.ui.tab = b.dataset.tab; render();
});

$app.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  const date = state.ui.date;
  if (act === 'add-abs') {
    const v = document.getElementById('absSel').value; if (!v) return;
    const end = state.ui.endDate && state.ui.endDate > date ? state.ui.endDate : date;
    changeAbsences(`Добавено отсъствие: ${tName(v)}${end > date ? ' (' + date + ' – ' + end + ')' : ''}`, () => {
      for (const d of workdays(date, end)) {
        const list = state.absences[d] = state.absences[d] || [];
        if (!list.some(a => a.teacherId === v)) list.push({ teacherId: v, hours: null });
      }
    });
  } else if (act === 'del-abs') {
    changeAbsences(`Премахнато отсъствие: ${tName(id)}`, () => { state.absences[date] = state.absences[date].filter(a => a.teacherId !== id); });
  } else if (act === 'del-abs-range') {
    changeAbsences(`Премахнато отсъствие за периода: ${tName(id)}`, () => {
      for (const d of workdays(date, state.ui.endDate)) if (state.absences[d]) state.absences[d] = state.absences[d].filter(a => a.teacherId !== id);
    });
  } else if (act === 'abs-hour') {
    const n = Number(el.dataset.h);
    changeAbsences(`Променени часове на отсъствие: ${tName(id)}`, () => {
      const a = state.absences[date].find(a => a.teacherId === id);
      let hrs = a.hours || Array.from({ length: state.settings.hours }, (_, i) => i + 1);
      hrs = hrs.includes(n) ? hrs.filter(x => x !== n) : [...hrs, n].sort((x, y) => x - y);
      if (!hrs.length) state.absences[date] = state.absences[date].filter(x => x !== a);
      else a.hours = hrs.length === state.settings.hours ? null : hrs;
    });
  } else if (act === 'add-teacher') {
    const name = document.getElementById('nt-name').value.trim(); if (!name) return;
    state.teachers.push({ id: uid(), color: teacherColor(state.teachers.length), name, kind: document.getElementById('nt-kind').value, busy: {},
      subjects: document.getElementById('nt-subj').value.split(',').map(x => x.trim()).filter(Boolean) });
    render();
  } else if (act === 'del-teacher') {
    if (!confirm('Да се изтрие ли учителят ' + tName(id) + '?')) return;
    state.teachers = state.teachers.filter(t => t.id !== id);
    state.classes.forEach(c => Object.values(c.lessons).forEach(l => { if (l.teacherId === id) l.teacherId = ''; }));
    Object.keys(state.absences).forEach(d => state.absences[d] = state.absences[d].filter(a => a.teacherId !== id));
    render();
  } else if (act === 'toggle-grid') {
    state.ui.open = state.ui.open || {};
    const t = tById(id), cur = t.kind === 'afterschool' ? state.ui.open[id] !== false : !!state.ui.open[id];
    state.ui.open[id] = !cur; render();
  } else if (act === 'busy') {
    const t = tById(id); t.busy = t.busy || {}; t.busy[el.dataset.key] = !t.busy[el.dataset.key]; render();
  } else if (act === 'add-class') {
    const name = document.getElementById('nc-name').value.trim(); if (!name) return;
    const c = { id: uid(), name, lessons: {} }; state.classes.push(c); state.ui.classId = c.id; render();
  } else if (act === 'pick-class') { state.ui.classId = id; render(); }
  else if (act === 'del-class') {
    if (!confirm('Да се изтрие ли класът?')) return;
    state.classes = state.classes.filter(c => c.id !== id); render();
  } else if (act === 'demo') {
    if (state.teachers.length && !confirm('Текущите данни ще бъдат заменени. Продължаваш ли?')) return;
    const ui = state.ui; state = demoData(); state.ui = Object.assign(state.ui, { tab: 'sub', date: ui.date }); delete state.sampleAbsent; render();
  } else if (act === 'export') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' }));
    a.download = 'uchilishte-danni.json'; a.click();
  } else if (act === 'reset') {
    if (!confirm('Да се изтрият ли ВСИЧКИ данни?')) return;
    state = blank(); state.seeded = true; render();
  }
});

$app.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'date') { state.ui.date = el.value || todayStr(); if (state.ui.endDate && state.ui.endDate <= state.ui.date) state.ui.endDate = ''; render(); }
  else if (el.id === 'endDate') { state.ui.endDate = el.value; render(); }
  else if (el.dataset.pin !== undefined) {
    const [date, classId, hour] = el.dataset.pin.split('|');
    changeAbsences('Ръчна промяна на заместник', () => {
      state.pins = state.pins || {};
      if (el.value) state.pins[el.dataset.pin] = el.value; else delete state.pins[el.dataset.pin];
    });
  } else if (el.dataset.t) {
    const t = tById(el.dataset.t), f = el.dataset.f;
    if (f === 'afterHours') t.afterHours = Math.max(0, Math.min(8, Number(el.value) || 0));
    else if (f === 'subjects') t.subjects = el.value.split(',').map(x => x.trim()).filter(Boolean);
    else t[f] = el.value;
    render();
  } else if (el.dataset.cell) {
    const c = state.classes.find(c => c.id === state.ui.classId), k = el.dataset.cell;
    const l = c.lessons[k] = c.lessons[k] || { subject: '', teacherId: '' };
    l[el.dataset.p] = el.value;
    if (!l.subject && !l.teacherId) delete c.lessons[k];
    render();
  } else if (el.id === 'hours') {
    state.settings.hours = Math.max(1, Math.min(12, Number(el.value) || 7)); render();
  } else if (el.id === 'norm') { state.settings.norm = Math.max(1, Number(el.value) || 18); render(); }
  else if (el.id === 'weeks') { state.settings.weeks = Math.max(1, Number(el.value) || 36); render(); }
  else if (el.id === 'allowFree') { state.settings.allowFree = el.checked; render(); }
  else if (el.id === 'import') {
    const f = el.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const ui = state.ui; state = Object.assign(blank(), JSON.parse(r.result)); state.ui = Object.assign(state.ui, { date: ui.date, tab: 'sub' }); render(); } catch (err) { alert('Невалиден файл.'); } };
    r.readAsText(f);
  }
});

/* При първо отваряне: примерна програма, учители и две примерни отсъствия */
if (!state.teachers.length && !state.seeded) {
  state = demoData(); state.seeded = true; delete state.sampleAbsent;
  const d = new Date(); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  state.ui.date = ds;
  state.absences[ds] = (window.DEMO_DATA.sampleAbsent || []).map(id => ({ teacherId: id, hours: null }));
}
render();
