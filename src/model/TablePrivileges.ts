import { Privilege } from "./Privilege";

export interface TablePrivileges {
    LogicalName: string;
    Privilages: Privilege[];
    CollectionName: string;
    CollectionLogicalName: string;
}