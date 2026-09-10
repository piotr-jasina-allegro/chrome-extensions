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

/** Removes the oldest date entries from a month's issue map, keeping at most `keep` days. */
function pruneOldestDays(issuesMap: Map<string, JiraIssue[]>, keep: number): void {
    const sortedDates = [...issuesMap.keys()].sort();
    for (const date of sortedDates.slice(0, Math.max(0, sortedDates.length - keep))) {
        issuesMap.delete(date);
    }
}

/** Fetches the active sprint's issues from Jira and stores a per-day snapshot in localStorage and chrome.storage.local. */
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
        .then((data) => {
            console.log('Pobrane dane z Jiry:', JSON.stringify(data));
            console.log('Map status:', JSON.stringify(getStatusMap()));
            const issues = data.issues;

            const { current: yearMonth } = getMonthStrings();
            const stored = localStorage.getItem(`issuesMont-${yearMonth}`);

            let issuesMap: Map<string, JiraIssue[]>;
            if (stored) {
                const parsedArray = JSON.parse(stored) as [string, JiraIssue[]][];
                // Re-trim previously stored days too: if a bloated snapshot was
                // written before this trimming was added, keep re-storing it in
                // full would perpetuate the quota problem indefinitely.
                issuesMap = new Map(
                    parsedArray.map(([date, dayIssues]) => [date, dayIssues.map(toStoredIssue)]),
                );
                console.log(`LOGJIRADATA Restored issuesMont-${yearMonth}`, issuesMap);
            } else {
                issuesMap = new Map();
            }

            const currentDate = new Date().toISOString().split('T')[0];
            const existing = issuesMap.get(currentDate);
            if (!storeOnlyFirst || !existing || existing.length === 0) {
                issuesMap.set(currentDate, issues.map(toStoredIssue));
                console.log(`Updated issuesMap for ${currentDate}`, JSON.stringify(issues));
            }

            const persist = (): [string, JiraIssue[]][] => {
                const serialized = Array.from(issuesMap.entries());
                localStorage.setItem(`issuesMont-${yearMonth}`, JSON.stringify(serialized));
                chrome.storage.local.set({
                    [`issuesMont-${yearMonth}`]: serialized,
                });
                return serialized;
            };

            try {
                const serialized = persist();
                console.log(`Saved issuesMont-${yearMonth}`, JSON.stringify(serialized));
            } catch (storageError) {
                if (
                    storageError instanceof DOMException &&
                    storageError.name === 'QuotaExceededError'
                ) {
                    // Even trimmed daily snapshots can add up over a long month; drop the
                    // oldest days and retry once rather than losing today's data entirely.
                    pruneOldestDays(issuesMap, 14);
                    try {
                        const serialized = persist();
                        console.log(
                            `Saved issuesMont-${yearMonth} after pruning older days`,
                            JSON.stringify(serialized),
                        );
                    } catch (retryError) {
                        console.error('Błąd zapisu danych (quota nadal przekroczona):', retryError);
                    }
                } else {
                    throw storageError;
                }
            }
        })
        .catch((err) => console.error('Błąd pobierania danych:', err));
}
