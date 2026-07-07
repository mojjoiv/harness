export type MerchantRole = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER';

export type RoleAction =
  | 'read'
  | 'manage_merchant'
  | 'manage_merchant_resources'
  | 'manage_api_keys'
  | 'manage_webhooks';

const roleRank: Record<MerchantRole, number> = {
  OWNER: 80,
  ADMIN: 60,
  DEVELOPER: 40,
  VIEWER: 10,
};

const roleActions: Record<MerchantRole, RoleAction[]> = {
  OWNER: ['read', 'manage_merchant', 'manage_merchant_resources', 'manage_api_keys', 'manage_webhooks'],
  ADMIN: ['read', 'manage_merchant_resources', 'manage_api_keys', 'manage_webhooks'],
  DEVELOPER: ['read', 'manage_api_keys', 'manage_webhooks'],
  VIEWER: ['read'],
};

export function isMerchantRole(role: string): role is MerchantRole {
  return role in roleRank;
}

export function compareRoles(left: string, right: string): number {
  return (isMerchantRole(left) ? roleRank[left] : 0) - (isMerchantRole(right) ? roleRank[right] : 0);
}

export function hasRoleAtLeast(role: string, minimumRole: MerchantRole): boolean {
  return compareRoles(role, minimumRole) >= 0;
}

export function canPerformRoleAction(role: string, action: RoleAction): boolean {
  if (!isMerchantRole(role)) {
    return false;
  }
  return roleActions[role].includes(action);
}

export function canRead(role: string): boolean {
  return canPerformRoleAction(role, 'read');
}

export function canManageMerchant(role: string): boolean {
  return canPerformRoleAction(role, 'manage_merchant');
}

export function canManageMerchantResources(role: string): boolean {
  return canPerformRoleAction(role, 'manage_merchant_resources');
}

export function canManageApiKeys(role: string): boolean {
  return canPerformRoleAction(role, 'manage_api_keys');
}

export function canManageWebhooks(role: string): boolean {
  return canPerformRoleAction(role, 'manage_webhooks');
}
