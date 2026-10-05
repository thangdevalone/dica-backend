export interface AuthGrant {
  id: string;
  roleCode: string;
  permissions: string[];
  scopeType:
    | "ORGANIZATION"
    | "FACILITY"
    | "STOCK_LOCATION"
    | "DEPARTMENT"
    | "OWN"
    | "SUPPLIER";
  facilityId: string | null;
  stockLocationId: string | null;
  departmentId: string | null;
}
export interface AuthUser {
  id: string;
  organizationId: string;
  supplierId: string | null;
  kind: "INTERNAL" | "SUPPLIER";
  username: string;
  displayName: string;
  sessionId: string;
  requestId: string;
  grants: AuthGrant[];
}
export interface TokenPayload {
  sub: string;
  sid: string;
  org: string;
  ver: number;
  typ: "access" | "refresh";
}
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
