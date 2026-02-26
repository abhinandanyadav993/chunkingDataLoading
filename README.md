# Legacy Redux Table Demo (TypeScript)

This sample app implements your requested behavior using classic Redux (`redux` + `react-redux` + `redux-thunk`) and **no Redux Toolkit**.

## Implemented flow

- Page size is fixed to **10** rows.
- Initial API call fetches **1 to 60** records (pages 1 to 6).
- Pagination buttons after page 6 stay disabled until the remaining range is processed.
- Second API call fetches **61 to totalRecord**.
- If API returns failed offsets (example: `[7,8]`), app retries with `failedOffsets`.
- If retry fails again, pages are marked failed and show a page-level message.
- Filter input stays disabled until:
  - all pages are loaded, or
  - API has finalized failed pages.

## Run

```bash
cd legacy-redux-table-demo
npm install
npm run dev
```

## Notes

- `src/api/mockTableApi.ts` simulates the backend and supports failed offset retry.
- Use the checkbox in the UI to simulate "retry fails again" for pages 7 and 8.
