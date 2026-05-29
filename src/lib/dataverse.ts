import { PrivilegeDepth } from "../enum/PrivilegeDepth";
import { BusinessUnit } from "../model/BusinessUnit";
import { Role } from "../model/Role";
import { RolePrivilegeDiff } from "../model/RolePrivilegeDiff";
import { Table } from "../model/Table";
import { TablePrivileges } from "../model/TablePrivileges";

// eslint-disable-next-line no-restricted-globals
let baseUrl = parent.location.origin;

const defaultHeaders = {
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0",
    "Content-Type": "application/json; charset=utf-8",
    "Accept": "application/json",
};

// The live-build temp role uses a fixed id so a role left behind by a panel
// that was closed without Stop is reused instead of piling up duplicates.
const TEMP_ROLE_ID = "e1d9c7a3-5b2f-4e8a-9c1d-7f6a3b2c1d0e";
const TEMP_ROLE_NAME = "PowerRoles Temp (auto, safe to delete)";

async function dvFetch(url: string, init: RequestInit): Promise<Response> {
    const response = await fetch(url, init);

    if (!response.ok) {
        let message = `Dataverse request failed (${response.status})`;
        try {
            const body = await response.json();
            message = body?.error?.message || message;
        } catch {
            // response had no JSON body; keep the status-based message
        }
        throw new Error(message);
    }

    return response;
}

export async function getAllTables(): Promise<Table[]> {
    // All tables are fetched (not just user-owned) so any lookup target can be
    // resolved for Append / Append To. The recorder limits plain CRUD recording
    // to user-owned tables via the IsUserOwned flag.
    let select = "LogicalCollectionName,DisplayCollectionName,LogicalName,EntitySetName,OwnershipType,ObjectTypeCode";

    let response = await dvFetch(
        `${baseUrl}/api/data/v9.2/EntityDefinitions?$select=${select}`,
        {
            method: "GET",
            headers: {
                ...defaultHeaders,
                "Prefer": "odata.include-annotations=*"
            }
        }
    );

    let data = await response.json();

    let tables: Table[] = data.value
        .filter((table: any) => table.EntitySetName || table.LogicalCollectionName)
        .map((table: any) => {
            return {
                LogicalName: table.LogicalName,
                DisplayName: table.DisplayCollectionName?.LocalizedLabels?.[0]?.Label || table.LogicalCollectionName || table.EntitySetName,
                CollectionLogicalName: table.LogicalCollectionName,
                EntitySetName: table.EntitySetName,
                IsUserOwned: table.OwnershipType === 'UserOwned',
                ObjectTypeCode: table.ObjectTypeCode
            } as Table;
        });

    return tables;
}

async function getPrivilegesByNames(tablePrivileges: TablePrivileges[]) {
    let privilegeNames: string[] = [];

    tablePrivileges.forEach(tablePrivilege => {
        tablePrivilege.Privilages.forEach(p => {
            privilegeNames.push(`prv${p.name}${tablePrivilege.LogicalName}`);
        });
    });

    let privilegesCsv = privilegeNames.map(p => `'${p}'`).join(',');
    let filter = `(Microsoft.Dynamics.CRM.In(PropertyName='name',PropertyValues=[${privilegesCsv}]))`;

    let response = await dvFetch(
        `${baseUrl}/api/data/v9.2/privileges?$select=privilegeid,name,canbebasic,canbelocal,canbedeep,canbeglobal&$filter=${filter}`,
        {
            method: "GET",
            headers: {
                ...defaultHeaders,
                "Prefer": "return=representation"
            }
        }
    );

    let data = await response.json();

    let privilages: any[] = [];

    tablePrivileges.forEach(tp => {
        tp.Privilages.forEach(p => {
            let privilege = data.value.find((pr: any) => pr.name.toLowerCase() === `prv${p.name}${tp.LogicalName}`.toLowerCase());

            if (p.depth === PrivilegeDepth.None) {
                return;
            }

            if (privilege) {
                privilages.push({
                    id: privilege.privilegeid,
                    name: privilege.name,
                    depth: p.depth,
                    canbebasic: privilege.canbebasic,
                    canbelocal: privilege.canbelocal,
                    canbedeep: privilege.canbedeep,
                    canbeglobal: privilege.canbeglobal
                });
            }
        });
    });

    return privilages;
}

// Dataverse ReplacePrivilegesRole expects Depth as the enum index
// (Basic=0, Local=1, Deep=2, Global=3), while privilege depth masks are 1/2/4/8.
function maskToDepthIndex(mask: number): number {
    return Math.log2(mask);
}

