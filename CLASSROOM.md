# 공동 수업 연결 안내 (개발 브랜치)

이 기능은 **Firebase 연결 전**입니다. `classroom-config.js`의 `enabled` 기본값은 `false`이며, 공개 사이트의 공동 편집이 운영 중이라는 의미가 아닙니다. 기존 개인 모드는 계속 작동합니다.

## 수업에서의 사용 흐름
1. 강사는 Firebase에서 등록한 GitHub 계정으로 로그인하고 교육방을 만듭니다.
2. 두 대시보드 URL과 **같은 교육방 코드**를 수강생에게 전달합니다.
3. 수강생은 GitHub 로그인 후 교육방 코드를 입력합니다. 교육방의 이슈와 리스크는 각각의 보드에 표시됩니다.
4. 수강생이 등록·수정·삭제하면 같은 교육방 참가자에게 실시간 반영됩니다.
5. 같은 항목을 동시에 수정한 경우 먼저 저장한 변경을 보존하고, 나중 저장은 충돌 메시지로 차단합니다. 입력을 복사한 뒤 창을 닫고 최신 항목에서 다시 수정합니다.
6. 강사는 수업 종료 후 교육방을 마감합니다. 참가자의 추가 저장과 신규 참가가 차단됩니다.

교육용 가상 데이터만 사용합니다. 참가자는 교육방의 모든 항목을 수정·삭제할 수 있습니다. **URL을 아는 모든 익명 사용자에게 쓰기 권한을 주는 방식은 아닙니다.** 로그인과 교육방 코드가 필요합니다.

## 운영자가 최초 한 번 설정할 내용
다음 작업은 계정 소유자의 Firebase 인증이 필요합니다. 비밀번호·GitHub OAuth Client Secret·서비스 계정 비밀키를 채팅이나 저장소에 넣지 마세요.

1. Firebase 콘솔에 로그인하고 교육용 프로젝트를 선택하거나 만듭니다. 결제 연결·요금제 변경은 하지 않습니다.
2. 웹 앱을 등록하고 Cloud Firestore 기본 데이터베이스를 만듭니다. 데이터 위치는 프로젝트 운영자와 합의합니다.
3. Authentication에서 GitHub 공급자를 활성화합니다. GitHub OAuth App에 Firebase가 안내하는 콜백 URL을 등록합니다. OAuth Client Secret은 Firebase 콘솔에만 입력합니다.
4. Authentication의 승인 도메인에 `namwoongchan.github.io`를 등록합니다. 두 Pages 사이트는 같은 도메인입니다.
5. 두 저장소의 `classroom-config.js`에 **같은 프로젝트의 공개 웹 앱 설정**을 입력합니다. 실제 서버 규칙 배포와 검증 후 `enabled:true`로 전환합니다.
6. `firebase deploy --only firestore:rules --project <프로젝트ID>`로 `firestore.rules`를 배포합니다. 두 저장소의 규칙은 같으며 한 번만 배포합니다. 공개 읽기/쓰기 테스트 규칙은 사용하지 않습니다.
7. 강사가 로그인하여 화면에 표시된 UID를 확인합니다. Firebase 콘솔에서 `teachers/<강사UID>` 문서를 생성합니다. 일반 사용자는 이 문서를 만들거나 수정할 수 없습니다.
8. 실제 GitHub 로그인, 강사 방 생성, 서로 다른 수강생 계정 2개, 마감/재개, 재접속, 모바일을 검증합니다. 검증 후 Pages에 앱 파일을 배포합니다.

