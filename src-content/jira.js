import {getStatusMap, getMonthStrings} from "../utils.js";

const storeOnlyFirst = false // change to true to store only once per day

const body = `{"operationName":"Nav4ProjectsContentQuery","variables":{"cloudId":"939af745-ffb9-4215-a0f3-8f345327e1b0","currentURL":"http://example.com/jira/software/c/projects/HUSKY/boards/4992/?","__relay_internal__pv__atlassianjirarelayprovidersrcatlasprojectnativeintegrationm2relayprovider":false,"__relay_internal__pv__atlassianjirarelayprovidersrcjsmaiiyfornavitemsidebarrelayprovider":true}}`

export function setupJira() {
    fetch(
        `https://allegrogroup.atlassian.net/rest/agile/1.0/board/4992/sprint?state=active`,
        {credentials: "include", headers: {"Accept": "application/json"}}
    )
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
            return res.json();
        })
        .then(sprintData => {
            const activeSprint = sprintData.values[0];
            if (!activeSprint) throw new Error("Brak aktywnego sprintu");
            return fetch(
                `https://allegrogroup.atlassian.net/rest/agile/1.0/sprint/${activeSprint.id}/issue?maxResults=100`,
                {credentials: "include", headers: {"Accept": "application/json"}}
            );
        })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
            return res.json();
        })
        .then(data => {
            console.log("Pobrane dane z Jiry:", JSON.stringify(data));
            console.log("Map status:", JSON.stringify(getStatusMap()));
            const issues = data.issues

            const {current: yearMonth} = getMonthStrings();

            const stored = localStorage.getItem(`issuesMont-${yearMonth}`);

            var issuesMap;
            if (stored) {
                const parsedArray = JSON.parse(stored);
                issuesMap = new Map(parsedArray);
                console.log(`LOGJIRADATA Restored issuesMont-${yearMonth}`, issuesMap);
            } else {
                issuesMap = new Map();
            }
            const currentDate = new Date().toISOString().split('T')[0];
            if (!storeOnlyFirst || !issuesMap.get(currentDate) || issuesMap.get(currentDate).length === 0) {
                issuesMap.set(currentDate, issues);
                console.log(`Updated issuesMap for ${currentDate}`, JSON.stringify(issues));
            }
            localStorage.setItem(`issuesMont-${yearMonth}`, JSON.stringify(Array.from(issuesMap.entries())));
            chrome.storage.local.set({
                [`issuesMont-${yearMonth}`]: Array.from(issuesMap.entries())
            });
            console.log(`Saved issuesMont-${yearMonth}`, JSON.stringify(Array.from(issuesMap.entries())));
        })
        .catch(err => console.error("Błąd pobierania danych:", err));
}