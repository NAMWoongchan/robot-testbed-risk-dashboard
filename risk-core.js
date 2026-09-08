(function (root) {
  'use strict';
  const categories = ['기술', '일정', '비용', '안전', '조달', '운영'];
  const statuses = ['식별', '대응 중', '모니터링', '종료'];
  const levels = ['낮음', '보통', '높음', '심각'];
  function probability(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) throw Error('확률은 0~100 사이 숫자여야 합니다.');
    return Math.max(1, Math.ceil(value / 20));
  }
  function impact(r) {
    if (![r.scheduleImpact, r.costImpact].every(v => Number.isInteger(v) && v >= 1 && v <= 5)) throw Error('영향도는 1~5 정수여야 합니다.');
    return Math.max(r.scheduleImpact, r.costImpact);
  }
  const score = r => probability(r.probabilityPct) * impact(r);
  const level = s => s >= 15 ? 3 : s >= 10 ? 2 : s >= 5 ? 1 : 0;
  function validDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s) || s.slice(0, 4) === '0000') return false;
    const d = new Date(s + 'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const active = r => r.status !== '종료';
  const overdue = (r, day) => active(r) && r.dueDate < day;
  const priority = (a, b) => score(b) - score(a) || a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id);
  function summary(risks, day) {
    const open = risks.filter(active);
    return { count: open.length, critical: open.filter(r => score(r) >= 15).length, overdue: open.filter(r => overdue(r, day)).length, average: open.length ? (open.reduce((n, r) => n + score(r), 0) / open.length).toFixed(1) : '—' };
  }
  function validate(payload) {
    if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.risks) || payload.risks.length > 1000) throw Error('지원하는 형식은 schemaVersion 1, risks 배열(최대 1,000건)입니다.');
    const ids = new Set();
    return payload.risks.map((r, i) => {
      const fail = message => { throw Error(`${i + 1}번째 리스크: ${message}`); };
      if (!r || typeof r !== 'object') fail('객체가 아닙니다.');
      const output = {};
      for (const [key, max, required] of [['id', 20, true], ['title', 100, true], ['owner', 50, true], ['description', 1500, false], ['response', 1500, true], ['source', 200, true]]) {
        if (typeof r[key] !== 'string' || r[key].length > max || (required && !r[key].trim())) fail(`${key} 입력을 확인해 주세요.`);
        output[key] = r[key].trim();
      }
      if (!/^R-\d{3,9}$/.test(output.id) || ids.has(output.id)) fail('ID 형식이 잘못되었거나 중복됩니다.');
      ids.add(output.id);
      if (!categories.includes(r.category) || !statuses.includes(r.status)) fail('분류 또는 상태가 잘못되었습니다.');
      if (!validDate(r.dueDate)) fail('대응 기한이 유효한 날짜가 아닙니다.');
      probability(r.probabilityPct); impact(r);
      return Object.assign(output, {category:r.category, status:r.status, dueDate:r.dueDate, probabilityPct:r.probabilityPct, scheduleImpact:r.scheduleImpact, costImpact:r.costImpact});
    });
  }
  function nextId(risks) {
    const n = Math.max(0, ...risks.map(r => Number(r.id.slice(2)))) + 1;
    return 'R-' + String(n).padStart(3, '0');
  }
  const api = {categories, statuses, levels, probability, impact, score, level, validDate, today, active, overdue, priority, summary, validate, nextId};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RiskCore = api;
})(globalThis);
