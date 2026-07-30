import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { ALL_PERMISSIONS, type Permission } from '@/lib/permissions';

type RoleRow = {
  id: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
};

type StaffRow = {
  id: string;
  name: string;
  email: string | null;
  roleId: string;
  roleName: string;
  canAccessPanel: boolean;
  isActive: boolean;
  pinSet: boolean;
};

export default function StaffPage() {
  const [tab, setTab] = useState<'staff' | 'roles'>('staff');
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [rolePerms, setRolePerms] = useState<Permission[]>([]);

  const [staffForm, setStaffForm] = useState({
    name: '',
    roleId: '',
    pin: '',
    email: '',
    password: '',
    canAccessPanel: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, staffRes] = await Promise.all([
        api.get('/merchant/roles'),
        api.get('/merchant/staff'),
      ]);
      setRoles(rolesRes.data.roles || []);
      setStaff(staffRes.data.staff || []);
      if (!staffForm.roleId && rolesRes.data.roles?.[0]?.id) {
        setStaffForm((f) => ({ ...f, roleId: rolesRes.data.roles[0].id }));
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [staffForm.roleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openRoleEdit = (role: RoleRow) => {
    setEditingRole(role);
    setRolePerms(role.permissions as Permission[]);
  };

  const saveRole = async () => {
    if (!editingRole) return;
    try {
      await api.put(`/merchant/roles/${editingRole.id}`, { permissions: rolePerms });
      toast.success('Role updated');
      setEditingRole(null);
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to save role');
    }
  };

  const addStaff = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/merchant/staff', staffForm);
      toast.success('User created');
      setStaffForm({ name: '', roleId: roles[0]?.id || '', pin: '', email: '', password: '', canAccessPanel: false });
      void load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    }
  };

  const removeStaff = async (id: string) => {
    if (!confirm('Remove this user?')) return;
    try {
      await api.delete(`/merchant/staff/${id}`);
      toast.success('User removed');
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to remove user');
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-[var(--text-muted)]">Loading users & roles…</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold">Users & roles</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Manage staff PINs for WebPOS and Android POS. Control who can access the backend panel and which features they can use.
        </p>
      </div>

      <div className="flex gap-2 border-b border-[var(--border)]">
        {(['staff', 'roles'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? 'border-stone-900 text-stone-900' : 'border-transparent text-[var(--text-muted)]'
            }`}
          >
            {t === 'staff' ? 'Users' : 'Role profiles'}
          </button>
        ))}
      </div>

      {tab === 'staff' ? (
        <div className="space-y-6">
          <form onSubmit={addStaff} className="card p-4 space-y-3">
            <h2 className="font-medium">Add user</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                Name
                <input
                  className="input mt-1"
                  required
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                Role
                <select
                  className="input mt-1"
                  value={staffForm.roleId}
                  onChange={(e) => setStaffForm({ ...staffForm, roleId: e.target.value })}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                PIN (WebPOS / app)
                <input
                  className="input mt-1"
                  inputMode="numeric"
                  pattern="[0-9]{4,8}"
                  placeholder="4–8 digits"
                  value={staffForm.pin}
                  onChange={(e) => setStaffForm({ ...staffForm, pin: e.target.value.replace(/\D/g, '') })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm pt-6">
                <input
                  type="checkbox"
                  checked={staffForm.canAccessPanel}
                  onChange={(e) => setStaffForm({ ...staffForm, canAccessPanel: e.target.checked })}
                />
                Can access backend panel
              </label>
              {staffForm.canAccessPanel ? (
                <>
                  <label className="block text-sm">
                    Email (panel login)
                    <input
                      className="input mt-1"
                      type="email"
                      required
                      value={staffForm.email}
                      onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    Password
                    <input
                      className="input mt-1"
                      type="password"
                      required
                      minLength={8}
                      value={staffForm.password}
                      onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    />
                  </label>
                </>
              ) : null}
            </div>
            <button type="submit" className="btn-primary">
              Add user
            </button>
          </form>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-muted)] text-left">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">PIN</th>
                  <th className="px-3 py-2">Panel</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2">{s.roleName}</td>
                    <td className="px-3 py-2">{s.pinSet ? 'Set' : '—'}</td>
                    <td className="px-3 py-2">{s.canAccessPanel ? s.email || 'Yes' : 'No'}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" className="text-red-600 text-xs" onClick={() => void removeStaff(s.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="card p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{role.name}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {role.permissions.length} permissions
                  {role.isSystem ? ' — system profile' : ''}
                </p>
              </div>
              <button type="button" className="btn-secondary text-sm" onClick={() => openRoleEdit(role)}>
                Edit permissions
              </button>
            </div>
          ))}
        </div>
      )}

      {editingRole ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[85vh] overflow-auto rounded-xl bg-white dark:bg-stone-900 p-4 shadow-xl">
            <h3 className="font-semibold mb-3">Edit {editingRole.name}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {ALL_PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={rolePerms.includes(p)}
                    onChange={(e) =>
                      setRolePerms((prev) =>
                        e.target.checked ? [...prev, p] : prev.filter((x) => x !== p)
                      )
                    }
                  />
                  {p.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setEditingRole(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={() => void saveRole()}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
