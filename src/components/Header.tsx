interface IHeaderProps {
    onSettingsClick: () => void;
}

export default function Header(props: IHeaderProps) {
    return (
        <div
            className='flex justify-between w-full border-b-2 border-gray-200 p-4 bg-gray-200 shadow-md'
        >
            <div
                className='flex justify-center items-center space-x-2'
            >
                <img
                    className='w-8 h-8'
                    src={"/logo192.png"} alt="" />
                <div className='text-xl font-bold'>
                    Power Roles
                </div>
            </div>
            <div
                className='flex justify-center items-center space-x-2'
            >
                <div
                    title='Buy me a coffee'
                    onClick={() => chrome.tabs.create({ url: 'https://www.buymeacoffee.com/dynamicsninja' })}
                >
                    <img
                        className='w-8 h-8 cursor-pointer border-2 border-black rounded-full'
                        src="/img/buymeacoffee.gif" alt="" />
                </div>


                <img
                    onClick={() => props.onSettingsClick()}
                    className='w-8 h-8 cursor-pointer hover:opacity-50 transform hover:scale-110'
                    src="/img/settings.svg" alt="" />

            </div>
        </div>
    )
}