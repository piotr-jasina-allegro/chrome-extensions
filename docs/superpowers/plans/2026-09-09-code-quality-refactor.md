# Code Quality Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the "Boring Stuff Helper" Chrome extension to TypeScript with ESLint/Prettier, a Vite build pipeline, a `src/`-based directory layout, and expanded test coverage — with **zero functional behavior changes**.

**Architecture:** Move every runtime file under `src/` (`background/`, `content/` + `content/sites/`, `popup/`, `shared/`), add strict TypeScript typing on top of the existing logic, and introduce Vite + `@crxjs/vite-plugin` as the build step that reads `manifest.json` and produces `dist/`. Existing Jest test suite is extended (not replaced) with `@babel/preset-typescript` so `.test.ts` files run through the current Babel/Jest setup.

**Tech Stack:** TypeScript (strict), Vite + `@crxjs/vite-plugin`, ESLint (flat config, `typescript-eslint` + `eslint-config-prettier`), Prettier, Jest + Babel (`@babel/preset-typescript`, `jest-environment-jsdom`), `@types/chrome`.

**Spec:** `docs/superpowers/specs/2026-09-09-code-quality-refactor-design.md`

## Global Constraints

- **Zero behavior change.** Every migrated function must produce identical output/side effects to today's `.js` version. Where TypeScript's strict mode forces a decision on an ambiguous runtime case, preserve the *original* runtime behavior (see "Known preserved quirks" below) rather than silently fixing it.
- **`strict: true`** in `tsconfig.json` — no exceptions per-file.
- **ESLint base:** `eslint:recommended` + `typescript-eslint` recommended rules + `eslint-config-prettier` (Prettier owns formatting, ESLint owns everything else).
- **Prettier:** single quotes, 4-space indent (matches current code), semicolons on.
- **Test runner:** Jest via the existing Babel pipeline — no `ts-jest`.
- **Directory layout:** `src/background`, `src/content/sites`, `src/popup`, `src/shared` (see spec for full tree).
- **Out of scope (do not touch):** the `MutationObserver` leak / `safeSetupAdp` race condition in `content.js`, the `background.js` logging typo, the missing GitHub URL mapping in `websiteMatches`, and any CI setup. These are pre-existing, catalogued issues explicitly deferred by the project owner.
- **Every task ends with:** `npm test`, `npx tsc --noEmit`, and `npm run lint` all passing (once the relevant configs exist — Task 1 establishes them).

## Known preserved quirks (do not "fix" during migration)

1. **`JiraIssue.parentKey` is always `undefined`.** The original `buildIssuesSummary` in `utils.js` checks `e.parentKey` (which never exists on real Jira API objects — the real field is `e.fields.parent.key`), so the "parent issue" annotation in the popup summary never actually renders even when a parent exists. This is preserved exactly; the type includes an optional `parentKey?: string` field with a comment explaining why, purely so TypeScript strict mode compiles without changing runtime behavior.
2. **`kibanaLink`/`linkFromStorage` race in `createButton`** (already fixed in a prior task — not part of this plan) stays as previously fixed; do not re-touch its logic beyond adding types.

---

## Task 1: Tooling foundation (TypeScript, ESLint, Prettier, Jest wiring)

**Files:**
- Modify: `package.json`
- Modify: `babel.config.js`
- Create: `tsconfig.json`
- Create: `jest.config.js`
- Create: `eslint.config.js`
- Create: `.prettierrc`
- Create: `.prettierignore`
- Create: `.gitignore`
- Create: `src/shared/types.ts`

**Interfaces:**
- Produces: `src/shared/types.ts` exporting `WebsiteType`, `StatusMap`, `RenderOptions`, `JiraIssueFields`, `JiraIssue` — every later task imports these exact names.

- [ ] **Step 1: Add `.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install --save-dev typescript @types/chrome vite @crxjs/vite-plugin \
  eslint @eslint/js typescript-eslint eslint-config-prettier prettier \
  @babel/preset-typescript
```

- [ ] **Step 3: Update `package.json` scripts**

Replace the `"scripts"` block with:

```json
"scripts": {
    "test": "jest",
    "type-check": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "build": "vite build",
    "dev": "vite build --watch"
}
```

- [ ] **Step 4: Add TypeScript support to Babel — modify `babel.config.js`**

```js
module.exports = {
    presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript'
    ],
};
```

- [ ] **Step 5: Create `jest.config.js`**

```js
module.exports = {
    testEnvironment: 'jsdom',
};
```

- [ ] **Step 6: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["chrome"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

- [ ] **Step 7: Create `eslint.config.js`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
    { ignores: ['dist/**', 'node_modules/**', '**/*.js'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    eslintConfigPrettier,
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            globals: {
                chrome: 'readonly',
                document: 'readonly',
                window: 'readonly',
                console: 'readonly'
            }
        }
    }
);
```

(The blanket `**/*.js` ignore keeps every not-yet-migrated legacy file out of lint scope; it stays harmless once those files are deleted in later tasks.)

- [ ] **Step 8: Create `.prettierrc`**

```json
{
  "singleQuote": true,
  "semi": true,
  "tabWidth": 4,
  "printWidth": 100
}
```

- [ ] **Step 9: Create `.prettierignore`**

```
dist/
node_modules/
```

- [ ] **Step 10: Create `src/shared/types.ts`**

```ts
export type WebsiteType = 'JIRA' | 'GOOGLESHEET' | 'APREELTS' | 'ADP' | null;

export interface StatusMap {
    [statusId: string]: string;
}

export interface RenderOptions {
    isVisible: boolean;
}

export interface JiraIssueFields {
    summary: string;
    status?: { id: string };
    assignee?: { emailAddress: string };
    parent?: { key: string };
}

export interface JiraIssue {
    key: string;
    fields: JiraIssueFields;
    /**
     * Legacy/unused field, kept only to preserve the exact original runtime
     * behavior of buildIssuesSummary (see shared/utils.ts). Always undefined
     * in real Jira API responses — the real parent key lives at
     * `fields.parent.key`. Do not remove without re-checking that call site.
     */
    parentKey?: string;
}
```

- [ ] **Step 11: Verify tooling**

Run:
```bash
npx tsc --noEmit
npx eslint .
npm test
```
Expected: all three succeed (no `.ts` files yet besides `types.ts`, which has no lint violations; existing `tests/utils.test.js` still passes untouched).

- [ ] **Step 12: Commit**

```bash
git add .gitignore package.json package-lock.json babel.config.js tsconfig.json \
  jest.config.js eslint.config.js .prettierrc .prettierignore src/shared/types.ts
git commit -m "chore: add TypeScript/ESLint/Prettier/Vite tooling foundation

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2: Migrate `shared/utils.ts`

**Files:**
- Create: `src/shared/utils.ts`
- Create: `tests/utils.test.ts`
- Delete: `utils.js`
- Delete: `tests/utils.test.js`

