import { SetMetadata } from "@nestjs/common";

export const CONFIG_AUDIT_METADATA = "dica:config-audit";

export interface ConfigAuditMetadata {
  resourceType: string;
}

export const ConfigAudit = (resourceType: string) =>
  SetMetadata(CONFIG_AUDIT_METADATA, {
    resourceType,
  } satisfies ConfigAuditMetadata);
