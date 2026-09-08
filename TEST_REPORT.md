# 배포 검증 보고서

## 로컬 검증
- 환경: Microsoft Edge 152.0.4191.66 / Playwright, 격리된 headless 컨텍스트, file:// 직접 실행.
- 순수 로직 7개 테스트 통과: 확률 경계, 25개 P/I 조합, 등급·날짜, 샘플 집계, 종료·기한, 복원 검증, ID·백업 왕복.
- 실제 브라우저 10개 시나리오 묶음 통과: 초기 KPI, 검색·필터·정렬·매트릭스, 등록·수정·삭제·저장, JSON 다운로드·복원·취소·오류, 모바일, 저장 예외, 공백 입력, 계산 기준 펼침, 오류·외부 요청 없음.
- 1440×1100 및 390×844 화면을 확인했습니다.
- 테스트 결과는 저장소 외부 risk-dashboard-qa-local에 보관합니다. 사용자 저장 데이터와 테스트 JSON은 커밋하지 않습니다.

## 공개 사이트 검증
실제 https://namwoongchan.github.io/robot-testbed-risk-dashboard/ 에서 Edge 152.0.4191.66 / Playwright로 10개 시나리오 묶음을 모두 통과했습니다. 로컬 실행과 별도의 격리 컨텍스트를 사용했습니다.

| 검사 | 로컬 | 공개 HTTPS |
|---|---|---|
| 등록·수정·삭제·취소 | 통과 | 통과 |
| 실시간 점수·KPI·매트릭스·검색/필터/정렬 | 통과 | 통과 |
| 새로고침 저장 | 통과 | 통과 |
| 실제 JSON 다운로드·복원·복원 취소·빈 목록 | 통과 | 통과 |
| 손상·중복·1MB 초과 복원 거부 | 통과 | 통과 |
| 저장 오류 주입·손상 원본 보존 | 통과 | 통과 |
| 공백 필수값·HTML 문자열 안전 표시 | 통과 | 통과 |
| 390px 화면·모달·Escape | 통과 | 통과 |
| 콘솔/페이지 오류 | 0건 | 0건 |
| 통신 | HTTP 요청 0건 | 사이트 파일 외 타사 요청 0건, HTTP 오류 응답 0건 |

공개 사이트 데스크톱·모바일 캡처를 직접 열어 검토했습니다. 공개 사이트 실행 결과와 캡처는 저장소 외부 risk-dashboard-qa-live에 보관합니다.

배포 커밋: bab9dcbe42e560473e86617b76cfb30d4e60a2df
배포 성공 기록: https://github.com/NAMWoongchan/robot-testbed-risk-dashboard/actions/runs/34173602817
배포 파일은 gh-pages의 index.html, styles.css, app.js, risk-core.js, sample-data.js 5개입니다. 이 보고서·테스트·작업 기록은 사이트 배포에 포함하지 않습니다.

## 공개 전 검토
실행 코드, 가상 샘플, 문서, 테스트를 검토했습니다. 토큰·개인키·이메일·전화번호 패턴 검사에서 탐지 0건. 샘플은 역할명과 가상 상황이며 실제 사업 자료는 포함하지 않습니다. 자동 검사만으로 모든 민감정보 부재를 보증하는 것은 아닙니다.

## 제한
Chrome·Firefox·Safari, 실제 휴대전화, 스크린리더, 자정 통과 장시간 대기, 대규모 성능 및 다중 탭 충돌은 미검증입니다. 저장 실패는 오류 주입 방식으로 검증했습니다. 평가 기준은 데모이며 실제 사업 적합성의 확인 가능한 근거 없음.

## 재현
- node --test tests/core.test.cjs
- node tests/browser-test.cjs
- node tests/browser-test.cjs https://namwoongchan.github.io/robot-testbed-risk-dashboard/ <결과 폴더>
개발용 Node.js, Playwright 및 Edge가 필요합니다. 일반 사용에는 설치가 필요 없습니다.
