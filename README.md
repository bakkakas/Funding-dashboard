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
- `xyz:CRCL`
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
- CRCLUSDT
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
- CRCLUSDT
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

## Ethena · USDe 시총 보드

`investment-setup.html?asset=ena`에 USDe 전체 체인 USD 시총, 1일·7일·30일·365일 변화액/변화율과 기간별 차트를 표시합니다. ENA 시총·Ethena TVL·sUSDe를 합산하지 않습니다.

- 출처: DefiLlama `stablecoincharts/all?stablecoin=146`의 `totalCirculatingUSD.peggedUSD`. 유통 토큰 수량을 USD 시총으로 대체하지 않습니다.
- 제공처의 중복 CORS 헤더 때문에 브라우저는 같은 사이트의 `data/usde-market-cap.json`을 읽습니다.
- `python3 scripts/update_usde_market_cap.py`로 수집합니다. `update-usde.yml`이 6시간마다 수집하고 Pages 빌드를 요청합니다. 화면은 5분마다 갱신을 확인합니다.
- 변화량은 최신 일별 관측일 기준이며 각 비교 날짜를 표시합니다. 48시간 초과 지연, 실패, 누락된 비교치는 별도 표시하며 0으로 대체하지 않습니다. 수집 실패 시 기존 파일을 유지합니다.
- 검증: `node --test tests/usde-market-cap.test.mjs tests/research-data.test.mjs` 및 `python3 -m unittest discover -s tests -p test_usde_market_cap.py`.

### 바이백 마일스톤과 시총 알림

- Ethena 보고서 최상단에 공식 USDe **유통량** 마일스톤 7.5B/10B/15B/20B/25B+ 및 단계 비율 5/10/15/20/25%를 표시합니다. [공식 제안·투표 통과 확인](https://gov.ethenafoundation.com/t/ena-fee-switch-activation/830), 확인일 2026-09-16. 14일 평균은 위원회 권고로만 표시하며 실제 집행을 자동 판정하지 않습니다.
- `js/usde-observation.js`는 CoinGecko `ethena-usde`에서 현재 USD 시총과 유통량을 **별도** 필드로 읽고 1시간 초과 지연 데이터를 거절합니다. 관심 시총은 $5B/$6B/$7B/$7.5B. 기존 DefiLlama 일별 차트와 기준 시각 및 출처가 다릅니다.
- 소유자 알림은 웹 방문자가 아니라 별도 OpenClaw 스크립트 작업으로 실행합니다. `scripts/check_usde_milestones.mjs`는 읽기 전용 수집기, `js/usde-alerts.js`는 부작용 없는 상태 평가기입니다. 수신 채널·상태는 공개 저장소에 저장하지 않습니다.
- 소유자 감시: 매일 08:00 Asia/Seoul, Telegram 개인 DM. 시총 기준은 $5B/$6B/$7B/$7.5B/$9B/$10B/$11B/$13B/$15B/$17B/$19B/$20B/$22B/$24B/$25B이며 각 1회만 알립니다. 여러 기준을 넘으면 묶음 발송합니다. 초기 관측 이전의 도달은 재알림하지 않습니다.
- `scripts/usde-monitor-script.mjs`는 스케줄러 스크립트를 생성합니다. 전송 실패 시 미전송 알림을 재시도하고, 마지막 DM 전달이 확인되면 다음 실행에서 시총 재조회 없이 작업을 삭제합니다. 실패·오래된 관측은 도달 상태를 변경하지 않습니다. Mac과 OpenClaw Gateway 실행이 필요하며 일일 검사 사이의 일시 돌파는 포착하지 못할 수 있습니다.
- 검증: `node --test tests/usde-milestones.test.mjs`. 최신 조회 실패에도 공식 기준은 계속 표시합니다.

## 향후 확장
`update_data.py`의 `PAIRS`에 거래소와 종목을 추가하면 확장 가능합니다.
