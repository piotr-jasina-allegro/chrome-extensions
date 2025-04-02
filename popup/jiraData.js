
import { getMonthStrings, buildIssuesSummary, getStatusMap } from "../utils.js";

export function buildJiraSite() {
    const output = document.getElementById("output");
    // For JIRA and GOOGLESHEET
    output.innerHTML += '<br><br>From function...';
    const {current: yearMonth, previous: prevYearMonth} = getMonthStrings();
    const statusMap = getStatusMap();

    let currentMonthSummary = '';
    let prevMonthSummary = '';
    let responsesReceived = 0;

    function updateOutput() {
        output.innerHTML = currentMonthSummary + prevMonthSummary;
    }

    output.innerHTML += `<br><br>Getting issues...`;

    chrome.storage.local.get([`issuesMont-${yearMonth}`], (result) => {
        try {
            console.log('Retrieved data for', `issuesMont-${yearMonth}`, result);
            const parsedArray = result[`issuesMont-${yearMonth}`];
            const issuesMap = new Map(parsedArray);
            const summary = buildIssuesSummary(issuesMap, statusMap);
            currentMonthSummary = `<details open><summary><b>Current month ${yearMonth}</b></summary><br>${summary}</details>`;
        } catch (error) {
            console.log('Error retrieving data for', `issuesMont-${yearMonth}`, error);
            currentMonthSummary = `<details open><summary><b>Current month ${yearMonth}</b></summary><br>Error loading data: ${JSON.stringify(error)}<br><br></details>`;
        }
        responsesReceived++;
        updateOutput();
    });

    chrome.storage.local.get([`issuesMont-${prevYearMonth}`], (result) => {
        try {
            console.log('Retrieved data for', `issuesMont-${prevYearMonth}`, result);
            const parsedArray = result[`issuesMont-${prevYearMonth}`];
            const issuesMap = new Map(parsedArray);
            const summary = buildIssuesSummary(issuesMap, statusMap);
            prevMonthSummary = `<details><summary><b>Prev month ${prevYearMonth}</b></summary><br>${summary}</details>`;
        } catch (error) {
            console.log('Error retrieving data for', `issuesMont-${yearMonth}`, error);
            prevMonthSummary = `<details><summary><b>Prev month ${prevYearMonth}</b></summary><br>Error loading data: ${JSON.stringify(error)}<br><br></details>`;
        }
        responsesReceived++;
        updateOutput();
    });
}