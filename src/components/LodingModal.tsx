export interface ILoadingModalProps {
    message: string;
}

export default function LodingModal(props: ILoadingModalProps) {
    return (
        <div
            className="p-2 fixed inset-0 z-50 bg-black bg-opacity-60 flex justify-center items-center"
        >
            <div
            >
                <div className="text-white text-lg font-bold animate-blink">{props.message || "Loading"} </div>
            </div>
        </div>
    )
}