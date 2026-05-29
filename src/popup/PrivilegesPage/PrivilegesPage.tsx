import { useEffect, useMemo, useState } from 'react';
import usePrivileges from '../../hooks/usePrivilages';
import EntityPermissionsTable from '../../components/EntityPermissionsTable';
import { ShowNames } from '../../enum/ShowNames';
import { Settings } from '../../model/Settings';

// Standalone full-tab view of the recorded privileges. Reads straight from
// chrome.storage (and stays live via the usePrivileges hook), so edits made here
// persist and sync back to the side panel, and vice-versa.
export default function PrivilegesPage() {
    const { privilages } = usePrivileges();
    const [settings, setSettings] = useState<Settings>({ showNames: ShowNames.DisplayNames });
    const [query, setQuery] = useState('');

    useEffect(() => {
        chrome.storage.local.get('settings').then(r => {
            if (r.settings) { setSettings(r.settings); }
        });

        const onChanged = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
            if (area === 'local' && changes.settings) {
                setSettings(changes.settings.newValue || { showNames: ShowNames.DisplayNames });
            }
        };

        chrome.storage.onChanged.addListener(onChanged);
        return () => chrome.storage.onChanged.removeListener(onChanged);
    }, []);

    const filtered = useMemo(() => {
        const list = privilages || [];
        const q = query.trim().toLowerCase();
        if (!q) { return list; }
        return list.filter(p =>
            p.CollectionName.toLowerCase().includes(q) ||
            p.LogicalName.toLowerCase().includes(q) ||
            p.CollectionLogicalName.toLowerCase().includes(q)
        );
    }, [privilages, query]);

    return (
        <div className='flex h-screen w-full flex-col bg-surface-2 text-fg'>
            <header className='flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-3'>
                <div className='flex items-center gap-2.5'>
                    <img className='h-6 w-6' src='/logo192.png' alt='' />
                    <h1 className='flex items-center gap-2 text-base font-semibold'>
                        Recorded privileges
                        <span className='badge'>{privilages?.length ?? 0}</span>
                    </h1>
                </div>

                <div className='relative w-80 max-w-[50vw]'>
                    <svg
                        xmlns='http://www.w3.org/2000/svg'
                        className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted'
                        fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
                        <path strokeLinecap='round' strokeLinejoin='round' d='M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z' />
                    </svg>
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className='input pl-9'
                        type='text'
                        placeholder='Search tables…' />
                </div>
            </header>

            <main className='flex min-h-0 flex-1 flex-col p-6'>
                <div className='card mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-auto'>
                    <EntityPermissionsTable
                        names={settings.showNames}
                        tablePrivileges={filtered} />
                </div>
            </main>
        </div>
    );
}
