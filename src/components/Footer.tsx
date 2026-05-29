export default function Footer() {
    let appVersion = chrome.runtime.getManifest().version;

    return (
        <footer className='flex shrink-0 items-center justify-between border-t border-border bg-surface px-4 py-2 text-xs text-fg-muted'>
            <span>Version {appVersion}</span>
            <span>
                Created by{' '}
                <button
                    type='button'
                    onClick={() => chrome.tabs.create({ url: 'https://www.linkedin.com/in/ivanficko/' })}
                    className='font-semibold text-accent hover:underline'
                >
                    Ivan Ficko
                </button>
            </span>
        </footer>
    );
}
