import { PrivilegeDepth } from "../enum/PrivilegeDepth";
import { PrivilegeName } from "../enum/PrivilegeName";

export interface Privilege {
    name: PrivilegeName;
    depth: PrivilegeDepth
}