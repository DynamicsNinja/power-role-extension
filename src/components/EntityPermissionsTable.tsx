import { useEffect, useState } from "react";
import { TablePrivileges } from "../model/TablePrivileges"

export interface TablePrivilegesProps {
    tablePrivileges: TablePrivileges[];
}

export default function EntityPermissionsTable(props: TablePrivilegesProps) {
    const [tablePrivileges, setTablePrivileges] = useState([] as TablePrivileges[]);

    useEffect(() => {
        setTablePrivileges(props.tablePrivileges);
    }, [props.tablePrivileges]);

    return (
        <table
            className='w-full p-2'
        >
            <thead>
                <tr className='sticky top-0 bg-gray-200 z-10'>
                    <th className='p-2 text-left'>Entity</th>
                    <th className='p-2 text-center'>Create</th>
                    <th className='p-2 text-center'>Read</th>
                    <th className='p-2 text-center'>Update</th>
                    <th className='p-2 text-center'>Delete</th>
                </tr>
            </thead>
            <tbody>
                {tablePrivileges && tablePrivileges.map((privilage: TablePrivileges) => (
                    <tr
                        className='border-b-2 border-gray-200 hover:bg-gray-300'
                    >
                        <td className='p-2 text-left'>{
                            privilage.CollectionName
                        }</td>
                        {
                            ['Create', 'Read', 'Write', 'Delete'].map((permission) => {
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