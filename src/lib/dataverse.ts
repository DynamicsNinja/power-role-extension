import { PrivilegeDepth } from "../enum/PrivilegeDepth";
import { BusinessUnit } from "../model/BusinessUnit";
import { Role } from "../model/Role";
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
    let select = "LogicalCollectionName,DisplayCollectionName,LogicalName,EntitySetName,OwnershipType";

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
                IsUserOwned: table.OwnershipType === 'UserOwned'
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
        `${baseUrl}/api/data/v9.2/privileges?$select=privilegeid,name&$filter=${filter}`,
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
                    depth: p.depth
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

export async function createRoleWithPrivileges(name: string, buId: string, tablePrivileges: TablePrivileges[]) {
    let privilages = await getPrivilegesByNames(tablePrivileges);

    privilages = privilages.map(p => {
        return {
            id: p.id,
            depth: maskToDepthIndex(p.depth)
        }
    })

    let roleId = await createRole(name, buId);
    await addPrivilegesToRole(roleId, buId, privilages);

    return roleId;
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
            depth: maskToDepthIndex(privilege.depth)
        });
    });

    await addPrivilegesToRole(roleId, buId, Array.from(privilegesById.values()));
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
