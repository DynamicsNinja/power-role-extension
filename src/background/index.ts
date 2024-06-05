import { Table } from "../model/Table";

const handleResponse = (details: chrome.webRequest.WebRequestBodyDetails): void | chrome.webRequest.BlockingResponse => {
    // get  sessionActive from storage 
    chrome.storage.local.get('sessionActive', async (result) => {
        if (!result.sessionActive) { return; }

        var privilage = "";

        switch (details.method) {
            case "GET":
                privilage = "Read";
                break;
            case "POST":
                privilage = "Create";
                break;
            case "PATCH":
                privilage = "Write";
                break;
            case "DELETE":
                privilage = "Delete";
                break;
            default:
                break;
        }

        const regex = /\/v[\d.]+(\/[\w]*)?/i;
        const match = details.url.match(regex);

        if (!match) {
            return;
        }

        let entity = match[1] ? match[1].slice(1) : "";

        let tables = (await chrome.storage.local.get('tables')).tables as Table[] || [];
        let logicalNames = tables.map(t => t.CollectionLogicalName);

        if (!logicalNames.includes(entity)) {
            return;
        }

        console.log("URL: " + details.url);
        console.log(privilage + " - " + entity);

        // get logged privilages from storage
        chrome.storage.local.get('privilages', (result) => {
            let privilages = result.privilages || {};

            if (!privilages[entity]) {
                privilages[entity] = [];
            }

            if (!privilages[entity].includes(privilage)) {
                privilages[entity].push(privilage);
            }

            // save privilages to storage
            chrome.storage.local.set({ privilages: privilages });
        });

    });
}

chrome.webRequest.onBeforeRequest.addListener(
    handleResponse,
    { urls: ["*://*.dynamics.com/api/data/v*"] }
);


export { }