**Interfaces:**
- Consumes: `WebsiteType`, `StatusMap`, `JiraIssue` from `src/shared/types.ts` (Task 1).
- Produces: `getMonthStrings(): { current: string; previous: string }`, `buildIssuesSummary(issuesMap: Map<string, JiraIssue[]>, statusMap: StatusMap): string`, `getStatusMap(): StatusMap`, `websiteMatches(url: string): WebsiteType` — every later task that needs these imports from `../shared/utils.js` (TS emits `.js`-extension-free specifiers resolved by the bundler; content-script/site files import via relative path with `.js` extension per NodeNext-style convention used throughout, e.g. `import { getStatusMap } from '../../shared/utils.js'`).

- [ ] **Step 1: Create `src/shared/utils.ts`**

```ts
import type { JiraIssue, StatusMap, WebsiteType } from './types.js';

/** Returns `YYYY-MM` strings for the current month and the month before it (handles year rollover in January). */
export function getMonthStrings(): { current: string; previous: string } {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}-${month}`;

    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    const prevYearMonth = `${prevYear}-${prevMonth}`;

    return { current: yearMonth, previous: prevYearMonth };
}

/** Renders an HTML summary (grouped by date, sorted ascending) of the caller's own in-progress Jira issues. */
export function buildIssuesSummary(issuesMap: Map<string, JiraIssue[]>, statusMap: StatusMap): string {
    let summary = '';
    const sortedEntries = [...issuesMap.entries()].sort(([a], [b]) => a.localeCompare(b));

    for (const [date, issues] of sortedEntries) {
        const myIssues = (issues ?? []).filter(
            (issue) =>
                issue.fields.assignee?.emailAddress === 'piotr.jasina@allegro.com' &&
                getStatusMap()[issue.fields.status?.id ?? ''] !== 'TODO' &&
                getStatusMap()[issue.fields.status?.id ?? ''] !== 'DONE'
        );

        summary += `${date}:<br>`;
        myIssues.forEach((e) => {
            const parentIssue = issues.find((allE) => allE.key === e.fields?.parent?.key);
            let parentSummary = '';
            // Preserved from the original implementation: `e.parentKey` is never
            // populated by real Jira API responses, so this branch is always
            // false and parentSummary stays empty. Kept as-is intentionally —
            // see "Known preserved quirks" in the plan header.
            if (e.parentKey && parentIssue) {
                parentSummary = `(${parentIssue.fields.summary})`;
            }
            summary += `- <a href="https://allegrogroup.atlassian.net/browse/${e.key}" target="_blank">${e.key}</a> ${statusMap[e.fields.status?.id ?? '']} ${e.fields.summary} ${parentSummary}<br>`;
        });
        summary += '<br>';
    }
    return summary;
}

/** Maps Jira status IDs (as used on the HUSKY board) to their display name. */
export function getStatusMap(): StatusMap {
    return {
        '1': 'TODO',
        '10142': 'IN_REVIEW',
        '3': 'IN_PROGRESS',
        '10153': 'TO_TEST',
        '10145': 'IN_TEST',
        '6': 'DONE'
    };
}

/** Classifies a URL into one of the supported site types this extension has per-site UI for, or `null` if unsupported. */
export function websiteMatches(url: string): WebsiteType {
    const urlMappings: Array<{ pattern: string; name: Exclude<WebsiteType, null> }> = [
        { pattern: 'https://allegrogroup.atlassian.net/', name: 'JIRA' },
        { pattern: 'https://docs.google.com/spreadsheets/', name: 'GOOGLESHEET' },
        { pattern: 'https://apreelts.azurewebsites.net/', name: 'APREELTS' },
        { pattern: 'https://console.allegrogroup.com/', name: 'ADP' }
    ];
    const match = urlMappings.find((mapping) => url.startsWith(mapping.pattern));
    return match ? match.name : null;
}
```

- [ ] **Step 2: Create `tests/utils.test.ts`** (same assertions as today, just typed fixtures)

```ts
import { buildIssuesSummary, getMonthStrings, getStatusMap } from '../src/shared/utils.js';
import type { JiraIssue } from '../src/shared/types.js';

describe('Utils', () => {
    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(new Date('2025-11-20'));
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    test('getMonthStrings returns correct current and previous month strings', () => {
        const result = getMonthStrings();
        expect(result.current).toBe('2025-11');
        expect(result.previous).toBe('2025-10');
    });

    test('getMonthStrings handles the January year rollover', () => {
        jest.setSystemTime(new Date('2026-01-15'));
        const result = getMonthStrings();
        expect(result.current).toBe('2026-01');
        expect(result.previous).toBe('2025-12');
        jest.setSystemTime(new Date('2025-11-20'));
    });

    test('getStatusMap returns the correct status mapping', () => {
        const statusMap = getStatusMap();
        expect(statusMap['1']).toBe('TODO');
        expect(statusMap['3']).toBe('IN_PROGRESS');
        expect(statusMap['10142']).toBe('IN_REVIEW');
        expect(statusMap['10153']).toBe('TO_TEST');
        expect(statusMap['10145']).toBe('IN_TEST');
        expect(statusMap['6']).toBe('DONE');
    });

    test('buildIssuesSummary builds correct HTML summary', () => {
        const issuesMap = new Map<string, JiraIssue[]>([
            ['2025-11-20', [
                {
                    key: 'PROJ-123',
                    fields: {
                        status: { id: '10153' },
                        summary: 'Fix bug',
                        assignee: { emailAddress: 'piotr.jasina@allegro.com' }
                    }
                },
                {
                    key: 'PROJ-124',
                    fields: {
                        status: { id: '10142' },
                        summary: 'Add feature',
                        assignee: { emailAddress: 'piotr.jasina@allegro.com' }
                    }
                }
            ]]
        ]);
        const statusMap = getStatusMap();
        const summary = buildIssuesSummary(issuesMap, statusMap);
        expect(summary).toContain('2025-11-20:');
        expect(summary).toContain('<a href="https://allegrogroup.atlassian.net/browse/PROJ-123" target="_blank">PROJ-123</a> TO_TEST Fix bug');
        expect(summary).toContain('<a href="https://allegrogroup.atlassian.net/browse/PROJ-124" target="_blank">PROJ-124</a> IN_REVIEW Add feature');
    });

    test('buildIssuesSummary handles empty issues map', () => {
        const issuesMap = new Map<string, JiraIssue[]>();
        const statusMap = getStatusMap();
        const summary = buildIssuesSummary(issuesMap, statusMap);
        expect(summary).toBe('');
    });
});
```

- [ ] **Step 3: Delete old files**

```bash
rm utils.js tests/utils.test.js
```

- [ ] **Step 4: Run tests, type-check, lint**

Run: `npm test && npx tsc --noEmit && npx eslint .`
Expected: all pass (5 tests now, including the new January rollover case).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: migrate utils.js to TypeScript in src/shared

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: Migrate `content/sites/apreelts.ts` + tests

**Files:**
- Create: `src/content/sites/apreelts.ts`
- Create: `tests/apreelts.test.ts`
- Delete: `src-content/apreelts.js`

**Interfaces:**
- Produces: `setupApreelTs(): void` (default export used by `content/content.ts` in Task 6). Also exports two pure helpers extracted for testability, `computeHoursBackgroundColor(value: string): string` and `CLIENT_ALLEGRO_ID` — both new named exports that did not exist before, introduced purely to make the existing color/client-selection logic unit-testable without touching its call sites' behavior.

- [ ] **Step 1: Create `src/content/sites/apreelts.ts`**

```ts
export const CLIENT_ALLEGRO_ID = '40064';

