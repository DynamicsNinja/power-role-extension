import { useEffect, useState } from "react";
import { BusinessUnit } from "../model/BusinessUnit";
import { Role } from "../model/Role";
import Modal from "./Modal";

export interface ISaveRoleModalProps {
    businessUnits: BusinessUnit[];
    onClose: () => void;
    onCreate: (roleName: string, buId: string) => void;
    onUpdate: (roleId: string, buId: string) => void;
}

export default function SaveRoleModal(props: ISaveRoleModalProps) {
    const [roleName, setRoleName] = useState<string>("")
    const [businessUnit, setBusinessUnit] = useState<string>("-1")
    const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([])
    const [roles, setRoles] = useState<Role[]>([])

    const [creatingRole, setCreatingRole] = useState<boolean>(true)

    const [selectedRole, setSelectedRole] = useState<Role | null>(null)

    const getRoles = async (buId: string) => {
        let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        let tabId = tabs[0].id || 0;

        let message = {
            action: 'GET_ROLES',
            buId: buId
        };

        let result = await chrome.tabs.sendMessage(tabId, message);

        setRoles(result);
    }

    useEffect(() => {
        if (props.businessUnits.length === 0) return

        setBusinessUnit(props.businessUnits[0]?.id)
        setBusinessUnits(props.businessUnits)

        let buId = props.businessUnits[0]?.id
        getRoles(buId)
    }, [props.businessUnits])

    const createOrUpdateRole = () => {
        if (creatingRole) {
            props.onCreate(roleName, businessUnit)
        } else {
            if (!selectedRole) return

            props.onUpdate(selectedRole.id, businessUnit)
        }

    }

    return (
        <Modal
            onClose={props.onClose}
            title={"Save Role"}>
            <div
            className="flex flex-col space-y-2"
            >
                <div
                    className="flex flex-col space-y-2"
                >
                    <label
                        htmlFor="role"
                        className="font-bold"
                    >
                        Action
                    </label>
                    <div
                        className="flex space-x-2"
                    >

                        <input
                            onChange={() => setCreatingRole(true)}
                            type="radio"
                            id="create"
                            name="action"
                            value="create"
                            checked={creatingRole}
                        />
                        <label
                            onClick={() => setCreatingRole(true)}

                            htmlFor="create"
                            className="ml-2"
                        >
                            Create New
                        </label>


                        <input
                            onChange={() => setCreatingRole(false)}
                            type="radio"
                            id="update"
                            name="action"
                            value="update"
                            checked={!creatingRole}
                        />
                        <label
                            onClick={() => setCreatingRole(false)}
                            htmlFor="update"
                            className="ml-2"
                        >
                            Update Existing
                        </label>
                    </div>
                </div>
                {
                    creatingRole &&
                    <>
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
                    </>
                }

                {
                    !creatingRole &&
                    <>
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
                                onChange={async (e) => {
                                    let buId = e.target.value
                                    setBusinessUnit(buId);

                                    getRoles(buId)
                                }}
                            >
                                {
                                    businessUnits.map(bu => {
                                        return <option key={bu.id} value={bu.id}>{bu.name}</option>
                                    })
                                }
                            </select>
                        </div>
                        <div
                            className="flex flex-col space-y-2"
                        >
                            <label
                                htmlFor="role"
                                className="font-bold"
                            >
                                Role Name
                            </label>
                            <select
                                className="border border-gray-200 p-2 rounded-md"
                                onChange={(e) => {
                                    let roleId = e.target.value
                                    let role = roles.find(r => r.id === roleId) || null
                                    setSelectedRole(role)
                                }}
                            >
                                <option disabled value="-1">Select Role</option>
                                {
                                    roles && roles.map(role => {
                                        return <option key={role.id} value={role.id}>{role.name}</option>
                                    })
                                }
                            </select>
                        </div>
                    </>

                }

                <div
                    className="flex justify-end space-x-2"
                >
                    <button
                        onClick={createOrUpdateRole}
                        className="w-14 bg-blue-500 text-white p-2 rounded-md"
                    >
                        {creatingRole ? 'Create' : 'Update'}
                    </button>
                    <button
                        onClick={props.onClose}
                        className="w-14 bg-red-500 text-white p-2 rounded-md"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </Modal>

    )
}