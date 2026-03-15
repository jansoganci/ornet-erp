import { useCurrentProfile } from '../features/subscriptions/hooks';

export const ROLES = {
  ADMIN: 'admin',
  ACCOUNTANT: 'accountant',
  FIELD_WORKER: 'field_worker',
};

export function useRole() {
  const { data: profile } = useCurrentProfile();
  const role = profile?.role;

  return {
    role,
    isAdmin: role === ROLES.ADMIN,
    isAccountant: role === ROLES.ACCOUNTANT,
    isFieldWorker: role === ROLES.FIELD_WORKER,
    canWrite: role === ROLES.ADMIN || role === ROLES.ACCOUNTANT,
  };
}
