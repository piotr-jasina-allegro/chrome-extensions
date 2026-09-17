import { getMonthStrings, getStatusMap } from '../../shared/utils.js';
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

/**
 * Projects a raw Jira API issue down to only the fields buildIssuesSummary
 * actually reads. Real Jira responses carry many more fields (description,
 * comments, custom fields, etc.); storing them verbatim once per day for a
 * whole month is what exceeds the localStorage/chrome.storage.local quota.
 */
function toStoredIssue(issue: JiraIssue): JiraIssue {
    return {
        key: issue.key,
        fields: {
            summary: issue.fields.summary,
            status: issue.fields.status,
            assignee: issue.fields.assignee,
            parent: issue.fields.parent,
        },
        parentKey: issue.parentKey,
    };
}

/** Returns the `YYYY-MM` string for the month `monthsAgo` months before today. */
function getYearMonthMonthsAgo(monthsAgo: number): string {
    const date = new Date();
    const target = new Date(date.getFullYear(), date.getMonth() - monthsAgo, 1);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * One-time migration: merges any legacy Jira snapshots still sitting in
 * `localStorage` (from before this extension switched to chrome.storage.local)
 * into chrome.storage.local, then removes them from localStorage. Existing
 * chrome.storage.local days win on conflict; days only present in the legacy
 * localStorage copy are added so no previously collected data is lost.
 */
async function migrateLegacyLocalStorageData(): Promise<void> {
    try {
        const legacyKeys: string[] = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (key && key.startsWith('issuesMont-')) {
                legacyKeys.push(key);
            }
        }
        if (legacyKeys.length === 0) {
            return;
        }

        const existing = await chrome.storage.local.get(legacyKeys);
        const updates: Record<string, [string, JiraIssue[]][]> = {};

        for (const key of legacyKeys) {
            const raw = localStorage.getItem(key);
            if (!raw) {
                continue;
            }

            let legacyEntries: [string, JiraIssue[]][];
            try {
                legacyEntries = JSON.parse(raw) as [string, JiraIssue[]][];
            } catch (parseError) {
                console.error(`Nie udało się odczytać legacy ${key} z localStorage:`, parseError);
                continue;
            }

            const merged = new Map<string, JiraIssue[]>(
                (existing[key] as [string, JiraIssue[]][] | undefined) ?? [],
            );
            for (const [date, dayIssues] of legacyEntries) {
                if (!merged.has(date)) {
                    merged.set(date, dayIssues.map(toStoredIssue));
                }
            }
            updates[key] = Array.from(merged.entries());
        }

        if (Object.keys(updates).length > 0) {
            await chrome.storage.local.set(updates);
            console.log(
                'Migrated legacy localStorage Jira data into chrome.storage.local',
                Object.keys(updates),
            );
        }

        for (const key of legacyKeys) {
            localStorage.removeItem(key);
        }
    } catch (migrationError) {
        console.error('Błąd migracji danych z localStorage:', migrationError);
    }
}

/**
 * Deletes `issuesMont-*` keys for months other than the last 3 (current,
 * previous, and the one before that). Without this, every past month stays in
 * chrome.storage.local forever and eventually exceeds the quota.
 */
async function pruneOldMonths(keepYearMonths: readonly string[]): Promise<void> {
    const all = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(all).filter(
        (key) => key.startsWith('issuesMont-') && !keepYearMonths.includes(key),
    );
    if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log('Pruned old month keys', keysToRemove);
    }
}

/** Fetches the active sprint's issues from Jira and stores a per-day snapshot in chrome.storage.local. */
export function setupJira(): void {
    fetch('https://allegrogroup.atlassian.net/rest/agile/1.0/board/4992/sprint?state=active', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    })
        .then((res) => {
            if (!res.ok) {
                throw new Error(`HTTP error: ${res.status}`);
            }

            return res.json() as Promise<JiraSprintResponse>;
        })
        .then((sprintData) => {
            const activeSprint = sprintData.values[0];
            if (!activeSprint) {
                throw new Error('Brak aktywnego sprintu');
            }

            return fetch(
                `https://allegrogroup.atlassian.net/rest/agile/1.0/sprint/${activeSprint.id}/issue?maxResults=100`,
                {
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                },
            );
        })
        .then((res) => {
            if (!res.ok) {
                throw new Error(`HTTP error: ${res.status}`);
            }

            return res.json() as Promise<JiraIssuesResponse>;
        })
        .then(async (data) => {
            console.log('Pobrane dane z Jiry:', JSON.stringify(data));
            console.log('Map status:', JSON.stringify(getStatusMap()));
            const issues = data.issues;

            const { current: yearMonth, previous: prevYearMonth } = getMonthStrings();
            const storageKey = `issuesMont-${yearMonth}`;
            await migrateLegacyLocalStorageData();
            await pruneOldMonths([
                storageKey,
                `issuesMont-${prevYearMonth}`,
                `issuesMont-${getYearMonthMonthsAgo(2)}`,
            ]);

            const stored = (await chrome.storage.local.get(storageKey))[storageKey] as
                | [string, JiraIssue[]][]
                | undefined;

            let issuesMap: Map<string, JiraIssue[]>;
            if (stored) {
                // Re-trim previously stored days too: if a bloated snapshot was
                // written before this trimming was added, keep re-storing it in
                // full would perpetuate the quota problem indefinitely.
                issuesMap = new Map(
                    stored.map(([date, dayIssues]) => [date, dayIssues.map(toStoredIssue)]),
                );
                console.log(`LOGJIRADATA Restored ${storageKey}`, issuesMap);
            } else {
                issuesMap = new Map();
            }

            const currentDate = new Date().toISOString().split('T')[0];
            const existing = issuesMap.get(currentDate);
            if (!storeOnlyFirst || !existing || existing.length === 0) {
                issuesMap.set(currentDate, issues.map(toStoredIssue));
                console.log(`Updated issuesMap for ${currentDate}`, JSON.stringify(issues));
            }

            const persist = (): Promise<void> => {
                const serialized = Array.from(issuesMap.entries());
                return chrome.storage.local.set({ [storageKey]: serialized });
            };

            try {
                await persist();
                console.log(`Saved ${storageKey}`);
            } catch (persistError) {
                console.error('Błąd zapisu danych (quota przekroczona):', persistError);
            }
        })
        .catch((err) => console.error('Błąd pobierania danych:', err));
}
