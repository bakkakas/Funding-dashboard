# Funding Dashboard

정적 웹 대시보드 + 자동 데이터 갱신 스크립트입니다.

## 포함 파일
- `index.html` — 메인 대시보드
- `funding_data.json` — 집계 결과 데이터
- `update_data.py` — Binance funding 데이터를 다시 받아와 JSON 생성
- `.nojekyll` — GitHub Pages 정적 배포용

## 현재 지원
### Binance
- GOOGLUSDT
- AMZNUSDT
- 7일 / 30일 / 90일 기준 annualized 계산
- 회차별 funding history 테이블
- 차트 표시

### 비교 상태 표시
- Hyperliquid `xyz:GOOGL` → spot market이라 funding 비교 대상 아님
- THENA `GOOGLUSDT` → 현재 이 환경에서 public endpoint 접근이 403으로 차단되어 비교 불가

## 로컬 데이터 갱신
```bash
python3 update_data.py
```

## GitHub Pages 배포
이 저장소는 GitHub Pages root 배포를 기준으로 동작합니다.

## 향후 확장
`update_data.py`의 `PAIRS`에 종목을 추가하면 Binance pair는 쉽게 확장 가능합니다.
