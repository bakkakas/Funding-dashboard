# 종목 추가와 유지보수

투자 셋업은 하나의 공통 HTML·렌더러·점수 엔진을 사용한다. 실제 등록 종목은 `index.json`으로 관리하며, 테스트 종목은 배포 데이터에 넣지 않는다.

## 새 종목 추가

1. `index.json`의 `assets`에 고유 `id`, `name`, `symbol`, `category`, 선택적으로 `logo`, `updatedAt`을 추가한다. `id`는 소문자·숫자·하이픈만 허용한다.
2. 같은 디렉터리에 `<id>.json`을 만든다. 아래 최소 문서로도 표시 가능하다.
3. 프로젝트별 출처를 확인하며 데이터·콘텐츠를 채운다. 미등록 데이터는 ETHFI 값으로 대체하지 않는다.
4. `node --test tests/*.test.mjs`를 실행하고 `investment-setup.html?asset=<id>`에서 실제 연결을 확인한다.

```json
{
  "schemaVersion": 1,
  "id": "example-project",
  "name": "Example Project",
  "symbol": "EXAMPLE",
  "category": "dex",
  "updatedAt": "2026-09-08",
  "market": { "coingeckoId": null, "maxSupply": null },
  "metrics": { "defillamaSlug": null },
  "chart": null,
  "evaluation": { "profile": null },
  "copy": { "heroSummary": { "ko": "프로젝트 설명", "en": "Project summary" } },
  "links": [],
  "drivers": [],
  "news": [],
  "unlock": { "status": "unknown", "events": [], "sources": [] },
  "ruleSources": {}
}
```

`coingeckoId`와 `defillamaSlug`는 티커가 아니라 각 공급자의 실제 식별자다. 종목별 데이터 연결을 검증한 뒤 입력한다. 현재 지원 수집기는 CoinGecko 시장 지표와 DefiLlama TVL·fees·revenue·holders revenue이며, 새로운 데이터 공급자는 `research-data.js`에 별도 어댑터를 추가해야 한다.

## 콘텐츠

- `copy`: `heroSummary`, `overviewBody`, `tokenRoleValue`, `supplyValue`, `insiderUnlock`, `unlockNote`의 한·영 텍스트.
- `links`, `overviewSource`, `unlock.sources`: `{ "url": "https://…", "label": { "ko": "공식 문서", "en": "Official docs" }, "logo": "https://…" }`.
- `drivers`: `{ "title": {…}, "body": {…}, "sources": […] }` 배열.
- `news`: `{ "date": "YYYY-MM-DD", "title": {…}, "body": {…}, "source": {…} }` 배열.
- `chart`: `{ "symbol": "EXCHANGE:TICKER", "url": "https://…" }` 또는 `null`.
- `ruleSources`: `growth`, `valueCapture`, `unlockPressure`, `criticalRisk`별 출처 객체. 누락된 출처는 다른 종목으로 연결하지 않는다.

모든 콘텐츠는 텍스트 노드로 출력하고 외부 링크는 HTTP(S)만 허용한다. ETHFI 뉴스·설명·등록 언락은 기존 자료를 그대로 이관했으며 이번 구조 변경에서 새 리서치를 한 것은 아니다. 뉴스와 언락 일정의 주기적 자동 수집은 아직 없다.

## 평가 프로필

`profiles.json` 한 곳에서 가중치와 임계값을 관리한다. 종목 문서의 `evaluation.profile`이 해당 프로필 ID를 지정한다. 프로필의 `category`와 종목 분류가 같아야 하며, `assetIds`가 있으면 해당 종목도 명시되어야 한다.

현재 유일한 프로필 `ethfi-beta-v1`은 ETHFI에만 허용된다. DEX·대출·인프라 등의 검증된 평가 모델이 이미 존재한다는 뜻이 아니다. 새 종목은 기본적으로 `평가 기준 미설정`이며, 분석을 거쳐 적합한 프로필을 지정해야 한다. 같은 분류라고 ETHFI 규칙을 자동 상속하지 않는다.

엔진의 현재 입력은 TVL 30일 변화, 홀더 수익 30일, 다음 언락/유통량, 시총/연환산 프로토콜 수익, 보안 검토 상태다. 새 종류의 지표·산식을 도입할 때는 공통 엔진을 확장한다. 기존 입력을 쓰는 가중치·임계값 변경에는 화면 수정이 필요 없다. 임계값 설명도 설정에서 계산한다.

미확인 값은 0점이나 만점으로 바꾸지 않고 제외한다. 가중 커버리지가 `minimumCoverage` 미만이면 최종 신호는 `판정 보류`다. 숫자 점수는 평가 가능한 항목의 100점 환산값이며, 서로 다른 프로필·커버리지의 숫자를 동일한 투자 순위로 취급하지 않는다. 규칙은 Beta이며 투자 성과로 검증되지 않았다.

## 언락

- `unknown`: 미등록·확인 필요. 일정이 없다는 이유로 완료 또는 매도 압력 0으로 판단하지 않는다.
- `scheduled`: `events`에 날짜와 수량을 등록한다. 같은 날짜의 물량은 합산해 한 항목으로 저장한다. 지나간 마지막 일정만으로 베스팅 완료를 추정하지 않는다.
- `complete`: 출처로 전체 완료를 확인한 경우에만 지정한다. `events`는 비워 둔다.
- `vestingEnd`: 등록 일정의 마지막 날짜를 설명하는 값.
- `completeSchedule: true`: 전체 공급량 기준의 모든 잔여 해제 일정을 검증한 경우에만 사용한다. 이 경우에만 `100% - 잔여`를 해제 비율로 표시한다. 일부 배분 일정만으로 전체 해제율을 계산하지 않는다.

## 저장·조회

- `fundingInvestmentDecision.<id>.v1`: 종목별 판단·관심 가격·논리. 기존 `fundingInvestmentDecision.ethfi.v1`을 변경하지 않아 ETHFI 입력값 유지.
- `fundingResearchCollections.v1`: 기존 즐겨찾기·사용자 리스트 유지.
- 계정 동기화는 추가하지 않았으며 이 브라우저에 저장한다.
- `?asset=<id>`로 직접 열기·새로고침·뒤로/앞으로 이동 지원.
- 선택한 종목의 상세 JSON과 API만 조회한다. 전환 시 이전 요청을 취소하고 응답 버전을 검증해 데이터가 섞이지 않도록 한다.
- 요청당 15초 제한, 지표별 독립 실패 처리. 시장 데이터 24시간·TVL 최신 관측 3일 초과 시 사용하지 않는다. 이는 공급자 지표 정의와 수익 분류까지 검증한다는 의미가 아니다.
