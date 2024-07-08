import { getRoles, getAllTables, createRoleWithPrivileges, getBusinessUnits, updateRoleWithPrivileges } from "../lib/dataverse";
import { TablePrivileges } from "../model/TablePrivileges";

console.log('[content] loaded ')

const getTables = async () => {
    let tables = await getAllTables();

    await chrome.storage.local.set({ tables: tables })

    return tables;
}

const handleMessage = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
    debugger
    switch (message.action) {
        case 'GET_TABLES':
            (async () => {
                const result = await getTables();
                sendResponse(result);
            })();

            return true;
        case 'CREATE_ROLE':
            (async () => {
                let privilages = message.privilages as TablePrivileges[];
                let roleName = message.roleName;
                let buId = message.buId;

                try {
                    await createRoleWithPrivileges(roleName, buId, privilages);
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
                sendResponse(true);

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
                const result = await getBusinessUnits();
                sendResponse(result);
            })();

            return true;
        case 'GET_ROLES':
            (async () => {
                let buId = message.buId;
                const result = await getRoles(buId);
                sendResponse(result);
            })();
            return true;
    }
}

chrome.runtime.onMessage.addListener(handleMessage)

export { }