/**
 * Pure extraction of the "which background color should this hours input
 * have" rule, previously inlined identically in two places
 * (colorizeInputs' updateBg and setAllHoursTo). Behavior is unchanged:
 * "0" -> pink, anything else -> white.
 */
export function computeHoursBackgroundColor(value: string): string {
    return value === '0' ? 'rgb(223 68 226)' : '#ffffff';
}

/** Injects the apreelts.azurewebsites.net helper buttons and wires up the hours-input color feedback. */
export function setupApreelTs(): void {
    createApreelButtons();
    colorizeInputs();
}

function colorizeInputs(): void {
    document.querySelectorAll('td').forEach((td) => {
        if (td.classList.contains('sunday') || td.classList.contains('saturday') || td.classList.contains('vacation')) return;
        td.querySelectorAll<HTMLInputElement>('input[type="text"][title="Godziny pracy"]').forEach((input) => {
            const updateBg = (event: Event) => {
                const target = event.target as HTMLInputElement;
                target.style.backgroundColor = computeHoursBackgroundColor(target.value);
            };
            input.addEventListener('input', updateBg);
            updateBg({ target: input } as unknown as Event);
        });
    });
}

function createApreelButtons(): void {
    const button = document.createElement('button');
    button.textContent = 'All to 8!';
    button.style.position = 'fixed';
    button.style.bottom = '20px';
    button.style.right = '20px';
    button.style.zIndex = '9999';
    button.style.padding = '10px 16px';
    button.style.backgroundColor = '#4CAF50';
    button.style.color = '#fff';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.addEventListener('click', () => {
        setAllHoursTo('8');
        console.log('APREELTS Set all hours');
    });
    document.body.appendChild(button);

    const button2 = document.createElement('button');
    button2.textContent = 'All to 0!';
    button2.style.position = 'fixed';
    button2.style.bottom = '70px';
    button2.style.right = '20px';
    button2.style.zIndex = '9999';
    button2.style.padding = '10px 16px';
    button2.style.backgroundColor = '#4CAF50';
    button2.style.color = '#fff';
    button2.style.border = 'none';
    button2.style.borderRadius = '4px';
    button2.style.cursor = 'pointer';
    button2.addEventListener('click', () => {
        setAllHoursTo('0');
        console.log('APREELTS Set all hours to 0');
    });
    document.body.appendChild(button2);

    const buttonHolders = document.querySelectorAll('.buttonHolder');
    console.log('APREELTS buttonHolders:', buttonHolders);
    const lastButtonHolder = buttonHolders[buttonHolders.length - 1];
    const button3 = document.createElement('button');
    button3.textContent = 'Fill allegro1';
    button3.type = 'button';
    button3.style.padding = '3px 16px';
    button3.style.backgroundColor = '#4CAF50';
    button3.style.color = '#fff';
    button3.style.border = 'none';
    button3.style.borderRadius = '4px';
    button3.style.cursor = 'pointer';
    button3.style.display = 'inline-block';
    if (lastButtonHolder) {
        lastButtonHolder.appendChild(button3);
    }
    button3.addEventListener('click', () => {
        setClientAndHours();
        console.log('APREELTS Set Allegro hours to 8');
    });
}

function setClientAndHours(): void {
    const clientSelect = document.querySelector<HTMLSelectElement>('select.clientsDropDown');
    if (clientSelect) {
        clientSelect.value = CLIENT_ALLEGRO_ID;
        clientSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setAllHoursTo('8');
}

function setAllHoursTo(num: string): void {
    document.querySelectorAll('td').forEach((td) => {
        if (td.classList.contains('sunday') || td.classList.contains('saturday') || td.classList.contains('vacation')) return;

        td.querySelectorAll<HTMLInputElement>('input[type="text"][title="Godziny pracy"]').forEach((input) => {
            input.value = num;
            input.style.backgroundColor = computeHoursBackgroundColor(input.value);
        });
    });
    console.log('APREELTS Set all hours to ', num);
}
```

- [ ] **Step 2: Create `tests/apreelts.test.ts`**

```ts
import { computeHoursBackgroundColor, CLIENT_ALLEGRO_ID } from '../src/content/sites/apreelts.js';

describe('apreelts', () => {
    test('computeHoursBackgroundColor returns pink for "0"', () => {
        expect(computeHoursBackgroundColor('0')).toBe('rgb(223 68 226)');
    });

    test('computeHoursBackgroundColor returns white for any non-zero value', () => {
        expect(computeHoursBackgroundColor('8')).toBe('#ffffff');
        expect(computeHoursBackgroundColor('')).toBe('#ffffff');
    });

    test('CLIENT_ALLEGRO_ID matches the Allegro client select value', () => {
        expect(CLIENT_ALLEGRO_ID).toBe('40064');
    });
});
```

- [ ] **Step 3: Delete old file**

```bash
rm src-content/apreelts.js
```

- [ ] **Step 4: Run tests, type-check, lint**

Run: `npm test && npx tsc --noEmit && npx eslint .`
Expected: all pass (3 new tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: migrate apreelts.js to TypeScript with testable color logic

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: Migrate `content/sites/jira.ts` + tests

**Files:**
- Create: `src/content/sites/jira.ts`
- Create: `tests/jira.test.ts`
- Delete: `src-content/jira.js`

**Interfaces:**
- Consumes: `getStatusMap`, `getMonthStrings` from `src/shared/utils.js` (Task 2).
- Produces: `setupJira(): void`.

- [ ] **Step 1: Create `src/content/sites/jira.ts`**

```ts
import { getStatusMap, getMonthStrings } from '../../shared/utils.js';
import type { JiraIssue } from '../../shared/types.js';

const storeOnlyFirst = false; // change to true to store only once per day

interface JiraSprint {
    id: number;
}

interface JiraSprintResponse {
    values: JiraSprint[];
}

interface JiraIssuesResponse {
    issues: JiraIssue[];
}

/** Fetches the active sprint's issues from the Jira REST API and appends today's snapshot to the per-month history stored in `localStorage`/`chrome.storage.local`. */
export function setupJira(): void {
    fetch(
        'https://allegrogroup.atlassian.net/rest/agile/1.0/board/4992/sprint?state=active',
        { credentials: 'include', headers: { Accept: 'application/json' } }
    )
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
            return res.json() as Promise<JiraSprintResponse>;
        })
        .then((sprintData) => {
            const activeSprint = sprintData.values[0];
            if (!activeSprint) throw new Error('Brak aktywnego sprintu');
            return fetch(
                `https://allegrogroup.atlassian.net/rest/agile/1.0/sprint/${activeSprint.id}/issue?maxResults=100`,
                { credentials: 'include', headers: { Accept: 'application/json' } }
            );
        })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
            return res.json() as Promise<JiraIssuesResponse>;
        })
        .then((data) => {
            console.log('Pobrane dane z Jiry:', JSON.stringify(data));
            console.log('Map status:', JSON.stringify(getStatusMap()));
            const issues = data.issues;

            const { current: yearMonth } = getMonthStrings();

            const stored = localStorage.getItem(`issuesMont-${yearMonth}`);

            let issuesMap: Map<string, JiraIssue[]>;
            if (stored) {
                const parsedArray = JSON.parse(stored) as [string, JiraIssue[]][];
                issuesMap = new Map(parsedArray);
                console.log(`LOGJIRADATA Restored issuesMont-${yearMonth}`, issuesMap);
            } else {
                issuesMap = new Map();
            }
            const currentDate = new Date().toISOString().split('T')[0];
            const existing = issuesMap.get(currentDate);
            if (!storeOnlyFirst || !existing || existing.length === 0) {
                issuesMap.set(currentDate, issues);
                console.log(`Updated issuesMap for ${currentDate}`, JSON.stringify(issues));
            }
            localStorage.setItem(`issuesMont-${yearMonth}`, JSON.stringify(Array.from(issuesMap.entries())));
            chrome.storage.local.set({
                [`issuesMont-${yearMonth}`]: Array.from(issuesMap.entries())
            });
            console.log(`Saved issuesMont-${yearMonth}`, JSON.stringify(Array.from(issuesMap.entries())));
        })
        .catch((err) => console.error('Błąd pobierania danych:', err));
}
```

(The unused `body` template-literal constant from the original file is dropped — it was dead code, never referenced anywhere in `src-content/jira.js`. Confirm via `grep -rn "\bbody\b" src-content/jira.js` before deleting the old file that it was indeed unused, to be safe.)

- [ ] **Step 2: Create `tests/jira.test.ts`**

```ts
import { setupJira } from '../src/content/sites/jira.js';

