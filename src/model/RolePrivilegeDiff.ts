export interface RolePrivilegeDiff {
    entity: string;       // display (collection) name
    logicalName: string;
    action: string;       // privilege action, e.g. 'Read', 'AppendTo'
    status: 'add' | 'change' | 'unchanged';
    fromDepth: number;    // depth index currently on the role, -1 when absent
    toDepth: number;      // depth index after the update (clamped to allowed max)
}
