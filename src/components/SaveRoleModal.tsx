import { useEffect, useState } from "react";
import { BusinessUnit } from "../model/BusinessUnit";

export interface ISaveRoleModalProps {
    businessUnits: BusinessUnit[];
    onClose: () => void;
    onSave: (roleName: string, buId: string) => void;
}

export default function SaveRoleModal(props: ISaveRoleModalProps) {
    const [roleName, setRoleName] = useState<string>("")
    const [businessUnit, setBusinessUnit] = useState<string>("-1")
    const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([])

    useEffect(() => {
        if (props.businessUnits.length === 0) return

        setBusinessUnit(props.businessUnits[0]?.id)
        setBusinessUnits(props.businessUnits)
    }, [props.businessUnits])

    const saveRole = () => {
        props.onSave(roleName, businessUnit)
    }

    return (
        <div
            className="p-2 fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center"
        >
            <div
                className="bg-white p-4 rounded-lg w-full"
            >
                <div
                    className="flex justify-between items-center"
                >
                    <div
                        className="text-lg font-bold"
                    >
                        Save Role
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
                <div
                    className="flex flex-col space-y-4"
                >
                    <div
                        className="flex flex-col space-y-2"
                    >
                        <label
                            htmlFor="role"
                            className="font-bold"
                        >
                            Role Name
                        </label>
                        <input
                            onChange={(e) => setRoleName(e.target.value)}
                            type="text"
                            id="role"
                            className="border border-gray-200 p-2 rounded-md"
                            value={roleName}
                        />
                    </div>
                    <div
                        className="flex flex-col space-y-2"
                    >
                        <label
                            htmlFor="role"
                            className="font-bold"
                        >
                            Bussiness Unit
                        </label>
                        <select
                            className="border border-gray-200 p-2 rounded-md"
                            onChange={(e) => setBusinessUnit(e.target.value)}
                        >
                            {
                                businessUnits.map(bu => {
                                    return <option key={bu.id} value={bu.id}>{bu.name}</option>
                                })
                            }
                        </select>                 
                    </div>
                    <div
                        className="flex justify-end space-x-2"
                    >
                        <button
                            onClick={saveRole}
                            className="w-14 bg-blue-500 text-white p-2 rounded-md"
                        >
                            Save
                        </button>
                        <button
                            onClick={props.onClose}
                            className="w-14 bg-red-500 text-white p-2 rounded-md"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}