describe('jira content script', () => {
    const sprintResponse = { values: [{ id: 4242 }] };
    const issuesResponse = {
        issues: [
            { key: 'PROJ-1', fields: { summary: 'Task one', status: { id: '3' } } }
        ]
    };

    beforeEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
        jest.useFakeTimers().setSystemTime(new Date('2025-11-20T10:00:00Z'));

        (global as unknown as { chrome: unknown }).chrome = {
            storage: { local: { set: jest.fn() } }
        };

        global.fetch = jest.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => sprintResponse })
            .mockResolvedValueOnce({ ok: true, json: async () => issuesResponse }) as unknown as typeof fetch;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('stores fetched issues under the current month key in localStorage and chrome.storage.local', async () => {
        setupJira();
        await new Promise(process.nextTick);
        await new Promise(process.nextTick);
        await new Promise(process.nextTick);

        const stored = localStorage.getItem('issuesMont-2025-11');
        expect(stored).not.toBeNull();
        const parsed = JSON.parse(stored as string);
        expect(parsed).toEqual([['2025-11-20', issuesResponse.issues]]);

        const chromeMock = (global as unknown as { chrome: { storage: { local: { set: jest.Mock } } } }).chrome;
        expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
            'issuesMont-2025-11': [['2025-11-20', issuesResponse.issues]]
        });
    });

    test('logs an error and stores nothing when there is no active sprint', async () => {
        (global.fetch as jest.Mock).mockReset();
        (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ values: [] }) });
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        setupJira();
        await new Promise(process.nextTick);
        await new Promise(process.nextTick);

        expect(errorSpy).toHaveBeenCalledWith('Błąd pobierania danych:', expect.any(Error));
        expect(localStorage.getItem('issuesMont-2025-11')).toBeNull();
    });
});
```

- [ ] **Step 3: Delete old file**

```bash
rm src-content/jira.js
```

- [ ] **Step 4: Run tests, type-check, lint**

Run: `npm test && npx tsc --noEmit && npx eslint .`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: migrate jira.js to TypeScript with storage tests

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5: Migrate `content/sites/adp.ts` + tests

**Files:**
- Create: `src/content/sites/adp.ts`
- Create: `tests/adp.test.ts`
- Delete: `src-content/adp.js`

**Interfaces:**
- Consumes: `RenderOptions` from `src/shared/types.ts`.
- Produces: `setupAdp(options: RenderOptions): Promise<void>` (consumed by `content/content.ts` in Task 6). Also exports a new pure helper `findKibanaLink(anchors: { textContent: string | null; href: string }[], env: string): string | undefined`, extracted from the anchor-scanning logic inside `createButton`'s `fetchLink` for direct unit testing — same matching rule (`textContent` must include both `KIBANA` and the env name, case-insensitively), no behavior change at the call site.

- [ ] **Step 1: Create `src/content/sites/adp.ts`**

```ts
import type { RenderOptions } from '../../shared/types.js';

const ELEMENT_PROCESSED_ATTRIBUTE = 'data-deployment-button-created';
const EXT_CLASS = 'boring-stuff-extension';

/**
 * Pure extraction of the "find the Kibana link for this env among the
 * anchors on the page" rule from createButton's fetchLink. Same matching
 * behavior: textContent must contain both "KIBANA" and the env name,
 * case-insensitively.
 */
export function findKibanaLink(
    anchors: Array<{ textContent: string | null; href: string }>,
    env: string
): string | undefined {
    return anchors.find((a) => {
        const text = (a.textContent ?? '').toUpperCase();
        return text.includes('KIBANA') && text.includes(env.toUpperCase());
    })?.href;
}

