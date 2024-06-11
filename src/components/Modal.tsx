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
            className="p-2 fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center"
        >
            <div
                className="bg-white p-4 rounded-lg w-full flex flex-col space-y-2"
            >
                <div
                    className="flex justify-between items-center"
                >
                    <div
                        className="text-lg font-bold"
                    >
                        {title}
                    </div>
                    <div
                        className="cursor-pointer"
                        onClick={props.onClose}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </div>
                </div>
                <div>
                    {children}
                </div>
            </div>
        </div>
    )
}