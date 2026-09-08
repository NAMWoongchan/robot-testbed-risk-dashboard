'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,updateDoc,serverTimestamp}=require('firebase/firestore');
const {chromium}=require('playwright');
const root=path.resolve(process.argv[2]||'issue-classroom'), out=path.resolve(process.argv[3]||'classroom-qa-shared');
const projectId='demo-classroom',room='a'.repeat(32),other='b'.repeat(32),results=[];
const record=name=>{results.push(name);console.log('PASS '+name);};
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync(path.join(root,'firestore.rules'),'utf8')}});
 await env.clearFirestore();
 const teacher=env.authenticatedContext('teacher').firestore(),student=env.authenticatedContext('student').firestore(),outsider=env.authenticatedContext('outsider').firestore(),anon=env.unauthenticatedContext().firestore();
 await env.withSecurityRulesDisabled(async context=>{await setDoc(doc(context.firestore(),'teachers','teacher'),{enabled:true});});
 await assertFails(setDoc(doc(student,'teachers','student'),{enabled:true}));
 await assertFails(setDoc(doc(student,'rooms',room),{ownerUid:'student',open:true,createdAt:serverTimestamp()}));
 await assertSucceeds(setDoc(doc(teacher,'rooms',room),{ownerUid:'teacher',open:true,createdAt:serverTimestamp()}));
 await assertSucceeds(setDoc(doc(teacher,'rooms',other),{ownerUid:'teacher',open:true,createdAt:serverTimestamp()}));
 for(const [db,uid] of [[teacher,'teacher'],[student,'student']])await setDoc(doc(db,'rooms',room,'members',uid),{joinedAt:serverTimestamp()});
 const issue={id:'test-issue',title:'가상 시험, 한글',owner:'가상 담당자',due:'2026-12-31',priority:'보통',status:'접수'};
 const make=(data,version=1)=>({data,deleted:false,version,updatedBy:'student',updatedAt:serverTimestamp()});
 const item=db=>doc(db,'rooms',room,'boards','issues','items',issue.id);
 await assertFails(getDoc(item(anon)));await assertFails(getDoc(item(outsider)));
 await assertSucceeds(setDoc(item(student),make(issue)));
 await assertFails(setDoc(item(student),make({...issue,title:''},2)));
 await assertFails(setDoc(item(student),make({...issue,title:' '},2)));
 await assertFails(setDoc(item(student),make({...issue,status:'임의 상태'},2)));
 await assertFails(setDoc(item(student),make(issue,1)));
 await assertFails(setDoc(doc(student,'rooms',other,'boards','issues','items',issue.id),make(issue)));
 await assertFails(updateDoc(doc(student,'rooms',room),{open:false}));
 await updateDoc(doc(teacher,'rooms',room),{open:false});
 await assertFails(setDoc(item(student),make(issue,2)));
 await updateDoc(doc(teacher,'rooms',room),{open:true});
 record('서버 규칙: 미로그인·미참가·다른 교육방·권한 상승·빈 제목·임의 상태·이전 버전·마감 후 저장 차단');
 const risk={id:'R-001',title:'가상 리스크',owner:'가상 담당자',dueDate:'2026-12-31',category:'기술',status:'식별',probabilityPct:75,scheduleImpact:4,costImpact:3,description:'',response:'가상 대응',source:'가상 샘플'};
 const rref=doc(student,'rooms',room,'boards','risks','items','R-001');
 await assertSucceeds(setDoc(rref,make(risk)));
 await assertFails(setDoc(rref,make({...risk,probabilityPct:101},2)));
 await assertFails(setDoc(rref,make({...risk,costImpact:1.5},2)));
 record('서버 규칙: 리스크 정상 입력 허용·확률 범위·영향도 정수 제한');
 await env.withSecurityRulesDisabled(async ctx=>{const {deleteDoc}=require('firebase/firestore');await deleteDoc(item(ctx.firestore()));await deleteDoc(doc(ctx.firestore(),'rooms',room,'boards','risks','items','R-001'));});
 const allow=new Set(['index.html','app.js','styles.css','issue-core.js','risk-core.js','sample-data.js','classroom.js','classroom.css','classroom-config.js']);
 const server=http.createServer((req,res)=>{const name=req.url.split('?')[0].split('/').pop()||'index.html';if(!allow.has(name)){res.writeHead(404).end();return;}try{res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(root,name)));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const errors=[];
 try{
  async function page(uid){const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/classroom-config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.CLASSROOM_CONFIG={enabled:true,firebase:{projectId:'${projectId}',apiKey:'emulator-only',appId:'demo'}};`}));
   await context.route('**/classroom.js',route=>{let code=fs.readFileSync(path.join(root,'classroom.js'),'utf8');code=code.replace('db = api.getFirestore(instance);',`db = api.getFirestore(instance); api.connectFirestoreEmulator(db,'127.0.0.1',8080,{mockUserToken:{sub:'${uid}',user_id:'${uid}'}});`);code=code.replace('api.onAuthStateChanged(auth,',`((_,callback)=>callback({uid:'${uid}'}))(auth,`);return route.fulfill({contentType:'application/javascript',body:code});});
   const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});await p.goto(`http://127.0.0.1:${server.address().port}/`);try{await p.locator('#class-status').filter({hasText:'로그인 완료'}).waitFor({timeout:30000});}catch(error){console.error('STATUS',await p.locator('#class-status').innerText(),'ERRORS',errors);throw error;}return p;
  }
  const a=await page('teacher'),b=await page('student');const isRisk=fs.existsSync(path.join(root,'risk-core.js')),key=isRisk?'robot-risk-dashboard.v1':'robot-testbed-issues-v1';
  const original=await a.evaluate(key=>localStorage.getItem(key),key);
  for(const p of [a,b]){await p.locator('#class-code').fill(room);await p.locator('#class-join').click();await p.locator('#class-status').filter({hasText:'실시간 연결됨'}).waitFor();}
  assert.equal(await a.locator('#rows tr').count(),0);assert.equal(await b.locator('#rows tr').count(),0);
  async function fill(p,title){await p.locator('#add').click();await p.locator('[name=title]').fill(title);await p.locator('[name=owner]').fill('가상 수강생');await p.locator(isRisk?'[name=dueDate]':'[name=due]').fill('2026-12-31');if(isRisk){await p.locator('[name=probabilityPct]').fill('75');await p.locator('[name=scheduleImpact]').selectOption('4');await p.locator('[name=costImpact]').selectOption('3');await p.locator('[name=response]').fill('가상 대응');}}
  const form=isRisk?'#risk-form':'#form',err=isRisk?'#form-error':'#error';
  await fill(a,'공동 가상 항목, 한글');await a.locator(form+' button[type=submit]').click();await b.locator('#rows').getByText('공동 가상 항목, 한글',{exact:true}).waitFor();
  record('두 격리 브라우저: 등록 후 다른 참가자 목록에 실시간 반영');
  await a.locator('#rows button').filter({hasText:'수정'}).first().click();await b.locator('#rows button').filter({hasText:'수정'}).first().click();
  await a.locator('[name=title]').fill('강사가 먼저 수정');await a.locator(form+' button[type=submit]').click();await b.locator('#rows').getByText('강사가 먼저 수정',{exact:true}).waitFor();
  await b.locator('[name=title]').fill('오래된 편집');await b.locator(form+' button[type=submit]').click();await b.locator(err).filter({hasText:'다른 참가자'}).waitFor();assert.equal(await a.locator('#rows').getByText('오래된 편집',{exact:true}).count(),0);await b.locator('#cancel').click();
  record('동일 항목 동시 수정: 이전 버전 저장 거부·상대 수정 보존');
  await b.reload();await b.locator('#class-status').filter({hasText:'로그인 완료'}).waitFor();await b.locator('#class-code').fill(room);await b.locator('#class-join').click();await b.locator('#rows').getByText('강사가 먼저 수정',{exact:true}).waitFor();record('새로고침·재참가 후 서버 데이터 유지');
  if(isRisk){await b.locator('#import').click();await b.locator('#message').filter({hasText:'전체 JSON 복원'}).waitFor();assert.equal(await b.locator('#rows tr').count(),1);record('공동 수업 전체 JSON 복원 차단');assert.equal(await b.locator('#metric-count').innerText(),'1');}
  a.on('dialog',d=>d.accept());await a.locator('#rows button').filter({hasText:'삭제'}).first().click();await b.waitForFunction(()=>document.querySelectorAll('#rows tr').length===0);record('삭제 실시간 전파');
  await fill(b,'마감 후 저장 시도');await a.locator('#class-close').click();await b.locator('#class-status').filter({hasText:'마감'}).waitFor();await b.locator(form+' button[type=submit]').click();await b.locator(err).filter({hasText:'교육방 연결'}).waitFor();await b.locator('#cancel').click();record('강사 마감 후 학생 저장 차단');
  await a.locator('#class-leave').click();assert.equal(await a.evaluate(key=>localStorage.getItem(key),key),original);assert.equal(await a.locator('#rows tr').count(),isRisk?10:5);record('개인 모드 복귀·기존 localStorage 불변');
  await a.setViewportSize({width:390,height:844});assert(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await a.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);record('모바일 레이아웃·페이지 JavaScript 오류 없음');
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({type:'Firestore emulator and real Edge; OAuth mocked for emulator only',projectId,results,errors,unverified:['실제 GitHub OAuth 로그인','실제 Firebase 서비스','공개 사이트 공동 편집','수십 명 부하']},null,2));
 }finally{await browser.close();server.close();await env.cleanup();}
})().catch(e=>{console.error(e);process.exit(1);});
