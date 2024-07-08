export default function Footer() {
    let appVersion = chrome.runtime.getManifest().version;

    return (
        <footer>
            <div className='flex justify-between w-full border-t-2 border-gray-200 p-4 bg-gray-200 shadow-md'>
                <div className="text-xs">
                    Version {appVersion}
                </div>
                <div className="text-xs">
                    <span>Created by </span>
                    <span
                        onClick={() => chrome.tabs.create({ url: 'https://www.linkedin.com/in/ivanficko/' })}
                        className='font-bold cursor-pointer text-blue-500'
                    >
                        Ivan Ficko
                    </span>
                </div>
            </div>
        </footer>
    );
}