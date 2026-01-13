export const ADMIN_ROLES = ['superadmin', 'admin', 'manager', 'finance', 'support'];

export const isRoleAllowed = (adminRole, allowedRoles = []) => {
  if (!adminRole) return false;
  const role = String(adminRole).toLowerCase();
  if (role === 'superadmin') return true;
  return allowedRoles.map(r => String(r).toLowerCase()).includes(role);
};

// Keep aligned with backend RBAC in `backend/server.py`
// Finance role is restricted to only deposits and withdrawals
export const ADMIN_ROUTE_ROLES = {
  '/admin': ['support', 'finance', 'manager', 'admin', 'superadmin'],
  '/admin/users': ['support', 'manager', 'admin', 'superadmin'],
  '/admin/kyc': ['support', 'manager', 'admin', 'superadmin'],
  '/admin/deposits': ['finance', 'manager', 'admin', 'superadmin'],
  '/admin/withdrawals': ['finance', 'manager', 'admin', 'superadmin'],
  '/admin/rates': ['admin', 'superadmin'],
  '/admin/fees': ['admin', 'superadmin'],
  '/admin/payment-gateway': ['manager', 'admin', 'superadmin'],
  '/admin/bulk-email': ['manager', 'admin', 'superadmin'],
  '/admin/virtual-cards': ['support', 'manager', 'admin', 'superadmin'],
  '/admin/topup': ['support', 'manager', 'admin', 'superadmin'],
  '/admin/logs': ['manager', 'admin', 'superadmin'],
  '/admin/webhook-events': ['manager', 'admin', 'superadmin'],
  '/admin/agent-settings': ['manager', 'admin', 'superadmin'],
  '/admin/agent-deposits': ['manager', 'admin', 'superadmin'],
  '/admin/agent-commission-withdrawals': ['manager', 'admin', 'superadmin'],
  // System-level - Admin can access team and settings
  '/admin/team': ['admin', 'superadmin'],
  '/admin/settings': ['admin', 'superadmin'],
  '/admin/rbac': ['admin', 'superadmin'],
  '/admin/rbac-permissions': ['admin', 'superadmin'],
};

export const canAccessAdminRoute = (adminRole, path) => {
  if (!adminRole) return false;

  // Exact mapping first, then fallback to prefix matching.
  if (ADMIN_ROUTE_ROLES[path]) {
    return isRoleAllowed(adminRole, ADMIN_ROUTE_ROLES[path]);
  }

  const entries = Object.entries(ADMIN_ROUTE_ROLES);
  const match = entries.find(([route]) => path === route || path.startsWith(`${route}/`));
  if (!match) return false;
  const [, roles] = match;
  return isRoleAllowed(adminRole, roles);
};

