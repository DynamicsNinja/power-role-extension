import { useEffect, useState } from "react";
import { TablePrivileges } from "../model/TablePrivileges"
import { ShowNames } from "../enum/ShowNames";

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
                        className='border-b-2 border-gray-200 hover:bg-gray-300'
                    >
                        <td className='p-2 text-left'>{renderName(privilage)}</td>
                        {
                            actions.map((permission) => {
                                return (
                                    <td className='p-2 text-center'>
                                        <div
                                            className='flex justify-center'
                                        >
                                            <div
                                                className={
                                                    `w-4 h-4 rounded-full 
                            ${privilage.Privilages.includes(permission) ? 'bg-green-500' : 'bg-gray-200'}`
                                                }
                                            ></div>
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