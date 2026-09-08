(() => {
  'use strict';
  const C = RiskCore, $ = id => document.getElementById(id), key = 'robot-risk-dashboard.v1';
  let risks, storageBlocked = false, editing = null, matrixFilter = null, timer, editRevision = 0, personal = null;
  const form = $('risk-form');
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  const payload = () => ({schemaVersion:1, risks});
  const say = message => { $('message').textContent = message; clearTimeout(timer); timer = setTimeout(() => $('message').textContent = '', 6000); };
  function save() {
    if (storageBlocked) { $('storage-status').textContent = '메모리 모드 · 손상된 저장본 보존 중 · JSON 백업 필요'; return; }
    try { localStorage.setItem(key, JSON.stringify(payload())); $('storage-status').textContent = '브라우저에 저장됨 · JSON 백업 권장'; }
    catch { $('storage-status').textContent = '저장 불가 · 메모리 모드 · JSON 백업 필요'; say('브라우저 저장을 사용할 수 없습니다. 종료 전 JSON 백업을 해 주세요.'); }
  }
  try {
    const raw = localStorage.getItem(key);
    risks = raw === null ? C.validate({schemaVersion:1, risks:SAMPLE_RISKS}) : C.validate(JSON.parse(raw));
    $('storage-status').textContent = raw === null ? '가상 샘플 · 변경 시 브라우저 저장' : '브라우저 저장본 불러옴';
  } catch {
    risks = C.validate({schemaVersion:1, risks:SAMPLE_RISKS}); storageBlocked = true;
    $('storage-status').textContent = '저장본 접근/검증 실패 · 메모리 모드 · JSON 백업 필요';
    say('저장본을 읽을 수 없어 샘플을 표시합니다. 기존 저장본은 덮어쓰지 않습니다. JSON 복원으로 복구할 수 있습니다.');
  }
  function options(select, values) { values.forEach(v => {const o = el('option', v); o.value = v; select.append(o);}); }
  options($('status-filter'), C.statuses);
  options(form.elements.category, C.categories); options(form.elements.status, C.statuses);
  for (const name of ['scheduleImpact','costImpact']) {
    ['1 · 0~1%','2 · 1% 초과~3%','3 · 3% 초과~5%','4 · 5% 초과~10%','5 · 10% 초과'].forEach((label,i) => {const o = el('option',label); o.value = i+1; form.elements[name].append(o);});
  }
  function badge(r) { const s = C.score(r); return el('span',`${s} · ${C.levels[C.level(s)]}`,`badge level-${C.level(s)}`); }
  function render() {
    const day = C.today(), s = C.summary(risks, day);
    for (const k of ['count','critical','overdue','average']) $('metric-'+k).textContent = s[k];
    $('as-of').textContent = `기준일 ${day} · 로컬 날짜`;
    $('matrix').replaceChildren();
    for (let p=5;p>=1;p--) {
      $('matrix').append(el('span',String(p),'tick'));
      for (let i=1;i<=5;i++) {
        const count = risks.filter(r => C.active(r) && C.probability(r.probabilityPct) === p && C.impact(r) === i).length;
        const b = el('button',String(count),`level-${C.level(p*i)}`);
        b.type = 'button'; b.setAttribute('aria-label',`P${p}, I${i}, ${p*i}점 ${C.levels[C.level(p*i)]}, 미종료 ${count}건`);
        b.setAttribute('aria-pressed',String(matrixFilter?.p === p && matrixFilter?.i === i));
        b.onclick = () => { resetFilters(false); matrixFilter = {p,i}; $('status-filter').value = 'active'; render(); $('result-count').scrollIntoView({block:'center'}); };
        $('matrix').append(b);
      }
    }
    $('matrix').append(el('span','','tick'));
    for(let i=1;i<=5;i++) $('matrix').append(el('span',String(i),'tick'));
    $('priority').replaceChildren();
    const top = risks.filter(C.active).sort(C.priority).slice(0,3);
    top.forEach((r,i) => {
      const b = el('button',undefined,'priority-item'); b.type = 'button'; b.setAttribute('aria-label',`${r.id} ${r.title} 상세 수정`);
      const first = el('div',undefined,'priority-top'); first.append(el('span',`${String(i+1).padStart(2,'0')}  ${r.title}`,'priority-title'),badge(r));
      b.append(first,el('p',`${r.id} · ${r.owner} · ${r.dueDate}${C.overdue(r,day)?' · 기한 초과':''}`,'priority-meta'));
      b.onclick = () => openEditor(r); $('priority').append(b);
    });
    if(!top.length) $('priority').append(el('p','미종료 리스크가 없습니다.','empty'));
    renderRows(day);
  }
  function renderRows(day = C.today()) {
    const query = $('search').value.trim().toLocaleLowerCase(), lv = $('level-filter').value, status = $('status-filter').value;
    const rows = risks.filter(r => (!query || [r.id,r.title,r.owner,r.description,r.response,r.category].join(' ').toLocaleLowerCase().includes(query)) && (lv === '' || C.level(C.score(r)) === Number(lv)) && (!status || (status === 'active' ? C.active(r) : r.status === status)) && (!matrixFilter || (C.active(r) && C.probability(r.probabilityPct) === matrixFilter.p && C.impact(r) === matrixFilter.i)));
    rows.sort($('sort').value === 'due' ? (a,b) => a.dueDate.localeCompare(b.dueDate) || C.priority(a,b) : $('sort').value === 'id' ? (a,b) => a.id.localeCompare(b.id) : C.priority);
    $('result-count').textContent = `전체 ${risks.length}건 중 ${rows.length}건 표시 · 표에만 필터 적용`;
    $('matrix-filter').hidden = !matrixFilter;
    $('matrix-filter').textContent = matrixFilter ? `매트릭스 선택: P${matrixFilter.p} × I${matrixFilter.i} · 미종료만 표시 (필터 초기화로 해제)` : '';
    $('rows').replaceChildren();
    rows.forEach(r => {
      const tr = el('tr'); tr.dataset.id = r.id;
      const id = el('td',r.id); id.append(el('span',r.category,'sub'));
      const title = el('td'); title.append(el('span',r.title,'risk-title'),el('span',r.owner,'sub'));
      const p = el('td',String(C.probability(r.probabilityPct))); p.append(el('span',r.probabilityPct+'%','sub'));
      const impact = el('td',String(C.impact(r))); impact.title = `일정 ${r.scheduleImpact} / 비용 ${r.costImpact}`;
      const sc = el('td'); sc.append(badge(r));
      const due = el('td',r.dueDate); if(C.overdue(r,day)) due.append(el('span','기한 초과','sub late'));
      const status = el('td',r.status);
      const actions = el('td'), group = el('div',undefined,'row-actions');
      const edit = el('button','수정'); edit.setAttribute('aria-label',`${r.id} 수정`); edit.onclick = () => openEditor(r);
      const remove = el('button','삭제','delete'); remove.setAttribute('aria-label',`${r.id} 삭제`); remove.onclick = async () => {
        const rev = Classroom.revision;
        if(confirm(`${r.id} “${r.title}” 리스크를 삭제하시겠습니까?`)) {try {const next = risks.filter(x => x.id !== r.id); if(Classroom.active) {await Classroom.save(next,rev);} else {risks=next;save();render();} say('리스크를 삭제했습니다.');} catch(error){say(error.message);}}
      };
      group.append(edit,remove); actions.append(group); tr.append(id,title,p,impact,sc,due,status,actions); $('rows').append(tr);
    });
    $('empty').hidden = rows.length > 0;
  }
  function resetFilters(shouldRender = true) {
    $('search').value = ''; $('level-filter').value = ''; $('status-filter').value = ''; $('sort').value = 'score'; matrixFilter = null;
    if(shouldRender) render();
  }
  function openEditor(r = null) {
    editRevision = Classroom.revision; editing = r?.id ?? null; form.reset(); $('form-error').textContent = '';
    $('editor-title').textContent = r ? `${r.id} 리스크 수정` : '리스크 등록';
    form.elements.dueDate.value = C.today();
    if(r) for(const [name,value] of Object.entries(r)) if(form.elements.namedItem(name)) form.elements.namedItem(name).value = value;
    preview(); $('editor').showModal(); form.elements.title.focus();
  }
  function preview() {
    try {
      if(form.elements.probabilityPct.value === '') throw Error();
      const r = {probabilityPct:Number(form.elements.probabilityPct.value),scheduleImpact:Number(form.elements.scheduleImpact.value),costImpact:Number(form.elements.costImpact.value)};
      $('score-preview').textContent = `P${C.probability(r.probabilityPct)} × I${C.impact(r)} = ${C.score(r)} · ${C.levels[C.level(C.score(r))]}`;
    } catch {$('score-preview').textContent = '확률 0~100을 입력하세요.';}
  }
  form.addEventListener('input',preview);
  form.addEventListener('submit',async e => {
    e.preventDefault();
    const r = Object.fromEntries(new FormData(form)); r.id = editing || (Classroom.active ? 'R-'+(100000000+crypto.getRandomValues(new Uint32Array(1))[0]%900000000) : C.nextId(risks));
    for(const k of ['probabilityPct','scheduleImpact','costImpact']) r[k] = Number(r[k]);
    try {
      if(editing && !risks.some(x=>x.id===editing)) throw Error('이 항목이 삭제되었습니다. 새로 등록해 주세요.');
      const next = editing ? risks.map(x => x.id === editing ? r : x) : [...risks,r];
      const checked = C.validate({schemaVersion:1,risks:next}); if(Classroom.active) {await Classroom.save(checked,editRevision);} else {risks=checked;save();} $('editor').close(); render(); say('리스크를 저장했습니다. 필터가 적용 중이면 목록에서 숨겨질 수 있습니다.');
    } catch(err) {$('form-error').textContent = err.message;}
  });
  $('add').onclick = () => openEditor();
  document.querySelector('a[href="#method"]').onclick = () => { $('method').open = true; };
  $('close-editor').onclick = $('cancel').onclick = () => $('editor').close();
  $('clear').onclick = () => resetFilters();
  $('search').addEventListener('input',() => renderRows());
  for(const id of ['level-filter','sort']) $(id).addEventListener('change',() => renderRows());
  $('status-filter').addEventListener('change',() => {matrixFilter = null; render();});
  $('export').onclick = () => {
    const blob = new Blob([JSON.stringify(payload(),null,2)],{type:'application/json'}), url = URL.createObjectURL(blob), a = el('a');
    a.href = url; a.download = `risk-register-${C.today()}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); say('전체 리스크 JSON 백업을 내려받습니다.');
  };
  $('import').onclick = () => {if(Classroom.active){say('공동 수업에서는 다른 참가자의 자료 보호를 위해 전체 JSON 복원을 사용할 수 없습니다.');return;} $('import-file').click();};
  $('import-file').addEventListener('change',async e => {
    if(Classroom.active){say('공동 수업에서는 전체 복원을 사용할 수 없습니다.');e.target.value='';return;} const file = e.target.files[0]; if(!file) return;
    try {
      if(file.size > 1024*1024) throw Error('JSON 파일은 1MB 이하여야 합니다.');
      const restored = C.validate(JSON.parse(await file.text()));
      if(confirm(`현재 ${risks.length}건을 백업 파일의 ${restored.length}건으로 교체하시겠습니까? 기존 데이터가 필요하면 취소 후 JSON 백업을 먼저 해 주세요.`)) {
        risks = restored; storageBlocked = false; save(); resetFilters(); say('JSON 복원이 완료되었습니다. 아래 저장 상태도 확인해 주세요.');
      }
    } catch(err) {say('복원 실패: '+err.message);}
    finally {e.target.value = '';}
  });
  render();
  Classroom.attach({board:'risks',validate(items){return C.validate({schemaVersion:1,risks:items});},enter(){personal=risks;risks=[];$('editor').close();resetFilters();$('storage-status').textContent='공동 수업 · 서버 연결 확인 중';},receive(items){risks=items;render();$('storage-status').textContent='공동 수업 · 연결/저장 상태는 상단에서 확인';},leave(){risks=personal;personal=null;$('editor').close();resetFilters();$('storage-status').textContent='개인 모드 · 기존 브라우저 데이터';}});
  let lastDay = C.today();
  setInterval(() => {const day = C.today(); if(day !== lastDay) {lastDay = day; render();}},30000);
  document.addEventListener('visibilitychange',() => {if(!document.hidden) render();});
})();
