import { PrivilegeDepth } from "../enum/PrivilegeDepth";
import { PrivilegeName } from "../enum/PrivilegeName";
import { Privilege } from "../model/Privilege";
import { Table } from "../model/Table";
import { TablePrivileges } from "../model/TablePrivileges";

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

        let entity: string = match[1] ? match[1].slice(1) : "";

        let tables = (await chrome.storage.local.get('tables')).tables as Table[] || [];
        let logicalNames = tables.map(t => t.CollectionLogicalName);

        if (!logicalNames.includes(entity)) {
            return;
        }

        console.log("URL: " + details.url);
        console.log(privilage + " - " + entity);

        chrome.storage.local.get('privilages', (result) => {
            let privilages: TablePrivileges[] = result.privilages || [];

            let privilegesForEntity = privilages.filter(p => p.CollectionLogicalName === entity);



            if (privilegesForEntity.length === 0) {
                let privilegesList = ["Create", "Read", "Write", "Delete"];

                privilages.push({
                    CollectionLogicalName: entity,
                    LogicalName: tables.find(t => t.CollectionLogicalName === entity)?.LogicalName || "",
                    Privilages:
                        privilegesList.map(p => {
                            return {
                                name: p as PrivilegeName,
                                depth: p === privilage ? PrivilegeDepth.Organization : PrivilegeDepth.None
                            } as Privilege;
                        }),
                    CollectionName: tables.find(t => t.CollectionLogicalName === entity)?.DisplayName || entity,
                });
            } else {
                let privilege = privilegesForEntity[0].Privilages.find(p => p.name === privilage);

                if (privilege) {
                    privilege.depth = PrivilegeDepth.Organization;
                } else {
                    privilegesForEntity[0].Privilages.push({
                        name: privilage as PrivilegeName,
                        depth: PrivilegeDepth.Organization
                    });
                }
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') { return; }

    chrome.storage.local.get('sessionActive', (result) => {
        let sessionActive = result.sessionActive;

        chrome.action.setBadgeText({ text: sessionActive ? 'REC' : '' });
        chrome.action.setBadgeBackgroundColor({ color: sessionActive ? '#FF0000' : '#000000' });
        chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
    });
});


export { }