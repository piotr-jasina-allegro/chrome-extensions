Chrome extension
==============================

<img width="1491" height="678" alt="image" src="https://github.com/user-attachments/assets/c3e3111e-8cad-4ae7-b78a-29db3a6346e8" />
<img width="1484" height="706" alt="image" src="https://github.com/user-attachments/assets/c333d3e1-6292-4fc8-a12b-cdd404a3448b" />

## Description

Chrome extension for JIRA:

- set Team field for new issues

## Installation

1. Clone the repository.
2. Run `npm install && npm run build` (see [Development](#development) below).
3. Go to `chrome://extensions/` in a browser and enable **Developer mode**.
4. Click `Load unpacked` and select the `dist/` folder (not the repo root).

## How to update

1. Pull updates from the repository.
2. Run `npm install && npm run build` again to regenerate `dist/`.
3. Go to `chrome://extensions/` in a browser.
4. Find the extension and click the refresh button :).

## Development

- `npm install` — install dependencies
- `npm run build` — build the extension into `dist/`
- `npm run dev` — build in watch mode; reload the unpacked extension in Chrome after each rebuild
- `npm test` — run the Jest test suite
- `npm run type-check` — run `tsc --noEmit`
- `npm run lint` / `npm run lint:fix` — run ESLint
- `npm run format` — run Prettier

### Loading the extension in Chrome

1. Run `npm run build`.
2. Go to `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` folder, not the repo root.

See `docs/ARCHITECTURE.md` for the directory layout, data flow, and preserved quirks.