/** Toggles visibility of already-rendered extension buttons and (re-)creates Kibana/deploy buttons for ADP catalog links, deduplicating via a processed-marker attribute. */
export async function setupAdp(options: RenderOptions): Promise<void> {
    const elements = document.querySelectorAll<HTMLElement>(`.${EXT_CLASS}`);
    elements.forEach((el) => {
        el.style.display = options.isVisible ? 'inline' : 'none';
    });

    async function createButton(env: string, htmlAnchorElement: Element, componentId: string, scale = 1): Promise<void> {
        const getButtonStyles = (scale = 1) => ({
            marginLeft: `${5 * scale}px`,
            padding: `${5 * scale}px ${10 * scale}px`,
            backgroundColor: '#7d00ca',
            color: 'white',
            border: 'none',
            borderRadius: `${4 * scale}px`,
            cursor: 'pointer',
            fontWeight: 'bold',
            display: options.isVisible ? 'inline-flex' : 'none',
            alignItems: 'center',
            gap: `${5 * scale}px`,
            fontSize: `${14 * scale}px`
        });
        const BUTTON_STYLES = getButtonStyles(scale);
        const kibanaBtn = document.createElement('button');
        kibanaBtn.classList.add(EXT_CLASS);
        Object.assign(kibanaBtn.style, BUTTON_STYLES);
        const img = document.createElement('img');
        img.src = chrome.runtime.getURL('favicon-32x32.png');
        img.width = 10 * scale;
        img.height = 10 * scale;
        const label = document.createElement('span');
        label.textContent = env;
        kibanaBtn.append(img, label);

        let kibanaLink: string | undefined;
        function fetchLink(): void {
            const anchors = Array.from(document.querySelectorAll('a'));
            console.log('EXT - looking for Kibana link among anchors:', anchors.map((a) => a.textContent));
            const foundLink = findKibanaLink(anchors, env);

            console.log('EXT - extracted kibanaLink:', foundLink, 'for env:', env, 'componentId:', componentId);
            if (foundLink) {
                kibanaLink = foundLink;
            }
            chrome.storage.local.set({
                [`link-${componentId}-${env}`]: foundLink
            });
        }
        fetchLink();
        setTimeout(() => {
            fetchLink();
        }, 800);
        setTimeout(() => {
            fetchLink();
        }, 2000);

        const storageResult = await chrome.storage.local.get([`link-${componentId}-${env}`]);
        const linkFromStorage: string | undefined = storageResult[`link-${componentId}-${env}`];
        kibanaBtn.onclick = async () => {
            if (kibanaLink || linkFromStorage) {
                window.open(kibanaLink || linkFromStorage, '_blank');
            } else {
                console.error("Nie znaleziono linku 'Kibana - DEV' na tej stronie. Upewnij się, że sekcja Links jest załadowana.");
            }
        };
        if (kibanaLink || linkFromStorage) {
            htmlAnchorElement.parentNode?.insertBefore(kibanaBtn, htmlAnchorElement.nextSibling);
        } else {
            console.error("Nie znaleziono linku 'Kibana - DEV' na tej stronie.");
        }
    }

    async function createDeploymentButton(htmlAnchorElement: Element, componentId: string, scale = 1): Promise<void> {
        const getButtonStyles = (scale = 1.0) => ({
            marginLeft: `${5 * scale}px`,
            padding: `${5 * scale}px ${10 * scale}px`,
            gap: `${5 * scale}px`,
            borderRadius: `${4 * scale}px`,
            backgroundColor: '#0051ca',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: options.isVisible ? 'inline-flex' : 'none',
            alignItems: 'center',
            fontSize: `${14 * scale}px`
        });
        const BUTTON_STYLES = getButtonStyles(scale);
        const dpButton = document.createElement('button');
        dpButton.classList.add(EXT_CLASS);
        Object.assign(dpButton.style, BUTTON_STYLES);
        const icon = document.createElement('span');
        icon.textContent = '🚀';
        icon.style.fontSize = `${9 * scale}px`;
        const label = document.createElement('span');
        label.textContent = ' DEPLOY';
        dpButton.append(icon, label);

        dpButton.onclick = async () => {
            let newPath: string;
            if (document.title.startsWith('opbox-')) {
                newPath = `/catalog/default/component/${componentId}/deployment`;
            } else {
                newPath = `/catalog/default/component/${componentId}/lifecycle/deployment`;
            }
            window.history.pushState({}, '', newPath);
            window.dispatchEvent(new PopStateEvent('popstate'));
        };
        htmlAnchorElement.parentNode?.insertBefore(dpButton, htmlAnchorElement.nextSibling);
    }

    async function setupButtons(htmlAnchorElement: Element, componentId: string, scale = 1): Promise<void> {
        await Promise.all([
            createButton('PROD', htmlAnchorElement, componentId, scale),
            createButton('TEST', htmlAnchorElement, componentId, scale),
            createButton('DEV', htmlAnchorElement, componentId, scale),
            createDeploymentButton(htmlAnchorElement, componentId, scale)
        ]).catch((err) => console.error('Error creating ADP buttons:', err));
    }

    if (window.location.pathname === '/') {
        const anchors = Array.from(document.querySelectorAll('a'));

        const an = anchors.filter((a) => /\/catalog\/default\/component\/(\d+)/.test(a.href));

        for (const linkElement of an) {
            const match = linkElement.href.match(/\/catalog\/default\/component\/(\d+)/);
            const componentId = match?.[1];
            if (!componentId) continue;
            if (linkElement.getAttribute(ELEMENT_PROCESSED_ATTRIBUTE) !== 'true') {
                linkElement.setAttribute(ELEMENT_PROCESSED_ATTRIBUTE, 'true');
                await setupButtons(linkElement, componentId, 0.7).catch((err) => {
                    console.error('Error setting up ADP buttons:', err);
                    linkElement.removeAttribute(ELEMENT_PROCESSED_ATTRIBUTE);
                });
                console.log(`Processed ${linkElement} componentId: ${componentId} ${ELEMENT_PROCESSED_ATTRIBUTE}: ${linkElement.getAttribute(ELEMENT_PROCESSED_ATTRIBUTE)}`);
            }
        }
    } else if (window.location.pathname.match(/component\/(\d+)/)) {
        const match = window.location.pathname.match(/component\/(\d+)/);
        const componentId = match?.[1];
        if (!componentId) return;
        const favoriteBtn = document.getElementById(`favorite-component-default-${componentId}`);
        if (!favoriteBtn) return;
        if (favoriteBtn.getAttribute(ELEMENT_PROCESSED_ATTRIBUTE) !== 'true') {
            favoriteBtn.setAttribute(ELEMENT_PROCESSED_ATTRIBUTE, 'true');
            await setupButtons(favoriteBtn, componentId).catch((err) => {
                console.error('Error setting up ADP buttons:', err);
                favoriteBtn.removeAttribute(ELEMENT_PROCESSED_ATTRIBUTE);
            });
            console.log(`Processed componentId: ${componentId} ${ELEMENT_PROCESSED_ATTRIBUTE}: ${favoriteBtn.getAttribute(ELEMENT_PROCESSED_ATTRIBUTE)}`);
        }
    }
}
```

- [ ] **Step 2: Create `tests/adp.test.ts`**

```ts
import { findKibanaLink } from '../src/content/sites/adp.js';

describe('adp findKibanaLink', () => {
    test('finds the link matching both KIBANA and the env name, case-insensitively', () => {
        const anchors = [
            { textContent: 'Kibana - dev', href: 'https://kibana.dev.example/' },
            { textContent: 'Kibana - prod', href: 'https://kibana.prod.example/' },
            { textContent: 'Grafana', href: 'https://grafana.example/' }
        ];
        expect(findKibanaLink(anchors, 'DEV')).toBe('https://kibana.dev.example/');
        expect(findKibanaLink(anchors, 'PROD')).toBe('https://kibana.prod.example/');
    });

    test('returns undefined when no anchor matches', () => {
        const anchors = [{ textContent: 'Grafana', href: 'https://grafana.example/' }];
        expect(findKibanaLink(anchors, 'DEV')).toBeUndefined();
    });

    test('handles null textContent without throwing', () => {
        const anchors = [{ textContent: null, href: 'https://example/' }];
        expect(findKibanaLink(anchors, 'DEV')).toBeUndefined();
    });
});
```

- [ ] **Step 3: Delete old file**

```bash
rm src-content/adp.js
```

- [ ] **Step 4: Run tests, type-check, lint**

Run: `npm test && npx tsc --noEmit && npx eslint .`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: migrate adp.js to TypeScript with testable Kibana-link lookup

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 6: Migrate `content/content.ts`

**Files:**
- Create: `src/content/content.ts`
- Delete: `content.js`

**Interfaces:**
- Consumes: `websiteMatches` from `../shared/utils.js`, `setupApreelTs` from `./sites/apreelts.js`, `setupJira` from `./sites/jira.js`, `setupAdp` from `./sites/adp.js`, `RenderOptions` from `../shared/types.js`.
- Produces: side-effecting module entry point (no exports needed by later tasks — this is the content-script's runtime entry, referenced directly by `manifest.json` in Task 10).

- [ ] **Step 1: Create `src/content/content.ts`**

```ts
import { websiteMatches } from '../shared/utils.js';
import { setupApreelTs } from './sites/apreelts.js';
import { setupJira } from './sites/jira.js';
import { setupAdp } from './sites/adp.js';
import type { RenderOptions } from '../shared/types.js';

