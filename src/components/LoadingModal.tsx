export interface ILoadingModalProps {
    message: string;
}

export default function LoadingModal(props: ILoadingModalProps) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        >
            <div className="flex flex-col items-center gap-3">
                <svg
                    className="h-8 w-8 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <div className="text-sm font-semibold text-white">{props.message || "Loading"}</div>
            </div>
        </div>
    )
}