// Each privilege caps the depth it can be granted at (canbebasic/local/deep/global).
// ReplacePrivilegesRole is all-or-nothing: a single over-depth privilege (e.g.
// prvReadUserEntityUISettings, which can't be Global) makes the whole call 400.
// Clamp the requested depth to the highest allowed depth that doesn't exceed it,
// falling back to the lowest allowed depth if the request is below all of them.
function clampDepthIndex(requestedIndex: number, privilege: any): number {
    const allowed: number[] = [];
    if (privilege.canbebasic) { allowed.push(0); }
    if (privilege.canbelocal) { allowed.push(1); }
    if (privilege.canbedeep) { allowed.push(2); }
    if (privilege.canbeglobal) { allowed.push(3); }

    if (allowed.length === 0) {
        return requestedIndex;
    }

    const atOrBelow = allowed.filter(i => i <= requestedIndex);
    return atOrBelow.length > 0 ? Math.max(...atOrBelow) : Math.min(...allowed);
}

export async function setRolePrivileges(roleId: string, buId: string, tablePrivileges: TablePrivileges[]) {
    let privilages = await getPrivilegesByNames(tablePrivileges);

    privilages = privilages.map(p => {
        return {
            id: p.id,
            depth: clampDepthIndex(maskToDepthIndex(p.depth), p)
        }
    })

    await addPrivilegesToRole(roleId, buId, privilages);
}

export async function createRoleWithPrivileges(name: string, buId: string, tablePrivileges: TablePrivileges[]) {
    let roleId = await createRole(name, buId);
    await setRolePrivileges(roleId, buId, tablePrivileges);

    return roleId;
}

export async function getUserBusinessUnit(userId: string): Promise<string> {
    let response = await dvFetch(
        `${baseUrl}/api/data/v9.2/systemusers(${userId})?$select=_businessunitid_value`,
        {
            method: "GET",
            headers: {
                ...defaultHeaders,
                "Prefer": "odata.include-annotations=*"
            }
        }
    );

    let data = await response.json();
    return data["_businessunitid_value"];
}

export async function assignRoleToUser(userId: string, roleId: string) {
    await dvFetch(
        `${baseUrl}/api/data/v9.2/systemusers(${userId})/systemuserroles_association/$ref`,
        {
            method: "POST",
            headers: defaultHeaders,
            body: JSON.stringify({ "@odata.id": `${baseUrl}/api/data/v9.2/roles(${roleId})` })
        }
    );
}

export async function unassignRoleFromUser(userId: string, roleId: string) {
    await dvFetch(
        `${baseUrl}/api/data/v9.2/systemusers(${userId})/systemuserroles_association(${roleId})/$ref`,
        {
            method: "DELETE",
            headers: defaultHeaders
        }
    );
}

export async function deleteRole(roleId: string) {
    await dvFetch(
        `${baseUrl}/api/data/v9.2/roles(${roleId})`,
        {
            method: "DELETE",
            headers: defaultHeaders
        }
    );
}

// Returns the temp role's business unit if it currently exists, otherwise null.
async function getTempRoleBusinessUnit(): Promise<string | null> {
    const response = await fetch(
        `${baseUrl}/api/data/v9.2/roles(${TEMP_ROLE_ID})?$select=_businessunitid_value`,
        {
            method: "GET",
            headers: { ...defaultHeaders, "Prefer": "odata.include-annotations=*" }
        }
    );

    if (response.status === 404) {
        return null;
    }
    if (!response.ok) {
        let message = `Dataverse request failed (${response.status})`;
        try {
            const body = await response.json();
            message = body?.error?.message || message;
        } catch {
            // keep status-based message
        }
        throw new Error(message);
    }

    const data = await response.json();
    return data["_businessunitid_value"];
}

async function isRoleAssignedToUser(userId: string, roleId: string): Promise<boolean> {
    const response = await dvFetch(
        `${baseUrl}/api/data/v9.2/systemusers(${userId})/systemuserroles_association?$select=roleid&$filter=roleid eq ${roleId}`,
        {
            method: "GET",
            headers: { ...defaultHeaders, "Prefer": "odata.include-annotations=*" }
        }
    );

    const data = await response.json();
    return Array.isArray(data.value) && data.value.length > 0;
}

