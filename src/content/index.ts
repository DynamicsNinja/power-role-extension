import { getAllTables, createRole, createRoleWithPrivileges, getBusinessUnits } from "../lib/dataverse";
import { TablePrivileges } from "../model/TablePrivileges";

console.log('[content] loaded ')

const getTables = async () => {
    let tables = await getAllTables();

    await chrome.storage.local.set({ tables: tables })

    return tables;
}

const handleCreateRole = async (roleName: string, buId: string, privilages: TablePrivileges[]) => {
    console.log(privilages);

    await createRoleWithPrivileges(roleName, buId, privilages);
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
                const result = await handleCreateRole(roleName, buId, privilages);
                sendResponse(true);
            })();

            return true;

        case 'GET_BUSINESS_UNITS':
            (async () => {
                const result = await getBusinessUnits();
                sendResponse(result);
            })();
            
            return true;	
    }
}

chrome.runtime.onMessage.addListener(handleMessage)

export { }