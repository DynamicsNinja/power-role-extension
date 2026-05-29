import { getRoles, getAllTables, createRoleWithPrivileges, getBusinessUnits, updateRoleWithPrivileges, getSolutions, addRoleToSolution, getUsers, createTempRole, deleteTempRole, setRolePrivileges, diffRoleWithPrivileges, assignRoleToUser } from "../lib/dataverse";
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
                let assignUserId = message.assignUserId as string;

                try {
                    let roleId = await createRoleWithPrivileges(roleName, buId, privilages);
                    await addRoleToSolution(roleId, solutionName);
                    if (assignUserId) {
                        await assignRoleToUser(assignUserId, roleId);
                    }
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
        case 'GET_ROLE_DIFF':
            (async () => {
                try {
                    sendResponse(await diffRoleWithPrivileges(message.roleId, message.privilages));
                } catch (e: any) {
                    sendResponse({ error: e.message });
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
        case 'GET_USERS':
            (async () => {
                try {
                    sendResponse(await getUsers());
                } catch {
                    sendResponse([]);
                }
            })();
            return true;
        case 'CREATE_TEMP_ROLE':
            (async () => {
                try {
                    sendResponse(await createTempRole(message.userId));
                } catch (e: any) {
                    sendResponse({ error: e.message });
                }
            })();
            return true;
        case 'DELETE_TEMP_ROLE':
            (async () => {
                try {
                    await deleteTempRole(message.userId, message.roleId);
                    sendResponse({ error: "" });
                } catch (e: any) {
                    sendResponse({ error: e.message });
                }
            })();
            return true;
    }
}

chrome.runtime.onMessage.addListener(handleMessage)

// Bridge between the injected (MAIN-world) interceptor and the background
// recorder. Pushes config (recording state + impersonation user) down to the
// interceptor and relays captured calls up to the background.
let recordingActive = false;

const postConfig = () => {
    chrome.storage.local.get(['sessionActive', 'impersonateUserId'], (result) => {
        recordingActive = !!result.sessionActive;
        window.postMessage({
            __powerRolesConfig: true,
            recording: !!result.sessionActive,
            impersonateUserId: result.impersonateUserId || ''
        }, '*');
    });
};

postConfig();

// Live "temp role" build: when privileges are recorded during a session that has
// a temp role, push the current set onto the role (debounced) so the impersonated
// user is unblocked and can keep clicking through.
let tempSyncTimer: ReturnType<typeof setTimeout> | undefined;

const syncTempRole = async () => {
    const state = await chrome.storage.local.get(['tempRoleId', 'tempRoleBuId', 'sessionActive', 'privilages']);
    if (!state.sessionActive || !state.tempRoleId) { return; }

    // Surface a passive "granting privileges" indicator in the panel. This is
    // only a status flag — the user can keep clicking through while it runs.
    await chrome.storage.local.set({ tempRoleSyncing: true });
    try {
        await setRolePrivileges(state.tempRoleId, state.tempRoleBuId, state.privilages || []);
        console.log('[PowerRoles] temp role synced:', (state.privilages || []).length, 'tables');
    } catch (e) {
        console.warn('[PowerRoles] temp role sync failed', e);
    } finally {
        await chrome.storage.local.set({ tempRoleSyncing: false });
    }
};

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') { return; }

    if (changes.sessionActive || changes.impersonateUserId) {
        postConfig();
    }

    if (changes.privilages) {
        if (tempSyncTimer) { clearTimeout(tempSyncTimer); }
        tempSyncTimer = setTimeout(syncTempRole, 1500);
    }
});

window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) { return; }

    const data = event.data;
    if (!data || data.__powerRoles !== true) { return; }
    if (!recordingActive) { return; }

    if (data.kind === 'request') {
        chrome.runtime.sendMessage({
            action: 'RECORD_REQUEST',
            method: data.method,
            url: data.url,
            body: data.body
        });
    } else if (data.kind === 'response') {
        chrome.runtime.sendMessage({
            action: 'RECORD_RESPONSE',
            method: data.method,
            url: data.url,
            status: data.status,
            body: data.body
        });
    }
});

export { }
