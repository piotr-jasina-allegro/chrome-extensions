import { buildIssuesSummary, getMonthStrings, getStatusMap } from '../shared/utils.js';
import type { JiraIssue } from '../shared/types.js';

/** Renders the current- and previous-month Jira issue summaries into the popup's `#output` element. */
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
