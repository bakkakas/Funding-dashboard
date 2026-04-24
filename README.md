# Funding Dashboard

정적 웹 대시보드입니다.

## 포함 파일
- `index.html` — 메인 대시보드
- `funding_data.json` — Binance funding 데이터

## GitHub Pages 배포 방법

### 1. 새 GitHub 저장소 생성
예시 이름:
- `funding-dashboard`

### 2. 이 폴더의 파일 업로드
업로드할 파일:
- `index.html`
- `funding_data.json`
- `README.md`

### 3. GitHub Pages 활성화
GitHub 저장소에서:
- `Settings`
- `Pages`
- `Build and deployment`
- `Source: Deploy from a branch`
- `Branch: main`
- `Folder: / (root)`

### 4. 배포 URL 확인
보통 아래 형식으로 생성됩니다:
- `https://<github-username>.github.io/funding-dashboard/`

## 데이터 구조
`funding_data.json`에 pair를 추가하면 대시보드에서 자동으로 탭이 생기도록 구성되어 있습니다.

예시 구조:
```json
{
  "updatedAt": 1710000000000,
  "pairs": {
    "GOOGLUSDT": {
      "symbol": "GOOGLUSDT",
      "count": 10,
      "avgFundingRate": 0.0001,
      "annualizedPct": 10.95,
      "firstFundingTime": 1710000000000,
      "lastFundingTime": 1710500000000,
      "rows": []
    }
  }
}
```

## 참고
Annualized는 최근 표본의 평균 funding을 단순 연환산한 값이며, 미래 확정 수익률이 아닙니다.
