import { getRoles, getAllTables, createRoleWithPrivileges, getBusinessUnits, updateRoleWithPrivileges } from "../lib/dataverse";
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

const handleUpdateRole = async (roleId: string, buId: string, privilages: TablePrivileges[]) => {
    console.log(privilages);

    await updateRoleWithPrivileges(roleId, buId, privilages);
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

        case 'UPDATE_ROLE':
            (async () => {
                let privilages = message.privilages as TablePrivileges[];
                let roleId = message.roleId;
                let buId = message.buId;
                const result = await handleUpdateRole(roleId, buId, privilages);
                sendResponse(true);
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