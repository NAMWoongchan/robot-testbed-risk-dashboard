/* Shared classroom adapter. Personal data is never uploaded automatically. */
(() => {
  'use strict';
  let adapter, api, db, auth, user, room, revision = {}, currentItems = [], ready = false, stopBoard, stopRoom, busy = false, joining = false;
  const $ = id => document.getElementById(id);
  const panel = document.createElement('section');
  panel.className = 'classroom';
  panel.setAttribute('aria-label', '공동 수업');
  panel.innerHTML = `<strong>공동 수업</strong><p id="class-status" role="status">개인 모드 · 데이터는 이 브라우저에만 저장됩니다.</p>
    <button id="class-login" type="button">GitHub 로그인</button><button id="class-logout" type="button" hidden>로그아웃</button>
    <label>교육방 코드 <input id="class-code" maxlength="32" autocomplete="off"></label><button id="class-join" type="button">교육방 참가</button>
    <button id="class-create" type="button" hidden>교육방 만들기 (강사)</button><button id="class-close" type="button" hidden>교육방 마감/재개</button>
    <button id="class-leave" type="button" hidden>개인 모드로 돌아가기</button>
    <small>교육용 가상 데이터만 입력하세요. 참가자는 같은 교육방의 항목을 함께 수정·삭제할 수 있습니다. 개인 데이터는 자동 전송되지 않습니다.</small>`;
  document.body.prepend(panel);
  const status = text => { $('class-status').textContent = text; };
  const fail = error => status('공동 수업 오류: ' + (error.code || error.message || '연결 실패'));
  function leave() {
    stopBoard?.(); stopRoom?.(); stopBoard = stopRoom = null;
    if (room) adapter.leave();
    room = null; ready = false; revision = {}; currentItems = [];
    $('class-leave').hidden = $('class-close').hidden = true;
    status('개인 모드 · 기존 브라우저 데이터로 돌아왔습니다.');
  }
  window.Classroom = {
    attach(value) { adapter = value; },
    get active() { return !!room; },
    get revision() { return {...revision}; },
    async save(items, expected) {
      if (!room || !ready || !user || busy) throw Error('교육방 연결 또는 진행 중인 저장을 확인한 후 다시 시도하세요.');
      if (items.length > 200) throw Error('교육방 보드는 최대 200건입니다.');
      adapter.validate(items);
      const targetRoom = room;
      const before = new Map(currentItems.map(item => [item.id,item]));
      const after = new Map(items.map(item => [item.id,item]));
      const changed = [...new Set([...before.keys(),...after.keys()])].filter(id => JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id)));
      if (!changed.length) return;
      if (changed.length !== 1) throw Error('공동 수업에서는 한 번에 한 항목만 변경할 수 있습니다.');
      const id = changed[0], item = after.get(id) || before.get(id);
      const ref = api.doc(db, 'rooms', room, 'boards', adapter.board, 'items', id);
      busy = true;
      try {
        await api.runTransaction(db, async tx => {
          const snap = await tx.get(ref), old = snap.exists() ? snap.data() : null;
          if ((old?.version || 0) !== (expected[id] || 0)) throw Error('다른 참가자가 이 항목을 변경했습니다. 입력 내용을 복사하고 창을 닫은 뒤 최신 목록에서 다시 수정하세요.');
          if (room !== targetRoom) throw Error('교육방이 변경되어 저장을 취소했습니다.');
          tx.set(ref, {data:item, deleted:!after.has(id), version:(old?.version || 0)+1, updatedBy:user.uid, updatedAt:api.serverTimestamp()});
        });
        status('교육방 ' + targetRoom + ' · 서버에 저장했습니다.');
      } finally { busy = false; }
    }
  };
  $('class-leave').onclick = leave;
  const config = window.CLASSROOM_CONFIG;
  if (!config?.enabled) {
    status('개인 모드 · 공동 수업은 Firebase 연결 설정 후 사용할 수 있습니다.');
    for (const node of panel.querySelectorAll('button,input')) node.disabled = true;
    return;
  }
  async function join(id) {
    if (!user) throw Error('먼저 GitHub으로 로그인하세요.');
    const joiningUid = user.uid;
    if (!/^[a-f0-9]{32}$/.test(id)) throw Error('32자리 교육방 코드를 확인하세요.');
    const ref = api.doc(db, 'rooms', id);
    const info = await api.getDoc(ref);
    if (!info.exists() || !info.data().open) throw Error('존재하지 않거나 마감된 교육방입니다.');
    const member = api.doc(db, 'rooms', id, 'members', user.uid);
    if (!(await api.getDoc(member)).exists()) await api.setDoc(member, {joinedAt: api.serverTimestamp()});
    if (!user || user.uid !== joiningUid) throw Error('로그인이 변경되었습니다. 다시 참가하세요.');
    leave(); adapter.enter(); room = id;
    $('class-code').value = id; $('class-leave').hidden = false;
    $('class-close').hidden = info.data().ownerUid !== user.uid;
    let open = true;
    stopRoom = api.onSnapshot(ref, snap => {
      open = snap.exists() && snap.data().open;
      if (!open) { ready = false; status('교육방 마감 · 읽기 전용입니다.'); }
    }, error => { ready = false; fail(error); });
    stopBoard = api.onSnapshot(api.collection(db, 'rooms', id, 'boards', adapter.board, 'items'), {includeMetadataChanges: true}, snap => {
      try {
        const items = [], versions = {};
        snap.forEach(doc => { const value = doc.data(); versions[doc.id] = value.version; if (!value.deleted) items.push(value.data); });
        adapter.validate(items);
        currentItems = items; revision = versions;
        ready = open && !snap.metadata.fromCache && !snap.metadata.hasPendingWrites;
        adapter.receive(items);
        status('교육방 ' + id + (ready ? ' · 실시간 연결됨' : ' · 연결 확인 중/마감 · 저장할 수 없습니다.'));
      } catch (error) { ready = false; fail(error); }
    }, error => { ready = false; fail(error); });
  }
  $('class-join').onclick = async () => {if(joining || busy)return; joining=true; try{await join($('class-code').value.trim());}catch(error){fail(error);}finally{joining=false;}};
  (async () => {
    const base = 'https://www.gstatic.com/firebasejs/12.18.0/';
    const [app, authentication, firestore] = await Promise.all([import(base+'firebase-app.js'), import(base+'firebase-auth.js'), import(base+'firebase-firestore.js')]);
    api = {...authentication, ...firestore};
    const instance = app.initializeApp(config.firebase);
    auth = api.getAuth(instance); db = api.getFirestore(instance);
    $('class-login').onclick = () => api.signInWithPopup(auth, new api.GithubAuthProvider()).catch(fail);
    $('class-logout').onclick = () => api.signOut(auth).catch(fail);
    api.onAuthStateChanged(auth, async current => {
      leave(); user = current;
      $('class-login').hidden = !!user; $('class-logout').hidden = !user;
      $('class-create').hidden = true;
      if (user) {
        status('로그인 완료 · 사용자 UID: ' + user.uid + ' · 교육방 코드를 입력하세요.');
        try { $('class-create').hidden = !(await api.getDoc(api.doc(db, 'teachers', user.uid))).exists(); } catch (error) { fail(error); }
      }
    });
    $('class-create').onclick = async () => {
      try {
        const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), v => v.toString(16).padStart(2,'0')).join('');
        await api.setDoc(api.doc(db, 'rooms', id), {ownerUid: user.uid, open: true, createdAt: api.serverTimestamp()});
        await join(id);
      } catch (error) { fail(error); }
    };
    $('class-close').onclick = async () => {
      try {
        const ref = api.doc(db, 'rooms', room);
        await api.runTransaction(db, async tx => { const doc = await tx.get(ref); tx.update(ref, {open: !doc.data().open}); });
        // Rejoin after reopening to verify the server snapshot before writes.
        status('교육방 상태를 변경했습니다. 재개했다면 교육방 참가를 다시 눌러 주세요.');
      } catch (error) { fail(error); }
    };
  })().catch(fail);
})();
