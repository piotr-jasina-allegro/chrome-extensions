import type { JiraIssue, StatusMap, WebsiteType } from './types.js';

/**
 * Returns `YYYY-MM` strings for the current month and the month before it,
 * handling year rollover in January.
 */
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

/**
 * Renders an HTML summary, grouped by date and sorted ascending, of the
 * caller's own in-progress Jira issues.
 */
export function buildIssuesSummary(
    issuesMap: Map<string, JiraIssue[]>,
    statusMap: StatusMap,
): string {
    let summary = '';
    const sortedEntries = [...issuesMap.entries()].sort(([a], [b]) => a.localeCompare(b));

    for (const [date, issues] of sortedEntries) {
        const myIssues = (issues ?? []).filter(
            (issue) =>
                issue.fields.assignee?.emailAddress === 'piotr.jasina@allegro.com' &&
                getStatusMap()[issue.fields.status?.id ?? ''] !== 'TODO' &&
                getStatusMap()[issue.fields.status?.id ?? ''] !== 'DONE',
        );

        summary += `${date}:<br>`;
        myIssues.forEach((issue) => {
            const parentIssue = issues.find(
                (allIssue) => allIssue.key === issue.fields?.parent?.key,
            );
            let parentSummary = '';

            // Preserved from the original implementation: `issue.parentKey` is
            // never populated by real Jira API responses, so this branch stays
            // false and `parentSummary` remains empty.
            if (issue.parentKey && parentIssue) {
                parentSummary = `(${parentIssue.fields.summary})`;
            }

            summary += `- <a href="https://allegrogroup.atlassian.net/browse/${issue.key}" target="_blank">${issue.key}</a> ${statusMap[issue.fields.status?.id ?? '']} ${issue.fields.summary} ${parentSummary}<br>`;
        });
        summary += '<br>';
    }

    return summary;
}

/**
 * Maps Jira status IDs (as used on the HUSKY board) to their display name.
 */
export function getStatusMap(): StatusMap {
    return {
        '1': 'TODO',
        '10142': 'IN_REVIEW',
        '3': 'IN_PROGRESS',
        '10153': 'TO_TEST',
        '10145': 'IN_TEST',
        '6': 'DONE',
    };
}

/**
 * Classifies a URL into one of the supported site types this extension has
 * per-site UI for, or `null` if unsupported.
 */
export function websiteMatches(url: string): WebsiteType {
    const urlMappings: Array<{ pattern: string; name: Exclude<WebsiteType, null> }> = [
        { pattern: 'https://allegrogroup.atlassian.net/', name: 'JIRA' },
        { pattern: 'https://docs.google.com/spreadsheets/', name: 'GOOGLESHEET' },
        { pattern: 'https://apreelts.azurewebsites.net/', name: 'APREELTS' },
        { pattern: 'https://console.allegrogroup.com/', name: 'ADP' },
    ];

    const match = urlMappings.find((mapping) => url.startsWith(mapping.pattern));
    return match ? match.name : null;
}
