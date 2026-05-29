import { useEffect, useState } from "react";
import { BusinessUnit } from "../model/BusinessUnit";
import { Role } from "../model/Role";
import Modal from "./Modal";

export interface ISaveRoleModalProps {
    businessUnits: BusinessUnit[];
    solutions: any[];
    onClose: () => void;
    onCreate: (roleName: string, buId: string, solutionName: string) => void;
    onUpdate: (roleId: string, buId: string) => void;
}

export default function SaveRoleModal(props: ISaveRoleModalProps) {
    const [roleName, setRoleName] = useState<string>("")
    const [businessUnit, setBusinessUnit] = useState<string>("-1")
    const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([])

    const [solutionName, setSolutionName] = useState<string>("")
    const [solutions, setSolutions] = useState<any[]>([])
    const [roles, setRoles] = useState<Role[]>([])

    const [creatingRole, setCreatingRole] = useState<boolean>(true)

    const [selectedRole, setSelectedRole] = useState<Role | null>(null)

    const [errorMessage, setErrorMessage] = useState<string>("")

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

    const validateCreate = () => {
        if (roleName === "") {
            setErrorMessage("Name should not be empty")
            return false
        } else {
            setErrorMessage("")
            return true
        }
    }

    useEffect(() => {
        if (props.businessUnits.length === 0 || props.solutions.length === 0) return

        setBusinessUnit(props.businessUnits[0]?.id)
        setBusinessUnits(props.businessUnits)

        setSolutions(props.solutions)
        setSolutionName(props.solutions[0]?.id)

        let buId = props.businessUnits[0]?.id
        getRoles(buId)
    }, [props.businessUnits, props.solutions])

    const createOrUpdateRole = () => {
        if (creatingRole) {
            if (!validateCreate()) return

            props.onCreate(roleName, businessUnit, solutionName)
        } else {
            if (!selectedRole) return

            props.onUpdate(selectedRole.id, businessUnit)
        }
    }

    const segmentBase = "flex-1 rounded px-3 py-1.5 text-sm font-semibold transition-colors";

    return (
        <Modal
            onClose={props.onClose}
            title={"Save Role"}>
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <span className="field-label">Action</span>
                    <div className="flex gap-1 rounded border border-border bg-surface-2 p-1">
                        <button
                            type="button"
                            onClick={() => setCreatingRole(true)}
                            className={`${segmentBase} ${creatingRole ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"}`}
                        >
                            Create new
                        </button>
                        <button
                            type="button"
                            onClick={() => setCreatingRole(false)}
                            className={`${segmentBase} ${!creatingRole ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"}`}
                        >
                            Update existing
                        </button>
                    </div>
                </div>

                {creatingRole &&
                    <>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="role-name" className="field-label">Role name</label>
                            <input
                                onChange={(e) => setRoleName(e.target.value)}
                                type="text"
                                id="role-name"
                                className="input"
                                value={roleName}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="solution" className="field-label">Solution</label>
                            <select
                                id="solution"
                                className="select"
                                onChange={(e) => setSolutionName(e.target.value)}
                                value={solutionName}
                            >
                                {solutions.map(solution => (
                                    <option key={solution.id} value={solution.id}>{solution.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="business-unit-create" className="field-label">Business unit</label>
                            <select
                                id="business-unit-create"
                                className="select"
                                value={businessUnit}
                                onChange={(e) => setBusinessUnit(e.target.value)}
                            >
                                {businessUnits.map(bu => (
                                    <option key={bu.id} value={bu.id}>{bu.name}</option>
                                ))}
                            </select>
                        </div>
                    </>
                }

                {!creatingRole &&
                    <>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="business-unit-update" className="field-label">Business unit</label>
                            <select
                                id="business-unit-update"
                                className="select"
                                value={businessUnit}
                                onChange={async (e) => {
                                    let buId = e.target.value
                                    setBusinessUnit(buId);
                                    getRoles(buId)
                                }}
                            >
                                {businessUnits.map(bu => (
                                    <option key={bu.id} value={bu.id}>{bu.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="existing-role" className="field-label">Role</label>
                            <select
                                id="existing-role"
                                className="select"
                                defaultValue="-1"
                                onChange={(e) => {
                                    let roleId = e.target.value
                                    let role = roles.find(r => r.id === roleId) || null
                                    setSelectedRole(role)
                                }}
                            >
                                <option disabled value="-1">Select role</option>
                                {roles && roles.map(role => (
                                    <option key={role.id} value={role.id}>{role.name}</option>
                                ))}
                            </select>
                        </div>
                    </>
                }

                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-danger">
                        {errorMessage}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={props.onClose} className="btn-ghost">
                            Cancel
                        </button>
                        <button onClick={createOrUpdateRole} className="btn-primary">
                            {creatingRole ? 'Create' : 'Update'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}
