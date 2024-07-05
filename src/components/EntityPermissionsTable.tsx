import { useEffect, useState } from "react";
import { TablePrivileges } from "../model/TablePrivileges"
import { ShowNames } from "../enum/ShowNames";
import { PrivilegeDepth } from "../enum/PrivilegeDepth";

export interface TablePrivilegesProps {
    tablePrivileges: TablePrivileges[];
    names: ShowNames;
}

export default function EntityPermissionsTable(props: TablePrivilegesProps) {
    const [tablePrivileges, setTablePrivileges] = useState([] as TablePrivileges[]);
    const [showNames, setShowNames] = useState<ShowNames>(props.names || false);

    const renderName = (privilage: TablePrivileges) => {
        switch (showNames) {
            case ShowNames.DisplayNames:
                return privilage.CollectionName;
            case ShowNames.LogicalNames:
                return privilage.LogicalName;
            case ShowNames.Both:
                return `${privilage.CollectionName} (${privilage.LogicalName})`;
            default:
                return privilage.LogicalName;
        }
    }

    const cycleDepthsOnClick = (depth: PrivilegeDepth) => {
        switch (depth) {
            case PrivilegeDepth.None:
                return PrivilegeDepth.User;
            case PrivilegeDepth.User:
                return PrivilegeDepth.BusinessUnit;
            case PrivilegeDepth.BusinessUnit:
                return PrivilegeDepth.ParentChildBusinessUnit;
            case PrivilegeDepth.ParentChildBusinessUnit:
                return PrivilegeDepth.Organization;
            case PrivilegeDepth.Organization:
                return PrivilegeDepth.None;
            default:
                return PrivilegeDepth.None;
        }
    }

    const depthTooltip = (depth: PrivilegeDepth) => {
        switch (depth) {
            case PrivilegeDepth.None:
                return 'None';
            case PrivilegeDepth.User:
                return 'User';
            case PrivilegeDepth.BusinessUnit:
                return 'Business Unit';
            case PrivilegeDepth.ParentChildBusinessUnit:
                return 'Parent Child Business Unit';
            case PrivilegeDepth.Organization:
                return 'Organization';
            default:
                return 'None';
        }
    }


    const privilageDepthColor = (depth: PrivilegeDepth) => {
        switch (depth) {
            case PrivilegeDepth.None:
                return 'bg-gray-200';
            case PrivilegeDepth.User:
                return 'bg-blue-200';
            case PrivilegeDepth.BusinessUnit:
                return 'bg-green-200';
            case PrivilegeDepth.ParentChildBusinessUnit:
                return 'bg-yellow-200';
            case PrivilegeDepth.Organization:
                return 'bg-red-200';
            default:
                return 'bg-gray-200';
        }
    }

    const actions = ['Create', 'Read', 'Write', 'Delete'];

    useEffect(() => {
        setTablePrivileges(props.tablePrivileges);
    }, [props.tablePrivileges]);

    useEffect(() => {
        setShowNames(props.names || false);
    }, [props.names]);

    return (
        <table
            className='w-full p-2'
        >
            <thead>
                <tr className='sticky top-0 bg-gray-200 z-10'>
                    <th className='p-2 text-left'>Entity</th>
                    {actions.map((action) => <th className='p-2 text-center'>{action}</th>)}
                </tr>
            </thead>
            <tbody>
                {tablePrivileges && tablePrivileges.map((privilage: TablePrivileges) => (
                    <tr
                        className='border-b-2 border-gray-200 hover:bg-gray-300 cursor-pointer'
                    >
                        <td
                            onClick={async () => {
                                let initialPrivilege = privilage.Privilages.map(p => p.depth).reduce((a, b) => a === b ? a : PrivilegeDepth.Organization);
                                let newPrivilegeDepth = cycleDepthsOnClick(initialPrivilege);

                                privilage.Privilages.forEach(p => {
                                    p.depth = newPrivilegeDepth;
                                });

                                await chrome.storage.local.set({ privilages: tablePrivileges });
                                setTablePrivileges([...tablePrivileges]);
                            }}
                            className='p-2 text-left'>{renderName(privilage)}</td>
                        {
                            privilage.Privilages.map((p) => {
                                return (
                                    <td className='p-2 text-center'>
                                        <div
                                            className='flex justify-center'
                                        >
                                            <div
                                                onClick={async () => {
                                                    let newPrivilegeDepth = cycleDepthsOnClick(p.depth);
                                                    p.depth = newPrivilegeDepth;

                                                    await chrome.storage.local.set({ privilages: tablePrivileges });
                                                    setTablePrivileges([...tablePrivileges]);
                                                }}
                                                title={depthTooltip(p.depth)}

                                            >
                                                <img
                                                    className='w-4 h-4'
                                                    src={`/img/depths/${PrivilegeDepth[p.depth].toString()}.svg`} alt="" />
                                            </div>
                                        </div>
                                    </td>
                                )
                            })
                        }
                    </tr>
                ))}
                {
                    tablePrivileges.length === 0 && <tr>
                        <td colSpan={5}
                            className='text-center p-4 text-gray-400'>No data</td>
                    </tr>
                }
            </tbody>
        </table>
    )
}