const websiteType = websiteMatches(window.location.href);

console.log(`✅ Loading content js for ${websiteType} ${window.location.href}`);

chrome.storage.local.get('buttonsVisible', (data) => {
    const isVisible = data.buttonsVisible !== false;
    console.log('Buttons visible get:', data.buttonsVisible);
    renderPlugin({ isVisible });
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.buttonsVisible) {
        const isVisible = changes.buttonsVisible.newValue !== false;
        renderPlugin({ isVisible });
        console.log('Buttons visible onChanged:', changes.buttonsVisible.newValue);
    }
});

function renderPlugin(options: RenderOptions): void {
    if (websiteType === 'APREELTS') {
        setupApreelTs();
        console.log('APREELTS script executed');
    }
    if (websiteType === 'JIRA' || websiteType === 'GOOGLESHEET') {
        setupJira();
        console.log('JIRA/GOOGLESHEET script executed');
    }

    let isRunning = false;
    let pending = false;
    const safeSetupAdp = async (options: RenderOptions): Promise<void> => {
        if (isRunning) {
            pending = true;
            return;
        }
        isRunning = true;
        try {
            await setupAdp(options);
        } catch (err) {
            console.error('Error on setupAdp:', err);
        } finally {
            isRunning = false;
            if (pending) {
                pending = false;
                await setupAdp(options);
            }
        }
    };

    if (websiteType === 'ADP') {
        safeSetupAdp(options);
        const observer = new MutationObserver(() => {
            safeSetupAdp(options);
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        console.log('ADP script executed');
    }
    console.log(`✅ Rendered for ${websiteType} ${window.location.href} visibility ${options.isVisible}`);
}

console.log(`✅ Loading js loaded for ${websiteType} ${window.location.href}`);
```

- [ ] **Step 2: Delete old file**

```bash
rm content.js
```

- [ ] **Step 3: Run type-check, lint** (no dedicated unit tests for this module — it is a thin DOM/lifecycle wiring layer with no pure logic to extract, consistent with the spec's testing scope)

Run: `npx tsc --noEmit && npx eslint . && npm test`
Expected: all pass (test count unchanged from Task 5).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: migrate content.js to TypeScript

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 7: Migrate `background/index.ts`

**Files:**
- Create: `src/background/index.ts`
- Delete: `background.js`

**Interfaces:**
- Produces: side-effecting module entry point, referenced directly by `manifest.json` (`background.service_worker`) in Task 10.

- [ ] **Step 1: Create `src/background/index.ts`**

```ts
chrome.runtime.onInstalled.addListener(() => {
    console.log('✅ My MV3 Example Extension installed!');
});

// Odbiór wiadomości z content scriptu
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Sender:', sender);
    console.log('Message:', sender);
    if (message.type === 'BUTTON_CLICKED') {
        console.log('🟢 Przycisk kliknięty na stronie:', sender.url);
        sendResponse({ status: 'OK' });
    }

    if (message.type === 'HELLO_FROM_POPUP') {
        console.log('🟢 Przycisk klikniety na pop-upie:', sender.url);
        sendResponse({ status: 'OK' });
    }
});

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'toggleButtons',
            title: 'Schowaj / Pokaż przyciski w ADP',
            contexts: ['action']
        });
    });

    // Inicjalizacja stanu, jeśli jeszcze nie istnieje
    chrome.storage.local.get(['buttonsVisible'], (result) => {
        if (result.buttonsVisible === undefined) {
            chrome.storage.local.set({ buttonsVisible: true });
        }
    });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId === 'toggleButtons') {
        const data = await chrome.storage.local.get('buttonsVisible');
        const newState = !data.buttonsVisible;
        await chrome.storage.local.set({ buttonsVisible: newState });
    }
});
```

Note: `console.log('Message:', sender)` is preserved exactly (it is the pre-existing logging typo explicitly marked out of scope in the Global Constraints — not fixed here).

- [ ] **Step 2: Delete old file**

```bash
rm background.js
```

- [ ] **Step 3: Run type-check, lint, tests**

Run: `npx tsc --noEmit && npx eslint . && npm test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: migrate background.js to TypeScript

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 8: Migrate `popup/jiraData.ts` + tests

**Files:**
- Create: `src/popup/jiraData.ts`
- Create: `tests/popup-jiraData.test.ts`
- Delete: `popup/jiraData.js`

**Interfaces:**
- Consumes: `getMonthStrings`, `buildIssuesSummary`, `getStatusMap` from `../shared/utils.js`, `JiraIssue` from `../shared/types.js`.
- Produces: `buildJiraSite(): void` (consumed by `popup/popup.ts` in Task 9).

- [ ] **Step 1: Create `src/popup/jiraData.ts`**

```ts
import { getMonthStrings, buildIssuesSummary, getStatusMap } from '../shared/utils.js';
import type { JiraIssue } from '../shared/types.js';

/** Renders the current- and previous-month Jira issue summaries into the popup's `#output` element, reading from `chrome.storage.local`. */
export function buildJiraSite(): void {
    const output = document.getElementById('output') as HTMLElement;
    // For JIRA and GOOGLESHEET
    output.innerHTML += '<br><br>From function...';
    const { current: yearMonth, previous: prevYearMonth } = getMonthStrings();
    const statusMap = getStatusMap();

    let currentMonthSummary = '';
    let prevMonthSummary = '';

    function updateOutput(): void {
        output.innerHTML = currentMonthSummary + prevMonthSummary;
    }

    output.innerHTML += '<br><br>Getting issues...';

    chrome.storage.local.get([`issuesMont-${yearMonth}`], (result) => {
        try {
            console.log('Retrieved data for', `issuesMont-${yearMonth}`, result);
            const parsedArray = result[`issuesMont-${yearMonth}`] as [string, JiraIssue[]][];
            const issuesMap = new Map(parsedArray);
            const summary = buildIssuesSummary(issuesMap, statusMap);
            currentMonthSummary = `<details open><summary><b>Current month ${yearMonth}</b></summary><br>${summary}</details>`;
        } catch (error) {
            console.log('Error retrieving data for', `issuesMont-${yearMonth}`, error);
            currentMonthSummary = `<details open><summary><b>Current month ${yearMonth}</b></summary><br>Error loading data: ${JSON.stringify(error)}<br><br></details>`;
        }
        updateOutput();
    });

    chrome.storage.local.get([`issuesMont-${prevYearMonth}`], (result) => {
        try {
            console.log('Retrieved data for', `issuesMont-${prevYearMonth}`, result);
            const parsedArray = result[`issuesMont-${prevYearMonth}`] as [string, JiraIssue[]][];
            const issuesMap = new Map(parsedArray);
            const summary = buildIssuesSummary(issuesMap, statusMap);
            prevMonthSummary = `<details><summary><b>Prev month ${prevYearMonth}</b></summary><br>${summary}</details>`;
        } catch (error) {
            console.log('Error retrieving data for', `issuesMont-${yearMonth}`, error);
            prevMonthSummary = `<details><summary><b>Prev month ${prevYearMonth}</b></summary><br>Error loading data: ${JSON.stringify(error)}<br><br></details>`;
        }
        updateOutput();
    });
}
```

(The `responsesReceived` counter from the original file is dropped — it was incremented but never read anywhere, so removing it changes nothing observable. `output` is asserted non-null via `as HTMLElement` because `popup.html` always contains the `#output` element that both `popup.ts` and this module rely on today without a null check.)

