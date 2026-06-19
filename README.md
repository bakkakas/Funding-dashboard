# Funding Dashboard

정적 웹 대시보드 + 자동 데이터 갱신 스크립트입니다.

## 포함 파일
- `index.html` — 메인 대시보드
- `funding_data.json` — 집계 결과 데이터
- `update_data.py` — 거래소별 funding 데이터를 다시 받아와 JSON 생성
- `.nojekyll` — GitHub Pages 정적 배포용

## 현재 지원
### Hyperliquid
- `xyz:GOOGL`
- `xyz:SAMSUNG` (`xyz:SMSN`)
- `xyz:SKHYNIX` (`xyz:SKHX`)
- `xyz:GOLD`
- `xyz:AMZN`
- `xyz:AAPL`
- `xyz:TSLA`
- `xyz:NVDA`
- `xyz:META`
- `xyz:MSFT`
- `xyz:MSTR`
- `xyz:COIN`
- `xyz:TSM`
- `xyz:PLTR`
- `xyz:BABA`
- 1일 / 7일 / 30일 / 90일 기준 annualized 계산
- 회차별 hourly funding history 테이블
- current funding / mark / oracle / 다음 hourly funding 카운트다운 반영

### Binance
- GOOGLUSDT
- SAMSUNGUSDT
- SKHYNIXUSDT
- XAUUSDT
- AMZNUSDT
- AAPLUSDT
- TSLAUSDT
- NVDAUSDT
- METAUSDT
- MSFTUSDT
- MSTRUSDT
- COINUSDT
- TSMUSDT
- PLTRUSDT
- BABAUSDT
- QQQUSDT
- SPYUSDT
- 1일 / 7일 / 30일 / 90일 기준 annualized 계산
- 회차별 funding history 테이블
- 차트 표시

### Bybit
- GOOGLUSDT
- SAMSUNGUSDT
- SKHYNIXUSDT
- XAUTUSDT
- AMZNUSDT
- AAPLUSDT
- TSLAUSDT
- NVDAUSDT
- METAUSDT
- MSFTUSDT
- MSTRUSDT
- COINUSDT
- TSMUSDT
- PLTRUSDT
- BABAUSDT
- QQQUSDT
- SPYUSDT
- 1일 / 7일 / 30일 / 90일 기준 annualized 계산
- current funding / mark / index / next funding 반영

### 비교 상태 표시
- Hyperliquid `xyz` HIP-3 perp → public info API로 funding 비교 가능
- 같은 종목은 종목명 검색으로 고른 뒤 지원 거래소 목록에서 Binance / Hyperliquid / Bybit 등 거래소 칩으로 전환

## 로컬 데이터 갱신
```bash
python3 update_data.py
```

## GitHub Pages 배포
이 저장소는 GitHub Pages root 배포를 기준으로 동작합니다.

## 향후 확장
`update_data.py`의 `PAIRS`에 거래소와 종목을 추가하면 확장 가능합니다.