export async function createTempRole(userId: string): Promise<{ roleId: string; buId: string }> {
    const userBuId = await getUserBusinessUnit(userId);
    let existingBuId = await getTempRoleBusinessUnit();

    // A role can't change business unit, so a leftover temp role in another BU is
    // replaced; otherwise the existing one is reused as-is.
    if (existingBuId && existingBuId !== userBuId) {
        await deleteRole(TEMP_ROLE_ID);
        existingBuId = null;
    }

    const buId = existingBuId ?? userBuId;

    if (!existingBuId) {
        await dvFetch(
            `${baseUrl}/api/data/v9.2/roles`,
            {
                method: "POST",
                headers: defaultHeaders,
                body: JSON.stringify({
                    roleid: TEMP_ROLE_ID,
                    name: TEMP_ROLE_NAME,
                    "businessunitid@odata.bind": `/businessunits(${buId})`
                })
            }
        );
    }

    if (!await isRoleAssignedToUser(userId, TEMP_ROLE_ID)) {
        await assignRoleToUser(userId, TEMP_ROLE_ID);
    }

    return { roleId: TEMP_ROLE_ID, buId };
}

export async function deleteTempRole(userId: string, roleId: string) {
    try {
        await unassignRoleFromUser(userId, roleId);
    } catch {
        // role may already be unassigned; continue to delete
    }
    await deleteRole(roleId);
}

export async function updateRoleWithPrivileges(roleId: string, buId: string, tablePrivileges: TablePrivileges[]) {
    let newPrivileges = await getPrivilegesByNames(tablePrivileges);

    let select = "privilegeid,roleid,privilegedepthmask";
    let filter = `(roleid eq ${roleId})`;

    let response = await dvFetch(
        `${baseUrl}/api/data/v9.2/roleprivilegescollection?$select=${select}&$filter=${filter}`,
        {
            method: "GET",
            headers: {
                ...defaultHeaders,
                "Prefer": "return=representation"
            }
        }
    );

    let existingPrivileges = await response.json();

    // Start from the role's current privileges (converted to depth indexes),
    // then apply the recorded privileges on top so depths shown in the UI win.
    let privilegesById = new Map<string, { id: string; depth: number }>();

    existingPrivileges.value.forEach((ep: any) => {
        privilegesById.set(ep.privilegeid, {
            id: ep.privilegeid,
            depth: maskToDepthIndex(ep.privilegedepthmask)
        });
    });

    newPrivileges.forEach(privilege => {
        privilegesById.set(privilege.id, {
            id: privilege.id,
            depth: clampDepthIndex(maskToDepthIndex(privilege.depth), privilege)
        });
    });

    await addPrivilegesToRole(roleId, buId, Array.from(privilegesById.values()));
}

// Computes what updateRoleWithPrivileges would change on a role, without writing
// anything: each recorded privilege is either added, has its depth changed, or is
// already present at the same (clamped) depth.
export async function diffRoleWithPrivileges(roleId: string, tablePrivileges: TablePrivileges[]): Promise<RolePrivilegeDiff[]> {
    const resolved = await getPrivilegesByNames(tablePrivileges);
    const metaByName = new Map<string, any>();
    resolved.forEach(p => metaByName.set(p.name.toLowerCase(), p));

    let response = await dvFetch(
        `${baseUrl}/api/data/v9.2/roleprivilegescollection?$select=privilegeid,privilegedepthmask&$filter=(roleid eq ${roleId})`,
        {
            method: "GET",
            headers: {
                ...defaultHeaders,
                "Prefer": "return=representation"
            }
        }
    );

    let existing = await response.json();
    const currentMaskById = new Map<string, number>();
    existing.value.forEach((ep: any) => currentMaskById.set(ep.privilegeid, ep.privilegedepthmask));

    const diff: RolePrivilegeDiff[] = [];

    tablePrivileges.forEach(tp => {
        tp.Privilages.forEach(p => {
            if (p.depth === PrivilegeDepth.None) { return; }

            const meta = metaByName.get(`prv${p.name}${tp.LogicalName}`.toLowerCase());
            if (!meta) { return; }

            const finalIndex = clampDepthIndex(maskToDepthIndex(p.depth), meta);
            const finalMask = 1 << finalIndex;
            const currentMask = currentMaskById.get(meta.id);

            let status: RolePrivilegeDiff['status'];
            let fromDepth = -1;
            if (currentMask === undefined) {
                status = 'add';
            } else if (currentMask === finalMask) {
                status = 'unchanged';
                fromDepth = maskToDepthIndex(currentMask);
            } else {
                status = 'change';
                fromDepth = maskToDepthIndex(currentMask);
            }

            diff.push({
                entity: tp.CollectionName || tp.LogicalName,
                logicalName: tp.LogicalName,
                action: p.name,
                status,
                fromDepth,
                toDepth: finalIndex
            });
        });
    });

    return diff;
}

