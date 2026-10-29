# FundingBoard presentation editor

Sign in with the registered editing account, then choose **✎ 화면 편집** at the bottom right. The existing admin page also links to editable screens.

- Covers Funding, foreign flow, portfolio, investment plan, and stock/crypto research.
- Click annotated copy or a box, or use the selector. Edit plain text, delete copy, restore defaults, add a text/notice card, hide/restore a box, choose full/half/third/quarter width and minimum height, and move up/down within its layout group.
- Mobile cards use full width and automatic height. Financial values, source documents, calculations and private account records are not overwritten by this editor.
- Research changes are scoped to the selected asset; investment plan has a separate scope. Korean and English scopes are separate.
- **초안 저장** stores a private administrative draft; **게시** applies to visitors on their next page load. **미리보기** disables selection outlines for a local preview.
- Under recovery, reload saved content, restore page defaults, or choose a previous published version. Restoration itself is a draft until published. Reopen/reload the editor to refresh the history list after publishing.
- Changes use revision checks. On connection failure or a conflicting edit, unsaved input stays in the editor; reload only after deciding what to retain.
- Deleting a built-in box means hiding its presentation, not deleting financial data or personal records.

## Authorization/storage

`board_editors` registers existing verified owner identities. This is separate from analytics administrator privileges. Users cannot enroll themselves. `board_is_editor()` gates the UI, and `board_save_content()` checks the same permission server-side. Draft and revision tables use editor-only RLS; anonymous visitors can only call `board_public_content()` for the published JSON. No HTML/CSS/JS is accepted as executable content. Data is normalized, bounded and rendered as text.

## Earnings refresh audit, 2026-10-29

- The “분기 실적 상세 · 확정 재무제표” panel requests the `asset-research` Edge Function when the stock is opened. The deployed function fetches Naver quarterly financials, filters `isConsensus=N`, and caches an instance response for up to five minutes. There is no push-triggered DART ingestion or guaranteed immediate update when a filing is released. Excluding consensus is not independent certification that all figures are final/audited.
- Filing archive schedule: UTC Monday–Friday 21:43, i.e. Seoul Tuesday–Saturday 06:43. Actual Actions execution can be delayed. Latest observed run 40799197687 succeeded. Archive collector covers Samsung, SK hynix, Novo, Alphabet, Amazon and Nike; other issuers are not all connected.
- Earnings comparison cache schedule: UTC Monday–Friday 22:10 / Seoul Tuesday–Saturday 07:10. Latest observed run 40802096027 partially failed because several Korean quarterly/annual requests timed out. Last good files are retained. This is separate from the live quarterly-details path. Manually supplied supplements are not automatically replaced by a new filing.
