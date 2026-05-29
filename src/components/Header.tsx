interface IHeaderProps {
    onSettingsClick: () => void;
}

export default function Header(props: IHeaderProps) {
    return (
        <header className='flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-3'>
            <div className='flex items-center gap-2'>
                <img
                    className='h-7 w-7'
                    src={"/logo192.png"} alt="Power Roles logo" />
                <span className='text-base font-semibold'>
                    Power Roles
                </span>
            </div>
            <div className='flex items-center gap-1'>
                <button
                    type='button'
                    className='icon-btn'
                    title='Buy me a coffee'
                    aria-label='Buy me a coffee'
                    onClick={() => chrome.tabs.create({ url: 'https://www.buymeacoffee.com/dynamicsninja' })}
                >
                    <img
                        className='h-6 w-6 rounded-full'
                        src="/img/buymeacoffee.gif" alt="" />
                </button>

                <button
                    type='button'
                    className='icon-btn'
                    title='Settings'
                    aria-label='Settings'
                    onClick={() => props.onSettingsClick()}
                >
                    <svg
                        xmlns='http://www.w3.org/2000/svg'
                        className='h-5 w-5'
                        fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={1.8}>
                        <path strokeLinecap='round' strokeLinejoin='round' d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' />
                        <path strokeLinecap='round' strokeLinejoin='round' d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                    </svg>
                </button>
            </div>
        </header>
    )
}