- [ ] **Step 2: Create `tests/popup-jiraData.test.ts`**

```ts
/**
 * @jest-environment jsdom
 */
import { buildJiraSite } from '../src/popup/jiraData.js';

describe('buildJiraSite', () => {
    beforeEach(() => {
        document.body.innerHTML = '<pre id="output"></pre>';
        (global as unknown as { chrome: unknown }).chrome = {
            storage: {
                local: {
                    get: jest.fn((keys: string[], callback: (result: Record<string, unknown>) => void) => {
                        const key = keys[0];
                        if (key === 'issuesMont-2025-11') {
                            callback({
                                [key]: [
                                    ['2025-11-20', [
                                        { key: 'PROJ-1', fields: { summary: 'Task', status: { id: '3' }, assignee: { emailAddress: 'piotr.jasina@allegro.com' } } }
                                    ]]
                                ]
                            });
                        } else {
                            callback({});
                        }
                    })
                }
            }
        };
        jest.useFakeTimers().setSystemTime(new Date('2025-11-20'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('renders current month details with fetched issues and empty previous month', () => {
        buildJiraSite();
        const output = document.getElementById('output') as HTMLElement;
        expect(output.innerHTML).toContain('Current month 2025-11');
        expect(output.innerHTML).toContain('PROJ-1');
        expect(output.innerHTML).toContain('Prev month 2025-10');
    });
});
```

- [ ] **Step 3: Delete old file**

```bash
rm popup/jiraData.js
```

- [ ] **Step 4: Run tests, type-check, lint**

Run: `npm test && npx tsc --noEmit && npx eslint .`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: migrate popup/jiraData.js to TypeScript with render tests

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 9: Migrate `popup/popup.ts` + `popup/popup.html`

**Files:**
- Create: `src/popup/popup.ts`
- Create: `src/popup/popup.html`
- Delete: `popup/popup.js`
- Delete: `popup/popup.html`

**Interfaces:**
- Consumes: `buildJiraSite` from `./jiraData.js`, `websiteMatches` from `../shared/utils.js`.
- Produces: side-effecting module entry point, referenced by `src/popup/popup.html`'s `<script src="popup.ts" type="module">`, itself referenced from `manifest.json`'s `side_panel.default_path` (wired in Task 10).

- [ ] **Step 1: Create `src/popup/popup.html`** (identical to the current `popup/popup.html`, only the script `src` stays `popup.ts` — Vite resolves the TS entry directly)

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Popup</title>
    <style>
        body {
            font-family: sans-serif;
            width: 500px;
            padding: 10px;
        }
        button {
            background: #4285f4;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
        }
    </style>
</head>
<body>
<pre id="output" style="white-space: pre-wrap; word-wrap: break-word;"></pre>
<script src="popup.ts" type="module"></script>
</body>
</html>
```

- [ ] **Step 2: Create `src/popup/popup.ts`**

```ts
import { buildJiraSite } from './jiraData.js';
import { websiteMatches } from '../shared/utils.js';

const output = document.getElementById('output') as HTMLElement;
output.innerHTML = 'Loading side panel...';

function buildSite(tabId: number): void {
    output.innerHTML = '';
    output.innerHTML += '<br><br>Tab activated...';
    chrome.tabs.get(tabId, (tab) => {
        output.innerHTML += `<br><br>Tab info downloaded ${JSON.stringify(tab, null, 1)}...`;
        console.log('Przełączono na kartę:', tab.url);

        const site = websiteMatches(tab.url ?? '');
        output.innerHTML += `<br><br>Matched website ${site}...`;
        if (site === 'JIRA' || site === 'GOOGLESHEET') {
            output.innerHTML += '<br><br>Jira or google...';
            buildJiraSite();
            return;
        }

        output.innerHTML += `<br><br>Not supported website ${site}`;
    });
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id !== undefined) {
        buildSite(tabs[0].id);
    }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    buildSite(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
        buildSite(tabId);
    }
});
```

(This already includes the `initializePanel` → `buildSite` fix applied in a prior session; `tabs[0]?.id !== undefined` is a type-narrowing-only addition required by strict mode — `chrome.tabs.Tab.id` is `number | undefined` in `@types/chrome`, and the original code already implicitly assumed a defined id.)

- [ ] **Step 3: Delete old files**

```bash
rm popup/popup.js popup/popup.html
```

- [ ] **Step 4: Run type-check, lint, tests**

Run: `npx tsc --noEmit && npx eslint . && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: migrate popup/popup.js and popup.html to TypeScript

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 10: Vite + `@crxjs/vite-plugin` wiring, `manifest.json` update, retire `loader.js`

**Context for this task:** `@crxjs/vite-plugin` auto-generates the small IIFE "loader" shim that dynamically imports a bundled ES-module content script (exactly the pattern `loader.js` implemented by hand today, using `chrome.runtime.getURL` + dynamic `import()`). Because of this, `loader.js` becomes redundant: `manifest.json`'s `content_scripts[0].js` can point directly at `src/content/content.ts`, and the plugin handles the MV3 "content scripts can't be ES modules" restriction for us. `src/content/loader.ts` is intentionally **not** created — `loader.js` is deleted outright. This is a deliberate, beneficial deviation from the original design spec's file tree (which listed a `loader.ts`); it removes a whole file and a manual pattern that the build tool now owns.

**Files:**
- Create: `vite.config.ts`
- Modify: `manifest.json`
- Delete: `loader.js`

**Interfaces:**
- Consumes: `manifest.json` (read by `@crxjs/vite-plugin`), `src/background/index.ts`, `src/content/content.ts`, `src/popup/popup.html` (all produced by Tasks 6, 7, 9).
- Produces: `dist/` build output (consumed by "load unpacked" in Chrome — no other task depends on this programmatically).

- [ ] **Step 1: Update `manifest.json`**

Change these fields (rest of the file unchanged):

