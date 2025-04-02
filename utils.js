// utils.js - Utility functions for the extension

export function getMonthStrings() {
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

export function buildIssuesSummary(issuesMap, statusMap) {
    let summary = '';
    const sortedEntries = [...issuesMap.entries()].sort(([a], [b]) => a.localeCompare(b));

    for (const [date, issues] of sortedEntries) {
        const my_issues = issues?.filter(issue => issue.fields.assignee?.emailAddress === "piotr.jasina@allegro.com" && getStatusMap()[issue.fields.status?.id] !== "TODO" && getStatusMap()[issue.fields.status?.id] !== "DONE");

        summary += `${date}:<br>`;
        my_issues.map(e => {
            const parent_issue = issues.find(all_e => all_e.key === e.fields?.parent?.key);
            var parentSummary = '';
            if(e.parentKey && parent_issue) {
                parentSummary = `(${parent_issue.fields.summary})`
            }
            summary += `- <a href="https://allegrogroup.atlassian.net/browse/${e.key}" target="_blank">${e.key}</a> ${statusMap[e.fields.status?.id]} ${e.fields.summary} ${parentSummary}<br>`
        });
        summary += '<br>';
    }
    return summary;
}

export function getStatusMap() {
    return {
        "1": "TODO",
        "10142": "IN_REVIEW",
        "3": "IN_PROGRESS",
        "10153": "TO_TEST",
        "10145": "IN_TEST",
        "6": "DONE"
    };
}

export function websiteMatches(url) {
    const urlMappings = [{
        pattern: "https://allegrogroup.atlassian.net/",
        name: "JIRA"
    }, {
        pattern: "https://docs.google.com/spreadsheets/",
        name: "GOOGLESHEET"
    },
        {pattern: "https://apreelts.azurewebsites.net/", name: "APREELTS"},
        {pattern: "https://console.allegrogroup.com/", name: "ADP"}
    ];
    const match = urlMappings.find(mapping => url.startsWith(mapping.pattern));
    return match ? match.name : null;
}