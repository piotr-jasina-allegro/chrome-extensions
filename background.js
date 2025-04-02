chrome.runtime.onInstalled.addListener(() => {
    console.log("✅ My MV3 Example Extension installed!");
});

// Odbiór wiadomości z content scriptu
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Sender:", sender);
    console.log("Message:", sender);
    if (message.type === "BUTTON_CLICKED") {
        console.log("🟢 Przycisk kliknięty na stronie:", sender.url);
        sendResponse({ status: "OK" });
    }

    if (message.type === "HELLO_FROM_POPUP") {
        console.log("🟢 Przycisk klikniety na pop-upie:", sender.url);
        sendResponse({ status: "OK" });
    }
});

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "toggleButtons",
            title: "Schowaj / Pokaż przyciski w ADP",
            contexts: ["action"]
        });
    });

    // Inicjalizacja stanu, jeśli jeszcze nie istnieje
    chrome.storage.local.get(["buttonsVisible"], (result) => {
        if (result.buttonsVisible === undefined) {
            chrome.storage.local.set({ buttonsVisible: true });
        }
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "toggleButtons") {
        const data = await chrome.storage.local.get("buttonsVisible");
        const newState = !data.buttonsVisible;
        await chrome.storage.local.set({ buttonsVisible: newState });
    }
});