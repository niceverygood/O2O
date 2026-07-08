# 위치기반 공동구매 O2O 클릭형 MVP

합의 범위 기준의 검증용 프로토타입입니다.

## 실행

```bash
pnpm install
pnpm dev
```

## 개별 접속 주소

- 사용자 앱: http://localhost:5173/customer
- 사장님 앱: http://localhost:5173/owner
- 검증 대시보드: http://localhost:5173/dashboard
- 앱 선택 화면: http://localhost:5173/

## PostHog

`.env`에 아래 값을 넣으면 로컬 이벤트 로그와 함께 PostHog로 이벤트가 전송됩니다.

```bash
VITE_POSTHOG_KEY=phc_xxx
VITE_POSTHOG_HOST=https://app.posthog.com
```

키가 없으면 브라우저 `localStorage`에 이벤트가 저장되고, 앱의 검증 대시보드에서 CSV로 내보낼 수 있습니다.

## 포함 범위

- 사장님 상품 등록 플로우
- 사용자 공동구매 리스트, 상세, 참여, 그룹방 생성, 설문
- 테스트용 회원정보 입력
- 좋아요/공유 UI
- 이벤트 수집, 체류시간, Funnel, 설문 연계
- CSV 내보내기와 QR 코드

## 제외 범위

- 실제 결제
- 실제 SNS API 연동
- 실시간 채팅/위치 매칭
- 관리자 운영 시스템/정산
- 심층 분석 컨설팅/발표자료 작성
