'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const C = require('../risk-core.js'), sample = require('../sample-data.js');
const payload = risks => ({schemaVersion:1,risks});
test('확률 경계값과 잘못된 입력',() => {
  for(const [v,p] of [[0,1],[20,1],[20.01,2],[40,2],[40.01,3],[60,3],[60.01,4],[80,4],[80.01,5],[100,5]]) assert.equal(C.probability(v),p);
  for(const v of [-1,101,NaN,Infinity,'20',null]) assert.throws(() => C.probability(v));
});
test('25개 P/I 조합 및 일정/비용 최댓값',() => {
  for(let p=1;p<=5;p++) for(let i=1;i<=5;i++) {
    assert.equal(C.score({probabilityPct:p*20,scheduleImpact:i,costImpact:1}),p*i);
    assert.equal(C.score({probabilityPct:p*20,scheduleImpact:1,costImpact:i}),p*i);
  }
  for(const v of [0,6,1.5,'2']) assert.throws(() => C.impact({scheduleImpact:v,costImpact:1}));
});
test('등급 경계와 윤년/잘못된 날짜',() => {
  for(const [s,l] of [[1,0],[4,0],[5,1],[9,1],[10,2],[14,2],[15,3],[25,3]]) assert.equal(C.level(s),l);
  for(const s of ['2024-02-29','2026-09-07','0001-01-01','9999-12-31']) assert.ok(C.validDate(s));
  for(const s of ['2026-02-29','2026-04-31','0000-01-01','2026-9-7','invalid',null]) assert.equal(C.validDate(s),false);
});
test('샘플 출처·집계·점수·우선순위',() => {
  const data = C.validate(payload(sample));
  assert.equal(data.length,10);
  assert.deepEqual(data.map(C.score),[16,25,12,12,8,9,4,12,2,20]);
  assert.deepEqual(C.summary(data,'2026-09-07'),{count:9,critical:2,overdue:2,average:'11.1'});
  assert.deepEqual(data.filter(C.active).sort(C.priority).slice(0,3).map(r=>r.id),['R-002','R-001','R-004']);
  assert.ok(data.every(r=>r.source.includes('가상 샘플')));
});
test('오늘 기한 제외·종료 제외·0건',() => {
  const r = {...sample[0],dueDate:'2026-09-07'};
  assert.equal(C.overdue(r,'2026-09-07'),false); assert.equal(C.overdue(r,'2026-09-08'),true);
  assert.equal(C.overdue({...r,status:'종료'},'2026-09-08'),false);
  assert.deepEqual(C.summary([],'2026-09-07'),{count:0,critical:0,overdue:0,average:'—'});
});
test('복원 데이터 오류 및 필수 문자열 검사',() => {
  for(const delta of [{title:'   '},{owner:''},{response:''},{source:''},{probabilityPct:101},{costImpact:0},{scheduleImpact:1.2},{dueDate:'2026-02-30'},{status:'unknown'},{category:'unknown'},{id:'bad'},{title:'a'.repeat(101)}]) assert.throws(()=>C.validate(payload([{...sample[0],...delta}])));
  assert.throws(()=>C.validate(payload([sample[0],sample[0]])));
  assert.throws(()=>C.validate({schemaVersion:2,risks:[]}));
  assert.throws(()=>C.validate(payload(Array(1001).fill(sample[0]))));
  assert.deepEqual(C.validate(payload([])),[]);
});
test('고유 ID 생성 및 백업 왕복',() => {
  assert.equal(C.nextId(sample),'R-011'); assert.equal(C.nextId([]),'R-001');
  assert.deepEqual(C.validate(JSON.parse(JSON.stringify(payload(sample)))),sample);
});
