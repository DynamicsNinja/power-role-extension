import { PrivilegeDepth } from "../enum/PrivilegeDepth";
import { PrivilegeName } from "../enum/PrivilegeName";
import { Table } from "../model/Table";
import { TablePrivileges } from "../model/TablePrivileges";

// Canonical column order. Entries are always created with this full set so the
// popup table columns stay aligned.
const ALL_PRIVILEGES = [
    PrivilegeName.Create,
    PrivilegeName.Read,
    PrivilegeName.Write,
    PrivilegeName.Delete,
    PrivilegeName.Append,
    PrivilegeName.AppendTo,
    PrivilegeName.Assign,
];

interface PrivilegeUpdate {
    entity: string;
    privilege: PrivilegeName;
}

interface CapturedRequest {
    method: string;
    url: string;
    body: string | null;
}

// Serialize storage read-modify-write so concurrent requests can't clobber each
// other's recorded privileges (lost-update race).
let writeChain: Promise<void> = Promise.resolve();

function enqueueWrite(task: () => Promise<void>): Promise<void> {
    writeChain = writeChain.then(task).catch(() => { });
    return writeChain;
}

function crudPrivilege(method: string): PrivilegeName | null {
    switch (method) {
        case "GET":
            return PrivilegeName.Read;
        case "POST":
            return PrivilegeName.Create;
        case "PATCH":
            return PrivilegeName.Write;
        case "DELETE":
            return PrivilegeName.Delete;
        default:
            return null;
    }
}

function apiPath(url: string): string | null {
    const m = url.match(/\/api\/data\/v[\d.]+\/(.+)$/i);
    if (!m) {
        return null;
    }
    return m[1].split('?')[0];
}

function leadingCollection(path: string): string | null {
    const m = path.match(/^([a-zA-Z][\w]*)/);
    return m ? m[1] : null;
}

function isAssociation(path: string): boolean {
    return path.endsWith('$ref');
}

function isBatch(path: string): boolean {
    return path === '$batch' || path.endsWith('/$batch');
}

// Extracts the collection name from an OData reference like ".../accounts(guid)".
function collectionFromRef(ref: string): string | null {
    const m = ref.match(/([a-zA-Z_][\w]*)\([^)]*\)\s*$/);
    return m ? m[1] : null;
}

const OWNER_BIND_PROPS = ['ownerid', 'owninguser', 'owningteam'];

interface ParsedBinds {
    // Referenced collections from regular lookups (-> Append To on each).
    lookupTargets: string[];
    // Owner lookup set (-> Assign on the record being assigned).
    hasOwner: boolean;
}

// Lookups set on a form arrive inline as "nav@odata.bind": "/accounts(guid)".
// Owner assignment (ownerid) is governed by the Assign privilege, not Append To.
function parseBinds(body: string | null): ParsedBinds {
    const result: ParsedBinds = { lookupTargets: [], hasOwner: false };
    if (!body) {
        return result;
    }

    try {
        const parsed = JSON.parse(body);

        for (const key of Object.keys(parsed)) {
            const lower = key.toLowerCase();
            if (!lower.endsWith('@odata.bind')) {
                continue;
            }

            const prop = lower.slice(0, lower.length - '@odata.bind'.length);
            if (OWNER_BIND_PROPS.includes(prop)) {
                result.hasOwner = true;
                continue;
            }

            const value = parsed[key];
            const refs = Array.isArray(value) ? value : [value];
            for (const ref of refs) {
                if (typeof ref !== 'string') {
                    continue;
                }
                const collection = collectionFromRef(ref);
                if (collection) {
                    result.lookupTargets.push(collection);
                }
            }
        }
    } catch {
        // ignore malformed bodies
    }

    return result;
}

// Associate requests carry the related record as {"@odata.id": ".../contacts(guid)"}.
function childCollectionFromBody(body: string | null): string | null {
    if (!body) {
        return null;
    }

    try {
        const parsed = JSON.parse(body);
        const odataId = parsed['@odata.id'];
        return typeof odataId === 'string' ? collectionFromRef(odataId) : null;
    } catch {
        return null;
    }
}

// Splits a $batch multipart body into its embedded operations.
function parseBatch(body: string | null): CapturedRequest[] {
    if (!body) {
        return [];
    }

    const requests: CapturedRequest[] = [];
    const lineRe = /(GET|POST|PUT|PATCH|DELETE)\s+(\S+)\s+HTTP\/[\d.]+/g;

    let match: RegExpExecArray | null;
    while ((match = lineRe.exec(body)) !== null) {
        const method = match[1];
        const url = match[2];

        const rest = body.slice(lineRe.lastIndex);
        const nextIdx = rest.search(/(?:GET|POST|PUT|PATCH|DELETE)\s+\S+\s+HTTP\/[\d.]+/);
        const segment = nextIdx === -1 ? rest : rest.slice(0, nextIdx);

        const start = segment.indexOf('{');
        const end = segment.lastIndexOf('}');
        const opBody = (start !== -1 && end > start) ? segment.slice(start, end + 1) : null;

        requests.push({ method, url, body: opBody });
    }

    return requests;
}

