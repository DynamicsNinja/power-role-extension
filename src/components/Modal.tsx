import { useEffect, useState } from "react";

interface ModalProps {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
}

export default function Modal(props: ModalProps) {
    const [title, setTitle] = useState<string>(props.title)
    const [children, setChildren] = useState<React.ReactNode>(props.children)

    useEffect(() => {
        setTitle(props.title)
        setChildren(props.children)
    }, [props])

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
        >
            <div className="dialog">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-fg">
                        {title}
                    </h2>
                    <button
                        type="button"
                        className="icon-btn"
                        aria-label="Close"
                        onClick={props.onClose}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
                <div>
                    {children}
                </div>
            </div>
        </div>
    )
}
