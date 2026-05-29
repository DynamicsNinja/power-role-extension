import { useEffect, useState } from "react";
import { BusinessUnit } from "../model/BusinessUnit";
import { Role } from "../model/Role";
import { RolePrivilegeDiff } from "../model/RolePrivilegeDiff";
import Modal from "./Modal";
import UserCombobox from "./UserCombobox";

export interface ISaveRoleModalProps {
    businessUnits: BusinessUnit[];
    solutions: any[];
    users: { id: string; name: string }[];
    onClose: () => void;
    onCreate: (roleName: string, buId: string, solutionName: string, assignUserId: string) => void;
    onUpdate: (roleId: string, buId: string) => void;
    onRequestDiff: (roleId: string) => Promise<RolePrivilegeDiff[] | null>;
}

const depthLabel = (index: number) => {
    switch (index) {
        case 0: return "User";
        case 1: return "Business Unit";
        case 2: return "Parent: Child BU";
        case 3: return "Organization";
        default: return "None";
    }
};

const actionLabel = (action: string) => (action === "AppendTo" ? "Append To" : action);

export default function SaveRoleModal(props: ISaveRoleModalProps) {
    const [roleName, setRoleName] = useState<string>("");
    const [businessUnit, setBusinessUnit] = useState<string>("-1");
    const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);

    const [solutionName, setSolutionName] = useState<string>("");
    const [solutions, setSolutions] = useState<any[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);

    const [creatingRole, setCreatingRole] = useState<boolean>(true);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [assignUserId, setAssignUserId] = useState<string>("");
    const [errorMessage, setErrorMessage] = useState<string>("");

    const [step, setStep] = useState<"form" | "review">("form");
    const [diff, setDiff] = useState<RolePrivilegeDiff[]>([]);
    const [loadingDiff, setLoadingDiff] = useState<boolean>(false);

    const getRoles = async (buId: string) => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id || 0;
        const result = await chrome.tabs.sendMessage(tabId, { action: "GET_ROLES", buId });
        setRoles(result || []);
    };

    // Business units arrive asynchronously from the parent.
    useEffect(() => {
        if (props.businessUnits.length === 0) { return; }
        setBusinessUnits(props.businessUnits);
        setBusinessUnit(prev => (prev === "-1" ? props.businessUnits[0]?.id : prev));
    }, [props.businessUnits]);

    // Solutions arrive asynchronously too (only needed for "Create new").
    useEffect(() => {
        if (props.solutions.length === 0) { return; }
        setSolutions(props.solutions);
        setSolutionName(prev => prev || props.solutions[0]?.id);
    }, [props.solutions]);

    // Load roles for the chosen business unit. Decoupled from solutions so the
    // "Update existing" list populates even before (or without) solutions.
    useEffect(() => {
        if (businessUnit && businessUnit !== "-1") {
            getRoles(businessUnit);
        }
    }, [businessUnit]);

    const create = () => {
        if (roleName === "") {
            setErrorMessage("Name should not be empty");
            return;
        }
        setErrorMessage("");
        props.onCreate(roleName, businessUnit, solutionName, assignUserId);
    };

    const reviewUpdate = async () => {
        if (!selectedRole) {
            setErrorMessage("Select a role to update");
            return;
        }
        setErrorMessage("");
        setLoadingDiff(true);
        const result = await props.onRequestDiff(selectedRole.id);
        setLoadingDiff(false);
        if (!result) { return; }
        setDiff(result);
        setStep("review");
    };

    const switchMode = (creating: boolean) => {
        setCreatingRole(creating);
        setStep("form");
        setErrorMessage("");
    };

    const changes = diff.filter(d => d.status !== "unchanged");
    const addCount = diff.filter(d => d.status === "add").length;
    const changeCount = diff.filter(d => d.status === "change").length;
    const unchangedCount = diff.length - addCount - changeCount;

    // Group the changes by table so each entity is shown once with its privileges.
    const groups = Array.from(
        changes.reduce((map, d) => {
            const group = map.get(d.logicalName)
                ?? { entity: d.entity, logicalName: d.logicalName, items: [] as RolePrivilegeDiff[] };
            group.items.push(d);
            map.set(d.logicalName, group);
            return map;
        }, new Map<string, { entity: string; logicalName: string; items: RolePrivilegeDiff[] }>()).values()
    );

    const segmentBase = "flex-1 rounded px-3 py-1.5 text-sm font-semibold transition-colors";

    return (
        <Modal onClose={props.onClose} title={step === "review" ? "Review changes" : "Save role"}>
            {step === "form" &&
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <span className="field-label">Action</span>
                        <div className="flex gap-1 rounded border border-border bg-surface-2 p-1">
                            <button
                                type="button"
                                onClick={() => switchMode(true)}
                                className={`${segmentBase} ${creatingRole ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"}`}
                            >
                                Create new
                            </button>
                            <button
                                type="button"
                                onClick={() => switchMode(false)}
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
                            <div className="flex flex-col gap-2">
                                <label htmlFor="assign-user" className="field-label">
                                    Assign to user <span className="font-normal text-fg-muted">(optional)</span>
                                </label>
                                <UserCombobox
                                    id="assign-user"
                                    users={props.users}
                                    value={assignUserId}
                                    emptyLabel="Don’t assign"
                                    onChange={setAssignUserId}
                                />
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
                                    onChange={(e) => { setBusinessUnit(e.target.value); setSelectedRole(null); }}
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
                                    value={selectedRole?.id ?? "-1"}
                                    onChange={(e) => setSelectedRole(roles.find(r => r.id === e.target.value) || null)}
                                >
                                    <option disabled value="-1">
                                        {roles.length === 0 ? "No roles in this business unit" : "Select role"}
                                    </option>
                                    {roles.map(role => (
                                        <option key={role.id} value={role.id}>{role.name}</option>
                                    ))}
                                </select>
                                {roles.length === 0 &&
                                    <p className="text-xs text-fg-muted">No roles found here — try a different business unit.</p>}
                            </div>
                        </>
                    }

                    <div className="flex items-center justify-between gap-2">
                        <div className="text-sm text-danger">{errorMessage}</div>
                        <div className="flex gap-2">
                            <button onClick={props.onClose} className="btn-ghost">Cancel</button>
                            {creatingRole
                                ? <button onClick={create} className="btn-primary">Create</button>
                                : <button
                                    onClick={reviewUpdate}
                                    disabled={!selectedRole || loadingDiff}
                                    className="btn-primary"
                                >
                                    {loadingDiff ? "Comparing…" : "Review changes"}
                                </button>}
                        </div>
                    </div>
                </div>
            }

            {step === "review" &&
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-fg-muted">
                        Updating <span className="font-semibold text-fg">{selectedRole?.name}</span>
                    </p>

                    <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-success/10 px-2 py-0.5 font-semibold text-success">{addCount} added</span>
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent">{changeCount} changed</span>
                        <span className="badge">{unchangedCount} unchanged</span>
                    </div>

                    {changes.length === 0
                        ? <div className="rounded-md border border-border bg-surface-2 p-3 text-sm text-fg-muted">
                            This role already has all recorded privileges at these depths — nothing will change.
                        </div>
                        : <ul className="max-h-72 divide-y divide-border overflow-auto rounded-md border border-border">
                            {groups.map(group => (
                                <li key={group.logicalName} className="px-3 py-2.5">
                                    <div className="mb-1.5 flex items-center justify-between gap-2">
                                        <span className="truncate text-sm font-semibold text-fg">{group.entity}</span>
                                        <span className="badge">{group.items.length}</span>
                                    </div>
                                    <ul className="flex flex-col gap-1">
                                        {group.items.map((d, i) => (
                                            <li key={i} className="flex items-center justify-between gap-3 text-sm">
                                                <span className="text-fg-muted">{actionLabel(d.action)}</span>
                                                {d.status === "add"
                                                    ? <span className="shrink-0 text-xs font-semibold text-success">Add · {depthLabel(d.toDepth)}</span>
                                                    : <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-accent">
                                                        <span className="text-fg-muted line-through">{depthLabel(d.fromDepth)}</span>
                                                        <span aria-hidden>→</span>
                                                        <span>{depthLabel(d.toDepth)}</span>
                                                    </span>}
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>}

                    <div className="flex items-center justify-between gap-2">
                        <button onClick={() => setStep("form")} className="btn-ghost">Back</button>
                        <button
                            onClick={() => selectedRole && props.onUpdate(selectedRole.id, businessUnit)}
                            className="btn-primary"
                        >
                            Update role
                        </button>
                    </div>
                </div>
            }
        </Modal>
    );
}
