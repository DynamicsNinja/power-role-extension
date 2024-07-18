import { PrivilegeDepth } from "../enum/PrivilegeDepth";
import { BusinessUnit } from "../model/BusinessUnit";
import { Role } from "../model/Role";
import { Table } from "../model/Table";
import { TablePrivileges } from "../model/TablePrivileges";

// eslint-disable-next-line no-restricted-globals
let baseUrl = parent.location.origin;

export async function getAllTables(): Promise<Table[]> {
    let select = "LogicalCollectionName,DisplayCollectionName,LogicalName";
    let filter = "OwnershipType eq 'UserOwned'";

    let response = await fetch(
        `${baseUrl}/api/data/v9.2/EntityDefinitions?$select=${select}&$filter=${filter}`,
        {
            method: "GET",
            headers: {
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
                "Prefer": "odata.include-annotations=*"
            }
        }
    );

    let data = await response.json();


    let tables = data.value.map((table: any) => {
        return {
            LogicalName: table.LogicalName,
            DisplayName: table.DisplayCollectionName.LocalizedLabels[0].Label,
            CollectionLogicalName: table.LogicalCollectionName
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

    let response = await fetch(
        `${baseUrl}/api/data/v9.2/privileges?$select=privilegeid,name&$filter=${filter}`,
        {
            method: "GET",
            headers: {
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
                "Prefer": "return=representation"
            }
        }
    );

    let data = await response.json();

    console.log(data);

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

    console.log(privilages);

    return privilages;
}

export async function createRoleWithPrivileges(name: string, buId: string, tablePrivileges: TablePrivileges[]) {
    let privilages = await getPrivilegesByNames(tablePrivileges);

    privilages = privilages.map(p => {
        return {
            id: p.id,
            depth: Math.log2(p.depth)
        }
    })

    console.log(privilages);

    let roleId = await createRole(name, buId);
    await addPrivilegesToRole(roleId, buId, privilages);

    return roleId;
}

export async function updateRoleWithPrivileges(roleId: string, buId: string, tablePrivileges: TablePrivileges[]) {
    let newPrivileges = await getPrivilegesByNames(tablePrivileges);

    let select = "privilegeid,roleid,privilegedepthmask";
    let filter = `(roleid eq ${roleId})`;

    let response = await fetch(
        `${baseUrl}/api/data/v9.2/roleprivilegescollection?$select=${select}&$filter=${filter}`,
        {
            method: "GET",
            headers: {
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
                "Prefer": "return=representation"
            }
        }
    );

    let existingPrivileges = await response.json();

    let allTablePrivileges = existingPrivileges.value.map((tp: any) => {
        return {
            id: tp.privilegeid,
            depth: tp.privilegedepthmask
        }
    });

    newPrivileges.forEach(privilege => {
        let existingPrivilege = existingPrivileges.value.find((ep: any) => ep.privilegeid === privilege.id);

        if (!existingPrivilege) {
            allTablePrivileges.push({
                id: privilege.id,
                depth: Math.log2(privilege.depth)
            });
        }
    });

    await addPrivilegesToRole(roleId, buId, allTablePrivileges);
}

async function addPrivilegesToRole(roleId: string, buId: string, privileges: any[]) {
    await fetch(
        `${baseUrl}/api/data/v9.0/roles(${roleId})/Microsoft.Dynamics.CRM.ReplacePrivilegesRole`,
        {
            method: "POST",
            headers: {
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
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
    let response = await fetch(
        `${baseUrl}/api/data/v9.2/roles`,
        {
            method: "POST",
            headers: {
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
                "Prefer": "return=representation"
            },
            body: JSON.stringify({
                name: name,
                "businessunitid@odata.bind": `/businessunits(${buId})`,

            })
        }
    );

    if (response.status !== 201) {
        throw new Error('Role creation failed');
    }

    let data = await response.json();

    let roleId = data.roleid as string;

    return roleId;
}

export async function getBusinessUnits(): Promise<BusinessUnit[]> {
    let response = await fetch(
        `${baseUrl}/api/data/v9.2/businessunits?$select=name,businessunitid`,
        {
            method: "GET",
            headers: {
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
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
    let response = await fetch(
        `${baseUrl}/api/data/v9.2/roles?$select=name,roleid&$filter=(_businessunitid_value eq ${buId})&$orderby=name asc`,
        {
            method: "GET",
            headers: {
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
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

    let response = await fetch(
        `${baseUrl}/api/data/v9.2/solutions?$select=${select}&$filter=${filter}&$orderby=${orderby}`,
        {
            method: "GET",
            headers: {
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
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
    await fetch(
        `${baseUrl}/api/data/v9.2/AddSolutionComponent`,
        {
            method: "POST",
            headers: {
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
            },
            body: JSON.stringify({
                "ComponentId": roleId,
                "ComponentType": 20,
                "SolutionUniqueName": solutionName,
                "AddRequiredComponents": false
            })
        }
    );
}