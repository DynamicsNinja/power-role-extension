export default function Footer() {
    let appVersion = chrome.runtime.getManifest().version;

    return (
        <footer>
            <div className='flex justify-between w-full border-t-2 border-gray-200 p-4 bg-gray-200 shadow-md'>
                <div className="text-xs">
                    Version: {appVersion}
                </div>
                <div className="text-xs">
                    Created by Ivan Ficko
                </div>
            </div>
        </footer>
    );
}