/**
 * IOC Detection Engine — rule barrel (Phase 5.4).
 *
 * The only file that imports every individual rule module. `registry.ts`
 * imports `rules` from here rather than each rule file directly, so
 * registering a new rule means adding one import + one array entry here,
 * nowhere else.
 */
import type { DetectionRule } from "../types";
import { auditLogClearedRule } from "./auditLogCleared";
import { bruteForceRule } from "./bruteForce";
import { defenderDetectionRule } from "./defenderDetection";
import { defenderDisabledRule } from "./defenderDisabled";
import { encodedPowershellRule } from "./encodedPowershell";
import { newAdministratorRule } from "./newAdministrator";
import { newUserAccountRule } from "./newUserAccount";
import { powershellRule } from "./powershell";
import { rdpLogonRule } from "./rdpLogon";
import { scheduledTaskRule } from "./scheduledTask";
import { serviceInstallationRule } from "./serviceInstallation";
import { successfulLoginAfterFailuresRule } from "./successfulLoginAfterFailures";
import { usbDeviceRule } from "./usbDevice";
import { wmiPersistenceRule } from "./wmiPersistence";

export const rules: DetectionRule[] = [
  auditLogClearedRule,
  bruteForceRule,
  successfulLoginAfterFailuresRule,
  encodedPowershellRule,
  wmiPersistenceRule,
  defenderDetectionRule,
  defenderDisabledRule,
  newAdministratorRule,
  serviceInstallationRule,
  scheduledTaskRule,
  newUserAccountRule,
  rdpLogonRule,
  usbDeviceRule,
  powershellRule,
];
