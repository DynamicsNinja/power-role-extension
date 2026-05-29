import { useEffect, useMemo, useRef, useState } from 'react';

interface User {
    id: string;
    name: string;
}

interface IUserComboboxProps {
    users: User[];
    value: string;            // '' = the empty option
    disabled?: boolean;
    id?: string;
    emptyLabel?: string;      // label for the '' option (e.g. "Me (no impersonation)")
    onChange: (id: string) => void;
}

export default function UserCombobox(props: IUserComboboxProps) {
    const { users, value, disabled, onChange } = props;
    const inputId = props.id ?? 'record-as';
    const emptyLabel = props.emptyLabel ?? 'Me (no impersonation)';

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const options = useMemo(() => [{ id: '', name: emptyLabel }, ...users], [users, emptyLabel]);

    const selectedLabel = useMemo(() => {
        const found = options.find(o => o.id === value);
        return found ? found.name : '';
    }, [options, value]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) { return options; }
        return options.filter(o => o.name.toLowerCase().includes(q));
    }, [options, query]);

    // Close when clicking outside the combobox.
    useEffect(() => {
        const onDocMouseDown = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, []);

    // Keep the highlighted index within the (possibly filtered) list.
    useEffect(() => {
        setHighlight(h => Math.min(h, Math.max(0, filtered.length - 1)));
    }, [filtered.length]);

    // Scroll the highlighted option into view while navigating with the keyboard.
    useEffect(() => {
        if (!open || !listRef.current) { return; }
        const el = listRef.current.children[highlight] as HTMLElement | undefined;
        el?.scrollIntoView({ block: 'nearest' });
    }, [highlight, open]);

    const openList = () => {
        if (disabled || open) { return; }
        setQuery('');
        const idx = options.findIndex(o => o.id === value);
        setHighlight(idx >= 0 ? idx : 0);
        setOpen(true);
    };

    const choose = (opt: User) => {
        onChange(opt.id);
        setOpen(false);
        setQuery('');
        inputRef.current?.blur();
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (disabled) { return; }

        if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
            openList();
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlight(h => Math.min(h + 1, filtered.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlight(h => Math.max(h - 1, 0));
                break;
            case 'Enter': {
                e.preventDefault();
                const opt = filtered[highlight];
                if (opt) { choose(opt); }
                break;
            }
            case 'Escape':
                setOpen(false);
                setQuery('');
                break;
            default:
                break;
        }
    };

    return (
        <div ref={containerRef} className='relative'>
            <input
                ref={inputRef}
                id={inputId}
                type='text'
                className='input pr-8'
                autoComplete='off'
                role='combobox'
                aria-expanded={open}
                aria-controls={`${inputId}-list`}
                disabled={disabled}
                placeholder={selectedLabel || 'Select a user…'}
                value={open ? query : selectedLabel}
                onChange={(e) => { setQuery(e.target.value); setHighlight(0); setOpen(true); }}
                onFocus={openList}
                onClick={openList}
                onKeyDown={onKeyDown}
            />

            <svg
                xmlns='http://www.w3.org/2000/svg'
                className={`pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted transition-transform ${open ? 'rotate-180' : ''}`}
                fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
                <path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7' />
            </svg>

            {open &&
                <ul
                    ref={listRef}
                    id={`${inputId}-list`}
                    role='listbox'
                    className='absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-surface py-1 shadow-lg'
                >
                    {filtered.length === 0 &&
                        <li className='px-3 py-2 text-sm text-fg-muted'>No users found</li>}
                    {filtered.map((opt, i) => {
                        const isSelected = opt.id === value;
                        const isHighlighted = i === highlight;
                        return (
                            <li
                                key={opt.id || '__me__'}
                                role='option'
                                aria-selected={isSelected}
                                onMouseDown={(e) => { e.preventDefault(); choose(opt); }}
                                onMouseEnter={() => setHighlight(i)}
                                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${isHighlighted ? 'bg-surface-3' : ''} ${opt.id === '' ? 'text-fg-muted' : 'text-fg'}`}
                            >
                                <span className='truncate'>{opt.name}</span>
                                {isSelected &&
                                    <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4 shrink-0 text-accent'
                                        fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
                                        <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
                                    </svg>}
                            </li>
                        );
                    })}
                </ul>}
        </div>
    );
}