async function addPrivilegesToRole(roleId: string, buId: string, privileges: any[]) {
    await dvFetch(
        `${baseUrl}/api/data/v9.0/roles(${roleId})/Microsoft.Dynamics.CRM.ReplacePrivilegesRole`,
        {
            method: "POST",
            headers: {
                ...defaultHeaders,
                "Prefer": "odata.include-annotations=*"
            },
            body: JSON.stringify({
                "Privileges":
                    privileges.map(privilege => {
                        return {
                            BusinessUnitId: buId,
                            Depth: privilege.depth.toString(),
                            PrivilegeId: privilege.id,
                        }
                    })
            })
        }
    );
}

export async function createRole(name: string, buId: string) {
    let response = await dvFetch(
        `${baseUrl}/api/data/v9.2/roles`,
        {
            method: "POST",
            headers: {
                ...defaultHeaders,
                "Prefer": "return=representation"
            },
            body: JSON.stringify({
                name: name,
                "businessunitid@odata.bind": `/businessunits(${buId})`,
            })
        }
    );

    let data = await response.json();

    let roleId = data.roleid as string;

    return roleId;
}

export async function getBusinessUnits(): Promise<BusinessUnit[]> {
    let response = await dvFetch(
        `${baseUrl}/api/data/v9.2/businessunits?$select=name,businessunitid`,
        {
            method: "GET",
            headers: {
                ...defaultHeaders,
                "Prefer": "odata.include-annotations=*"
            }
        }
    );

    let data = await response.json();

    let businessUnits = data.value.map((bu: any) => {
        return {
            name: bu.name,
            id: bu.businessunitid
        } as BusinessUnit;
    });

    return businessUnits;
}

export async function getUsers(): Promise<{ id: string; name: string }[]> {
    const select = "fullname,systemuserid";
    // Only real interactive users: enabled, Read-Write access mode, and not an
    // application (S2S) user. Drops system/non-interactive/app accounts.
    const filter = "isdisabled eq false and accessmode eq 0 and applicationid eq null";
    const orderby = "fullname asc";

    const users: { id: string; name: string }[] = [];

    // Follow @odata.nextLink so orgs with more than one page (5000) of users are
    // fully covered rather than truncated to the first page.
    let url: string | null =
        `${baseUrl}/api/data/v9.2/systemusers?$select=${select}&$filter=${filter}&$orderby=${orderby}`;

    while (url) {
        const response: Response = await dvFetch(url, {
            method: "GET",
            headers: {
                ...defaultHeaders,
                "Prefer": "odata.include-annotations=*"
            }
        });

        const data: any = await response.json();

        for (const u of data.value) {
            if (u.fullname) {
                users.push({ id: u.systemuserid, name: u.fullname });
            }
        }

        url = data["@odata.nextLink"] || null;
    }

    return users;
}

export async function getRoles(buId: string): Promise<Role[]> {
    let response = await dvFetch(
        `${baseUrl}/api/data/v9.2/roles?$select=name,roleid&$filter=(_businessunitid_value eq ${buId})&$orderby=name asc`,
        {
            method: "GET",
            headers: {
                ...defaultHeaders,
                "Prefer": "odata.include-annotations=*"
            }
        }
    );

    let data = await response.json();

    let roles: Role[] = data.value.map((role: any) => {
        return {
            id: role.roleid,
            name: role.name
        } as Role;
    });

    return roles;
}

export async function getSolutions() {
    let select = "friendlyname,uniquename";
    let filter = "ismanaged eq false and isvisible eq true";
    let orderby = "friendlyname asc";

    let response = await dvFetch(
        `${baseUrl}/api/data/v9.2/solutions?$select=${select}&$filter=${filter}&$orderby=${orderby}`,
        {
            method: "GET",
            headers: {
                ...defaultHeaders,
                "Prefer": "odata.include-annotations=*"
            }
        }
    );

    let data = await response.json();

    let solutions = data.value.map((solution: any) => {
        return {
            id: solution.uniquename,
            name: solution.friendlyname
        };
    });

    return solutions;
}

export async function addRoleToSolution(roleId: string, solutionName: string) {
    await dvFetch(
        `${baseUrl}/api/data/v9.2/AddSolutionComponent`,
        {
            method: "POST",
            headers: defaultHeaders,
            body: JSON.stringify({
                "ComponentId": roleId,
                "ComponentType": 20,
                "SolutionUniqueName": solutionName,
                "AddRequiredComponents": false
            })
        }
    );
}
