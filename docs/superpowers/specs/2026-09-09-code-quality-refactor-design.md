# Refaktoryzacja projektu do wysokich standardów kodu

Data: 2026-09-09
Status: zaakceptowany przez właściciela repo

## Cel

Podnieść jakość istniejącej bazy kodu rozszerzenia Chrome ("Boring Stuff
Helper") bez zmiany jego zachowania funkcjonalnego:

- konwersja do TypeScript,
- wprowadzenie ESLint + Prettier,
- reorganizacja struktury katalogów do `src/`,
- rozszerzenie pokrycia testami (jira, adp, apreelts, popup),
- dokumentacja architektury.

## Poza zakresem

- Naprawa pozostałych błędów średniej pewności zidentyfikowanych wcześniej
  (wyciek `MutationObserver` w `content.js`, wyścig w `safeSetupAdp`,
  literówka w logu `background.js`, brak mapowania URL GitHuba w
  `websiteMatches`). Świadomie pominięte na życzenie właściciela — do
  osobnego zadania.
- CI (GitHub Actions) — nie wybrane w zakresie.
- Jakiekolwiek zmiany zachowania rozszerzenia — to czysty refaktor.

## Decyzje architektoniczne

| Decyzja | Wybór | Uzasadnienie |
|---|---|---|
| Bundler | Vite + `@crxjs/vite-plugin` | Wsparcie dla MV3 (osobne wejścia: background/content/popup), HMR w dev, akceptowalna złożoność konfiguracji |
| Wynik budowania | `dist/` niecommitowany (`.gitignore`) | Standard dla projektów z krokiem budowania; unpacked extension ładowany z `dist/` |
| TypeScript | `strict: true`, `@types/chrome` | Najwyższy poziom bezpieczeństwa typów przy rozsądnym nakładzie pracy |
| ESLint | `eslint:recommended` + `@typescript-eslint/recommended` + `eslint-config-prettier` | Lekki, standardowy zestaw reguł bez narzucania stylu sprzecznego z Prettier |
| Testy | Babel + Jest (istniejąca konfiguracja rozszerzona o preset TS) | Uniknięcie dodatkowej zależności (`ts-jest`), spójność z obecnym `babel.config.js` |
| Struktura katalogów | `src/background`, `src/content` (+ `sites/`), `src/popup`, `src/shared` | Podział wg granic uruchomieniowych rozszerzenia (service worker / content script / popup) + współdzielony kod domenowy |

## Docelowa struktura katalogów

```
src/
  background/
    index.ts                 # z background.js
  content/
    loader.ts                 # z loader.js
    content.ts                 # z content.js (renderPlugin, safeSetupAdp)
    sites/
      adp.ts                   # z src-content/adp.js
      jira.ts                  # z src-content/jira.js
      apreelts.ts              # z src-content/apreelts.js
  popup/
    popup.html
    popup.ts                   # z popup/popup.js
    jiraData.ts                 # z popup/jiraData.js
  shared/
    utils.ts                    # z utils.js
    types.ts                    # nowe typy domenowe

tests/
  utils.test.ts
  jira.test.ts                  # nowy
  adp.test.ts                   # nowy
  popup.test.ts                  # nowy (jiraData/buildJiraSite)

docs/
  ARCHITECTURE.md               # nowy

manifest.json                   # zaktualizowane referencje na src/*.ts (czytane przez @crxjs/vite-plugin)
vite.config.ts                  # nowy
tsconfig.json                   # nowy
.eslintrc.cjs / eslint.config.js
.prettierrc
.gitignore                      # + dist/
```

Stare pliki root-level (`background.js`, `content.js`, `loader.js`,
`utils.js`) oraz `src-content/*`, `popup/popup.js`, `popup/jiraData.js`
zostają usunięte po zakończeniu migracji odpowiadających im modułów.

## Typy domenowe (`src/shared/types.ts`)

- `WebsiteType = 'JIRA' | 'GOOGLESHEET' | 'APREELTS' | 'ADP' | null`
- `JiraIssueFields`, `JiraIssue` (na podstawie realnego kształtu danych
  używanego w `buildIssuesSummary`)
- `StatusMap = Record<string, string>`
- `RenderOptions = { isVisible: boolean }`

Typy powstają na podstawie **obecnego** kształtu danych używanego w kodzie
(bez spekulacji o polach, których kod nie odczytuje).

## Build (Vite)

- Wejścia: `src/background/index.ts` (service worker), `src/content/loader.ts`
  (jedyny plik wpisany w `content_scripts` w manifeście — zachowuje obecny
  wzorzec dynamicznego `import()` do `content.ts`), `src/popup/popup.html`.
- `@crxjs/vite-plugin` odczytuje `manifest.json` z katalogu głównego i
  generuje poprawiony manifest w `dist/` z przemapowanymi ścieżkami na
  zbudowane pliki.
- Skrypty npm:
  - `npm run build` — build produkcyjny do `dist/`
  - `npm run dev` — watch mode (przeładowanie unpacked extension ręczne,
    zgodnie z ograniczeniami MV3)
  - `npm test` — bez zmian (Jest)
  - `npm run lint` / `npm run lint:fix`
  - `npm run format`

## Migracja logiki — zasady

1. **Zero zmian zachowania.** Każdy plik migrowany 1:1 z dodaniem typów;
   jeśli TypeScript wymusi obsługę przypadku brzegowego (np. `null`/`undefined`),
   dodajemy tylko minimalny, bezpieczny guard bez zmiany ścieżki normalnej.
2. **Wydzielanie czystej logiki do testów.** Tam, gdzie funkcja miesza
   manipulację DOM z logiką biznesową (np. wyszukiwanie linku Kibana w
   `adp.ts`, budowanie podsumowania w `jiraData.ts`), wydzielamy czystą
   funkcję pomocniczą do osobnego, testowalnego eksportu — bez zmiany
   zewnętrznego zachowania modułu.
3. **Kolejność migracji** (od najmniej do najbardziej zależnego, żeby
   każdy krok dało się zweryfikować testami w izolacji):
   `shared/utils.ts` → `content/sites/apreelts.ts` → `content/sites/jira.ts`
   → `content/sites/adp.ts` → `content/content.ts` → `content/loader.ts`
   → `background/index.ts` → `popup/jiraData.ts` → `popup/popup.ts`.

## Testy — zakres rozszerzenia

- `utils.test.ts`: migracja istniejących 4 testów bez zmian w asercjach.
- `jira.test.ts`: testy dla logiki agregacji miesięcznej (bez sieci —
  `fetch` i `chrome.storage` mockowane), w tym poprawnie działający
  scenariusz przełomu roku (styczeń) korzystający z już naprawionego
  `getMonthStrings`.
- `adp.test.ts`: testy dla czystej funkcji wykrywania linku Kibana z listy
  zamockowanych elementów `<a>` (bez pełnego DOM-renderowania przycisków).
- `popup.test.ts`: testy dla `buildIssuesSummary`/`buildJiraSite` (już
  częściowo pokryte przez `utils.test.ts`; tu dodajemy przypadek złożenia
  bieżącego i poprzedniego miesiąca w HTML popupu).
- Środowisko testowe: `jest-environment-jsdom` (już w `devDependencies`) —
  używane tam, gdzie potrzebny jest dostęp do `document`.

## Dokumentacja

- `docs/ARCHITECTURE.md`: diagram katalogów, opis przepływu
  background↔content↔popup, opis `chrome.storage.local` jako źródła
  prawdy między content scriptem a popupem.
- `README.md`: zaktualizowana sekcja "Development" z komendami
  `build`/`dev`/`test`/`lint`/`format` i instrukcją ładowania `dist/`
  jako unpacked extension.
- TSDoc na eksportowanych funkcjach w `shared/utils.ts` oraz modułach
  `content/sites/*.ts`.

## Ryzyko i uwagi wdrożeniowe

- Wprowadzenie kroku budowania zmienia sposób ładowania rozszerzenia w
  Chrome (unpacked z `dist/`, nie z katalogu głównego repo) — wymaga
  jednorazowej zmiany procedury deweloperskiej, udokumentowanej w README.
- Zakres jest świadomie ograniczony do refaktoryzacji — błędy średniej
  pewności i CI pozostają nietknięte (patrz sekcja "Poza zakresem").
- Migracja wykonywana plik po pliku z uruchomieniem `npm test` i
  `npm run lint` po każdym kroku, aby błąd był łatwy do zlokalizowania.