## 데이터와 제한사항
- 개인 localStorage 데이터는 자동으로 서버에 보내지 않습니다. 개인 모드로 돌아가면 기존 개인 목록을 표시합니다.
- 공동 수업은 Firestore에 저장합니다. 같은 교육방을 다시 참가하면 서버 데이터를 불러옵니다. 새로고침 후 교육방 코드를 다시 입력해야 합니다.
- JSON 백업과 CSV 내보내기는 현재 화면 모드의 데이터가 대상입니다. 리스크 JSON 전체 복원은 개인 모드에서만 지원합니다. 공동 자료 일괄 이관은 아직 지원하지 않습니다.
- 항목별 버전 검사와 Firestore 트랜잭션을 사용합니다. 저장 완료 안내 전에는 창을 닫지 마세요. 오프라인 공동 저장은 지원하지 않습니다.
- 정상 UI는 보드당 활성 항목 최대 200건을 허용합니다. 보안 규칙은 각 항목의 필수값·타입·상태·점수 범위를 제한합니다. 200건 제한은 서버 전체 건수 제한이 아니며, 대규모 운영에는 추가 서버 제한이 필요합니다.
- 삭제는 서버에 삭제 표시를 남깁니다. 화면은 삭제 항목을 제외합니다. 감사 이력 전체 보관, 이전 버전 복구 UI, 학생별 편집 범위, 참가자 강제 퇴장, 자동 보존기간 처리는 아직 없습니다.
- 방 코드를 전달받은 로그인 사용자는 열린 방에 참가할 수 있습니다. 코드는 공개 게시하지 말고 수업 참여자에게 전달하세요.
- 강사가 마감해도 기존 참가자는 자료를 읽을 수 있습니다. 재개 후에는 교육방 참가를 다시 눌러 연결을 확인합니다.
- Firestore 서버 규칙의 날짜 검사는 형식 기준이며 실제 달력 날짜는 앱에서 추가 검증합니다.
- 무료 할당량은 수업 인원·읽기/쓰기 횟수에 따라 소진될 수 있습니다. 실제 동시 수강생 수의 부하 시험 및 할당량 확인 전 대규모 교육 운영을 확정하지 않습니다.

## 파일과 배포
기존 앱 5개 파일과 `classroom.js`, `classroom-config.js`, `classroom.css`만 gh-pages에 배포합니다. `firebase.json`, `firestore.rules`, 테스트, README와 작업 기록은 사이트 브랜치에서 제외합니다. Firebase 비밀키 파일은 어느 브랜치에도 커밋하지 않습니다.

## 검증 재실행
개발 도구: Node.js, Firebase CLI, Java 21, Firebase JS SDK 12.18.0, @firebase/rules-unit-testing, Playwright, Edge.

```text
firebase emulators:start --only firestore --project demo-classroom
node tests/classroom.integration.cjs . <저장소 밖 결과폴더>
```

테스트는 demo-classroom 에뮬레이터 데이터를 초기화합니다. 실제 Firebase 프로젝트를 사용하지 않습니다. 브라우저 테스트의 사용자 인증은 에뮬레이터용 모의 인증이며 **실제 GitHub OAuth 통과를 입증하지 않습니다.** 실제 Firestore SDK와 에뮬레이터를 사용하여 서버 보안 규칙·브라우저 간 실시간 갱신·충돌 거부를 검증합니다.

## 공식 출처
- [Firebase GitHub 로그인](https://firebase.google.com/docs/auth/web/github-auth) — Google Firebase, OAuth 공급자 설정과 웹 로그인.
- [Firestore 보안 규칙](https://firebase.google.com/docs/firestore/security/rules-conditions) — Google Firebase, 인증·문서별 접근 제어.
- [Firestore 트랜잭션](https://firebase.google.com/docs/firestore/manage-data/transactions) — Google Firebase, 동시 변경 시 원자적 저장.
- [Firestore 실시간 데이터](https://firebase.google.com/docs/firestore/query-data/listen) — Google Firebase, 변경 구독.
- [Firebase 가격·할당량](https://firebase.google.com/pricing) — Google Firebase, 실제 운영 전 확인할 무료 사용 범위.
- [Firestore 에뮬레이터](https://firebase.google.com/docs/emulator-suite/connect_firestore) — Google Firebase, 실제 서비스와 분리한 검사.