function updatesForSingle(req: CapturedRequest): PrivilegeUpdate[] {
    const path = apiPath(req.url);
    if (!path) {
        return [];
    }

    const method = req.method;

    if (isAssociation(path)) {
        // Associate/disassociate. Append To on the record being appended to (the
        // parent in the URL) and Append on the related record (from the body).
        const updates: PrivilegeUpdate[] = [];

        const parent = leadingCollection(path);
        if (parent) {
            updates.push({ entity: parent, privilege: PrivilegeName.AppendTo });
        }

        if (method === 'POST' || method === 'PUT') {
            const child = childCollectionFromBody(req.body);
            if (child) {
                updates.push({ entity: child, privilege: PrivilegeName.Append });
            }
        }

        return updates;
    }

    const privilege = crudPrivilege(method);
    if (!privilege) {
        return [];
    }

    // A create is a POST directly to a collection. POSTs to bound actions or
    // functions must not count as Create.
    if (method === 'POST' && !/^[a-zA-Z][\w]*$/.test(path)) {
        return [];
    }

    const entity = leadingCollection(path);
    if (!entity) {
        return [];
    }

    const updates: PrivilegeUpdate[] = [{ entity, privilege }];

    if (method === 'POST' || method === 'PATCH') {
        const { lookupTargets, hasOwner } = parseBinds(req.body);

        // A lookup set inline via @odata.bind means this record is appended to
        // the referenced record: Append on this entity, Append To on each target.
        if (lookupTargets.length > 0) {
            updates.push({ entity, privilege: PrivilegeName.Append });
            for (const target of lookupTargets) {
                updates.push({ entity: target, privilege: PrivilegeName.AppendTo });
            }
        }

        // Setting the owner (ownerid) requires the Assign privilege on this record.
        if (hasOwner) {
            updates.push({ entity, privilege: PrivilegeName.Assign });
        }
    }

    return updates;
}

function updatesForRequest(req: CapturedRequest): PrivilegeUpdate[] {
    const path = apiPath(req.url);
    if (!path) {
        return [];
    }

    if (isBatch(path)) {
        return parseBatch(req.body).flatMap(updatesForSingle);
    }

    return updatesForSingle(req);
}

function applyPrivilege(privilages: TablePrivileges[], table: Table, privilege: PrivilegeName): void {
    const key = table.CollectionLogicalName || table.EntitySetName;
    const entry = privilages.find(p => p.CollectionLogicalName === key);

    if (!entry) {
        privilages.push({
            CollectionLogicalName: key,
            LogicalName: table.LogicalName,
            CollectionName: table.DisplayName || key,
            Privilages: ALL_PRIVILEGES.map(name => ({
                name,
                depth: name === privilege ? PrivilegeDepth.Organization : PrivilegeDepth.None
            }))
        });
        return;
    }

    const existing = entry.Privilages.find(p => p.name === privilege);
    if (existing) {
        existing.depth = PrivilegeDepth.Organization;
    } else {
        entry.Privilages.push({ name: privilege, depth: PrivilegeDepth.Organization });
    }
}

async function recordRequest(req: CapturedRequest): Promise<void> {
    const { sessionActive } = await chrome.storage.local.get('sessionActive');
    if (!sessionActive) {
        return;
    }

    const updates = updatesForRequest(req);
    if (updates.length === 0) {
        return;
    }

    const { tables } = await chrome.storage.local.get('tables');
    const tableList = (tables as Table[]) || [];

    // URLs and @odata.bind values use the entity set name; fall back to the
    // logical collection name for older cached lists.
    const findTable = (collection: string): Table | undefined =>
        tableList.find(t => t.EntitySetName === collection || t.CollectionLogicalName === collection);

    const resolved = updates
        .map(u => ({ ...u, table: findTable(u.entity) }))
        .filter((u): u is PrivilegeUpdate & { table: Table } => {
            if (!u.table) {
                return false;
            }
            // Plain CRUD is limited to user-owned tables to avoid flooding the
            // recording with system-table reads; Append / Append To can target
            // any resolvable table (e.g. systemuser, org-owned tables).
            const isCrud = u.privilege === PrivilegeName.Create
                || u.privilege === PrivilegeName.Read
                || u.privilege === PrivilegeName.Write
                || u.privilege === PrivilegeName.Delete;
            return isCrud ? u.table.IsUserOwned : true;
        });

    if (resolved.length === 0) {
        return;
    }

    console.log('[PowerRoles] recorded', resolved.map(r => `${r.table.CollectionLogicalName}:${r.privilege}`));

    await enqueueWrite(async () => {
        const stored = await chrome.storage.local.get('privilages');
        const privilages: TablePrivileges[] = stored.privilages || [];

        for (const u of resolved) {
            applyPrivilege(privilages, u.table, u.privilege);
        }

        await chrome.storage.local.set({ privilages });
    });
}

// Clicking the toolbar icon opens the docked side panel.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => { });

chrome.runtime.onMessage.addListener((message) => {
    if (message && message.action === 'RECORD_REQUEST') {
        void recordRequest({ method: message.method, url: message.url, body: message.body });
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== 'complete') { return; }

    chrome.storage.local.get('sessionActive', (result) => {
        let sessionActive = result.sessionActive;

        chrome.action.setBadgeText({ text: sessionActive ? 'REC' : '' });
        chrome.action.setBadgeBackgroundColor({ color: sessionActive ? '#FF0000' : '#000000' });
        chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
    });
});


export { }
