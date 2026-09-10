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

            const serialized = Array.from(issuesMap.entries());
            localStorage.setItem(`issuesMont-${yearMonth}`, JSON.stringify(serialized));
            chrome.storage.local.set({
                [`issuesMont-${yearMonth}`]: serialized,
            });
            console.log(`Saved issuesMont-${yearMonth}`, JSON.stringify(serialized));
        })
        .catch((err) => console.error('Błąd pobierania danych:', err));
}
