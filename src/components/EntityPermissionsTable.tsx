import { useEffect, useState } from "react";
import { TablePrivileges } from "../model/TablePrivileges"
import { ShowNames } from "../enum/ShowNames";
import { PrivilegeDepth } from "../enum/PrivilegeDepth";

export interface TablePrivilegesProps {
    tablePrivileges: TablePrivileges[];
    names: ShowNames;
}

const cloneAll = (rows: TablePrivileges[]): TablePrivileges[] =>
    rows.map(row => ({ ...row, Privilages: row.Privilages.map(p => ({ ...p })) }));

// All depths equal -> keep it; mixed -> treat as Organization so a click cycles to None.
const commonDepth = (depths: PrivilegeDepth[]): PrivilegeDepth => {
    if (depths.length === 0) { return PrivilegeDepth.None; }
    const first = depths[0];
    return depths.every(d => d === first) ? first : PrivilegeDepth.Organization;
};

export default function EntityPermissionsTable(props: TablePrivilegesProps) {
    const [tablePrivileges, setTablePrivileges] = useState([] as TablePrivileges[]);
    const [showNames, setShowNames] = useState<ShowNames>(props.names);

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

    const persist = async (next: TablePrivileges[]) => {
        setTablePrivileges(next);
        await chrome.storage.local.set({ privilages: next });
    }

    const onRowClick = async (privilage: TablePrivileges) => {
        const next = cloneAll(tablePrivileges);
        const target = next.find(r => r.CollectionLogicalName === privilage.CollectionLogicalName);
        if (!target) { return; }

        const newPrivilegeDepth = cycleDepthsOnClick(commonDepth(target.Privilages.map(p => p.depth)));
        target.Privilages.forEach(p => { p.depth = newPrivilegeDepth; });

        await persist(next);
    }

    const onColumnClick = async (action: string) => {
        const next = cloneAll(tablePrivileges);

        const columnDepths = next
            .map(r => r.Privilages.find(p => p.name === action)?.depth)
            .filter((d): d is PrivilegeDepth => d !== undefined);

        const newPrivilegeDepth = cycleDepthsOnClick(commonDepth(columnDepths));

        next.forEach(r => {
            const p = r.Privilages.find(pp => pp.name === action);
            if (p) { p.depth = newPrivilegeDepth; }
        });

        await persist(next);
    }

    const onCellClick = async (privilage: TablePrivileges, privilegeName: string) => {
        const next = cloneAll(tablePrivileges);
        const target = next.find(r => r.CollectionLogicalName === privilage.CollectionLogicalName);
        const p = target?.Privilages.find(pp => pp.name === privilegeName);
        if (!p) { return; }

        p.depth = cycleDepthsOnClick(p.depth);

        await persist(next);
    }

    const actions: { name: string; label: string }[] = [
        { name: 'Create', label: 'Create' },
        { name: 'Read', label: 'Read' },
        { name: 'Write', label: 'Write' },
        { name: 'Delete', label: 'Delete' },
        { name: 'Append', label: 'Append' },
        { name: 'AppendTo', label: 'Append To' },
        { name: 'Assign', label: 'Assign' },
    ];

    useEffect(() => {
        setTablePrivileges(props.tablePrivileges);
    }, [props.tablePrivileges]);

    useEffect(() => {
        setShowNames(props.names);
    }, [props.names]);

    if (tablePrivileges.length === 0) {
        return (
            <div className='flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-fg-muted'>
                <svg xmlns='http://www.w3.org/2000/svg' className='h-10 w-10 opacity-60'
                    fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={1.5}>
                    <path strokeLinecap='round' strokeLinejoin='round'
                        d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
                </svg>
                <div className='text-sm font-semibold text-fg'>No actions recorded yet</div>
                <div className='text-xs'>Start recording, then perform actions in Dynamics 365.</div>
            </div>
        )
    }

    return (
        <table className='w-full min-w-[620px] table-fixed text-sm'>
            <thead>
                <tr className='sticky top-0 z-10 bg-surface-2 text-fg-muted'>
                    <th className='px-3 py-2 text-left font-semibold'>Entity</th>
                    {actions.map((action) => (
                        <th
                            key={action.name}
                            onClick={() => onColumnClick(action.name)}
                            className='w-14 cursor-pointer select-none px-1 py-2 text-center text-xs font-semibold leading-tight transition-colors hover:text-fg'>
                            {action.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {tablePrivileges.map((privilage: TablePrivileges) => (
                    <tr
                        key={privilage.CollectionLogicalName}
                        className='border-t border-border transition-colors hover:bg-surface-3'
                    >
                        <td
                            onClick={() => { onRowClick(privilage) }}
                            className='cursor-pointer select-none break-words px-3 py-2 text-left'>
                            {renderName(privilage)}
                        </td>
                        {privilage.Privilages.map((p) => (
                            <td key={p.name} className='px-1 py-2 text-center'>
                                <div className='flex justify-center'>
                                    <button
                                        type='button'
                                        onClick={() => onCellClick(privilage, p.name)}
                                        title={depthTooltip(p.depth)}
                                        aria-label={`${p.name}: ${depthTooltip(p.depth)}`}
                                        className='rounded p-1 hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60'
                                    >
                                        <img
                                            className='h-4 w-4'
                                            src={`/img/depths/${PrivilegeDepth[p.depth].toString()}.svg`}
                                            alt={depthTooltip(p.depth)} />
                                    </button>
                                </div>
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}
