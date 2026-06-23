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
- `xyz:SNDK`
- `xyz:MU`
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
- `HYPE`
- 1일 / 7일 / 30일 / 90일 기준 annualized 계산
- 회차별 hourly funding history 테이블
- current funding / mark / oracle / 다음 hourly funding 카운트다운 반영

### Binance
- GOOGLUSDT
- SAMSUNGUSDT
- SKHYNIXUSDT
- SNDKUSDT
- MUUSDT
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
- HYPEUSDT
- 1일 / 7일 / 30일 / 90일 기준 annualized 계산
- 회차별 funding history 테이블
- 차트 표시

### Bybit
- GOOGLUSDT
- SAMSUNGUSDT
- SKHYNIXUSDT
- SNDKUSDT
- MUUSDT
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
- HYPEUSDT
- 1일 / 7일 / 30일 / 90일 기준 annualized 계산
- current funding / mark / index / next funding 반영

### 비교 상태 표시
- Hyperliquid `xyz` HIP-3 perp → public info API로 funding 비교 가능
- 같은 종목은 종목명 검색으로 고른 뒤 지원 거래소 목록에서 Binance / Hyperliquid / Bybit 등 거래소 칩으로 전환

## 로컬 데이터 갱신
```bash
python3 update_data.py
```

## 텔레그램 알림 MVP
`update_data.py` 실행 후 생성되는 `alerts.json`을 기준으로 high alert를 보낼 수 있습니다.

미리보기:
```bash
python3 send_telegram_alerts.py --dry-run --limit 3
```

실제 발송:
```bash
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... python3 send_telegram_alerts.py
```

- 기본값은 `high` 알림만 최대 10개 발송합니다.
- `alert_state.json`에 발송 이력을 저장해서 같은 alert 중복 발송을 막습니다.
- GitHub Actions에서는 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` secrets가 설정된 경우에만 발송합니다.

## GitHub Pages 배포
이 저장소는 GitHub Pages root 배포를 기준으로 동작합니다.

## 향후 확장
`update_data.py`의 `PAIRS`에 거래소와 종목을 추가하면 확장 가능합니다.
