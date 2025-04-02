// import {buildJiraSite} from "./jiraData";
//
import { buildJiraSite } from "./jiraData.js";
import { websiteMatches } from "../utils.js";

const output = document.getElementById("output");
output.innerHTML = 'Loading side panel...';

function buildSite(tabId) {
    output.innerHTML = '';
    output.innerHTML += '<br><br>Tab activated...';
    chrome.tabs.get(tabId, (tab) => {
        output.innerHTML += `<br><br>Tab info downloaded ${JSON.stringify(tab, null, 1)}...`;
        console.log("Przełączono na kartę:", tab.url);

        const site = websiteMatches(tab.url);
        output.innerHTML += `<br><br>Matched website ${site}...`;
        if (site === 'JIRA' || site === 'GOOGLESHEET') {
            output.innerHTML += '<br><br>Jira or google...';
            buildJiraSite()
            return;
        }

        output.innerHTML += `<br><br>Not supported website ${site}`;
    });
}

chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    buildSite(tabs[0].id);
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    buildSite(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        initializePanel(tabId);
    }
});