```json
{
  "background": {
    "service_worker": "src/background/index.ts"
  },
  "content_scripts": [
    {
      "js": [
        "src/content/content.ts"
      ],
      "matches": [
        "https://allegrogroup.atlassian.net/*",
        "https://github.com/allegro-internal/opbox-web/pull/*",
        "https://apreelts.azurewebsites.net/*",
        "https://docs.google.com/spreadsheets/*",
        "https://console.allegrogroup.com/*"
      ]
    }
  ],
  "side_panel": {
    "default_path": "src/popup/popup.html"
  }
}
```

- [ ] **Step 2: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
    plugins: [crx({ manifest })]
});
```

- [ ] **Step 3: Delete `loader.js`**

```bash
rm loader.js
```

- [ ] **Step 4: Build and verify output**

Run: `npm run build`
Expected: succeeds and produces `dist/manifest.json`, `dist/` copies of the background/content/popup bundles, plus `dist/icon.png` and `dist/favicon-32x32.png`.

Then inspect the generated manifest:
```bash
cat dist/manifest.json
```
Confirm `background.service_worker`, `content_scripts[0].js`, and `side_panel.default_path` all point at real files that exist under `dist/`. If `side_panel.default_path` does not resolve correctly (crxjs support for the `side_panel` manifest key varies by plugin version), add an explicit HTML input for it in `vite.config.ts`:

```ts
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
    plugins: [crx({ manifest })],
    build: {
        rollupOptions: {
            input: {
                popup: resolve(__dirname, 'src/popup/popup.html')
            }
        }
    }
});
```
and re-run `npm run build`, re-checking `dist/manifest.json` until `side_panel.default_path` matches an actual emitted file.

- [ ] **Step 5: Manual smoke check (record result in the commit message body)**

In Chrome, go to `chrome://extensions`, enable Developer mode, "Load unpacked", select `dist/`. Confirm:
- No errors on the extensions page.
- Opening the side panel on any tab shows the popup UI.
- Visiting a JIRA/ADP/APREELTS/Google Sheets URL logs the expected `✅ Loading content js for ...` message in the page console.

- [ ] **Step 6: Run full verification suite**

Run: `npm test && npx tsc --noEmit && npx eslint . && npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "build: wire up Vite + @crxjs/vite-plugin, retire hand-written loader.js

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 11: Delete remaining legacy directories and finalize `.gitignore`/`eslint.config.js`

**Files:**
- Delete: `src-content/` (should already be empty after Tasks 3-5)
- Delete: `popup/` (should already be empty after Tasks 8-9)
- Modify: `eslint.config.js` (tighten now that no legacy `.js` remains)

**Interfaces:** none — cleanup only.

- [ ] **Step 1: Confirm legacy directories are empty and remove them**

```bash
find src-content popup -type f
```
Expected: no output (both directories empty). Then:
```bash
rmdir src-content popup
```

- [ ] **Step 2: Tighten `eslint.config.js`** now that the only remaining `.js` config files are Vite/Jest/ESLint/Prettier/Babel configs at the repo root, which should now also be linted for consistency

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
    { ignores: ['dist/**', 'node_modules/**'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    eslintConfigPrettier,
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            globals: {
                chrome: 'readonly',
                document: 'readonly',
                window: 'readonly',
                console: 'readonly'
            }
        }
    },
    {
        files: ['*.config.js', '*.config.ts'],
        languageOptions: {
            globals: { module: 'readonly', require: 'readonly' }
        }
    }
);
```

- [ ] **Step 3: Run full verification**

Run: `npm test && npx tsc --noEmit && npx eslint . && npm run build`
Expected: all pass with zero lint errors across the whole repo.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove empty legacy directories, lint root config files

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 12: Documentation

**Files:**
- Create: `docs/ARCHITECTURE.md`
- Modify: `README.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Create `docs/ARCHITECTURE.md`**

```markdown
# Architecture

## Layout

```
src/
  background/index.ts   — MV3 service worker: install/context-menu/storage wiring
  content/
    content.ts           — content-script entry: detects the site, renders per-site UI
    sites/
      adp.ts              — ADP (console.allegrogroup.com) Kibana/deploy buttons
      jira.ts             — Jira/Google Sheets sprint-issue fetch + local aggregation
      apreelts.ts         — apreelts.azurewebsites.net timesheet helper buttons
  popup/
    popup.html, popup.ts  — side panel UI entry
    jiraData.ts           — side panel Jira summary renderer
  shared/
    utils.ts              — pure helpers shared across content/popup (website matching,
                             month-string math, Jira issue summary HTML)
    types.ts               — shared TypeScript types
```

## Data flow

- `content.ts` reads `chrome.storage.local.buttonsVisible` on load and on every
  `chrome.storage.onChanged` event, and re-renders the per-site UI accordingly.
- `background/index.ts` owns the `buttonsVisible` toggle: a context-menu click
  flips the stored boolean; every content script reacts independently.
- `content/sites/jira.ts` fetches the active sprint's issues from the Jira REST
  API and stores a `Map<date, issues>` per month (`issuesMont-<yyyy-mm>`) in
  both `localStorage` (same-page cache) and `chrome.storage.local` (read by the
  popup, which has no access to the Jira page's `localStorage`).
- `popup/jiraData.ts` reads `issuesMont-<current>` and `issuesMont-<previous>`
  from `chrome.storage.local` and renders both as collapsible HTML sections.

## Build

`npm run build` runs Vite with `@crxjs/vite-plugin`, which reads `manifest.json`
and produces a Chrome-loadable `dist/` folder, including an auto-generated
ES-module loader shim for the content script (MV3 content scripts cannot be
declared as ES modules directly). Load `dist/` as an unpacked extension in
Chrome for manual testing; there is no dev server for content
scripts/service workers, so use `npm run dev` (watch + rebuild) and manually
click "Reload" on the extension after each change.
```

- [ ] **Step 2: Update `README.md`** — add a "Development" section (append; do not remove any existing content)

```markdown
## Development

- `npm install` — install dependencies
- `npm run build` — build the extension into `dist/`
- `npm run dev` — build in watch mode (reload the unpacked extension in Chrome after each rebuild)
- `npm test` — run the Jest test suite
- `npm run type-check` — run `tsc --noEmit`
- `npm run lint` / `npm run lint:fix` — run ESLint
- `npm run format` — run Prettier

### Loading the extension in Chrome

1. Run `npm run build`.
2. Go to `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` folder (not the repo root).

See `docs/ARCHITECTURE.md` for the directory layout and data flow.
```

- [ ] **Step 3: Commit**

```bash
git add docs/ARCHITECTURE.md README.md
git commit -m "docs: add architecture doc and development instructions

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Final verification (after Task 12)

Run once more, end to end:
```bash
npm test
npx tsc --noEmit
npx eslint .
npm run build
```
All four must succeed with no errors and no legacy `.js` runtime files remaining outside `dist/`, `node_modules/`, and root tooling configs (`babel.config.js`, `eslint.config.js`, `jest.config.js`, `vite.config.ts`, `package.json`).
