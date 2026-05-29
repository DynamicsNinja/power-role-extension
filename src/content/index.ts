import { getRoles, getAllTables, createRoleWithPrivileges, getBusinessUnits, updateRoleWithPrivileges, getSolutions, addRoleToSolution } from "../lib/dataverse";
import { TablePrivileges } from "../model/TablePrivileges";

const getTables = async () => {
    let tables = await getAllTables();

    await chrome.storage.local.set({ tables: tables })

    return tables;
}

const handleMessage = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
    switch (message.action) {
        case 'GET_TABLES':
            (async () => {
                try {
                    sendResponse(await getTables());
                } catch {
                    sendResponse([]);
                }
            })();

            return true;
        case 'CREATE_ROLE':
            (async () => {
                let privilages = message.privilages as TablePrivileges[];
                let roleName = message.roleName;
                let buId = message.buId;
                let solutionName = message.solutionName;

                try {
                    let roleId = await createRoleWithPrivileges(roleName, buId, privilages);
                    await addRoleToSolution(roleId, solutionName);
                    sendResponse({
                        error: ""
                    });
                } catch (e: any) {
                    sendResponse({
                        error: e.message
                    });
                }
            })();

            return true;

        case 'UPDATE_ROLE':
            (async () => {
                let privilages = message.privilages as TablePrivileges[];
                let roleId = message.roleId;
                let buId = message.buId;

                try {
                    await updateRoleWithPrivileges(roleId, buId, privilages);
                    sendResponse({
                        error: ""
                    });
                } catch (e: any) {
                    sendResponse({
                        error: e.message
                    });
                }
            })();

            return true;

        case 'GET_BUSINESS_UNITS':
            (async () => {
                try {
                    sendResponse(await getBusinessUnits());
                } catch {
                    sendResponse([]);
                }
            })();

            return true;
        case 'GET_ROLES':
            (async () => {
                try {
                    sendResponse(await getRoles(message.buId));
                } catch {
                    sendResponse([]);
                }
            })();
            return true;
        case 'GET_SOLUTIONS':
            (async () => {
                try {
                    sendResponse(await getSolutions());
                } catch {
                    sendResponse([]);
                }
            })();
            return true;
    }
}

chrome.runtime.onMessage.addListener(handleMessage)

// Relay Dataverse calls captured by the injected (MAIN-world) interceptor to the
// background recorder, but only while a recording session is active.
let recordingActive = false;

chrome.storage.local.get('sessionActive', (result) => {
    recordingActive = !!result.sessionActive;
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.sessionActive) {
        recordingActive = !!changes.sessionActive.newValue;
    }
});

window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) { return; }

    const data = event.data;
    if (!data || data.__powerRoles !== true) { return; }
    if (!recordingActive) { return; }

    chrome.runtime.sendMessage({
        action: 'RECORD_REQUEST',
        method: data.method,
        url: data.url,
        body: data.body
    });
});

export { }
