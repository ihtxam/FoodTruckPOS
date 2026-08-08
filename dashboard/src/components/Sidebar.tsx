import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, LogOut, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';
import { APP_NAME } from '@/lib/brand';
import { useI18n } from '@/lib/i18n';

export interface SidebarLeaf {
  label: string;
  path: string;
  icon: string;
}

export interface SidebarNavEntry {
  /** Stable id for expandable groups (sessionStorage). */
  id?: string;
  label: string;
  path?: string;
  icon: string;
  children?: SidebarLeaf[];
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  menuItems: SidebarNavEntry[];
  /** Distinguishes open-state persistence per panel (e.g. merchant / superadmin). */
  panelKey?: string;
}

const STORAGE_PREFIX = 'sidebar_groups_open:';

function isPathActive(pathname: string, itemPath: string): boolean {
  const isRoot = itemPath === '/merchant' || itemPath === '/superadmin' || itemPath === '/reseller';
  if (isRoot) return pathname === itemPath;
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

function loadOpenGroups(panelKey: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + panelKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveOpenGroups(panelKey: string, open: Set<string>) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + panelKey, JSON.stringify([...open]));
  } catch {
    /* ignore quota / private mode */
  }
}

export default function Sidebar({
  isOpen,
  onToggle,
  menuItems,
  panelKey = 'default',
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const logout = useAuthStore((s) => s.logout);
  const impersonating = useAuthStore((s) => s.impersonating);
  const stopImpersonation = useAuthStore((s) => s.stopImpersonation);

  const activeGroupIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of menuItems) {
      if (!entry.id || !entry.children?.length) continue;
      if (entry.children.some((c) => isPathActive(location.pathname, c.path))) {
        ids.add(entry.id);
      }
    }
    return ids;
  }, [menuItems, location.pathname]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const stored = loadOpenGroups(panelKey);
    for (const id of activeGroupIds) stored.add(id);
    return stored;
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of activeGroupIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      if (changed) saveOpenGroups(panelKey, next);
      return changed ? next : prev;
    });
  }, [activeGroupIds, panelKey]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveOpenGroups(panelKey, next);
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const backToAdmin = () => {
    const returnUserRaw = sessionStorage.getItem('sa_return_user');
    let returnRole: string | null = null;
    try {
      returnRole = returnUserRaw ? (JSON.parse(returnUserRaw) as { role?: string }).role || null : null;
    } catch {
      returnRole = null;
    }
    if (!stopImpersonation()) {
      toast.error('Admin session expired — please sign in again');
      navigate('/login');
      return;
    }
    if (returnRole === 'reseller') {
      toast.success('Back to reseller');
      navigate('/reseller/merchants');
    } else {
      toast.success('Back to Superadmin');
      navigate('/superadmin/merchants');
    }
  };

  const closeMobile = () => {
    if (window.innerWidth < 1024) onToggle();
  };

  const linkClass = (active: boolean, nested = false) =>
    `flex items-center gap-2.5 rounded-md text-sm transition-colors ${
      nested ? 'px-2.5 py-1.5 pl-9' : 'px-2.5 py-2'
    } ${
      active
        ? 'bg-slate-700 text-white'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

  return (
    <>
      <aside
        className={`${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed lg:relative lg:translate-x-0 w-56 h-dvh max-h-dvh lg:h-full lg:max-h-full bg-slate-900 text-slate-100 transition-transform duration-200 z-40 flex flex-col shrink-0`}
      >
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-base font-semibold tracking-tight">{APP_NAME}</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">{t('panel')}</p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="lg:hidden p-1.5 rounded-md hover:bg-slate-800"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 p-2 space-y-0.5 overflow-y-auto">
          {menuItems.map((entry) => {
            const children = entry.children?.filter(Boolean) ?? [];

            if (children.length === 0 && entry.path) {
              const active = isPathActive(location.pathname, entry.path);
              return (
                <Link
                  key={entry.path}
                  to={entry.path}
                  onClick={closeMobile}
                  className={linkClass(active)}
                >
                  <span className="text-sm w-5 text-center opacity-80">{entry.icon}</span>
                  <span className="font-medium truncate">{entry.label}</span>
                </Link>
              );
            }

            if (children.length === 1 && !entry.id) {
              const only = children[0];
              const active = isPathActive(location.pathname, only.path);
              return (
                <Link
                  key={only.path}
                  to={only.path}
                  onClick={closeMobile}
                  className={linkClass(active)}
                >
                  <span className="text-sm w-5 text-center opacity-80">{only.icon || entry.icon}</span>
                  <span className="font-medium truncate">{only.label}</span>
                </Link>
              );
            }

            if (children.length === 0) return null;

            const groupId = entry.id || entry.label;
            const isOpenGroup = openGroups.has(groupId);
            const parentActive = children.some((c) => isPathActive(location.pathname, c.path));

            return (
              <div key={groupId} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(groupId)}
                  aria-expanded={isOpenGroup}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                    parentActive
                      ? 'bg-slate-800/80 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="text-sm w-5 text-center opacity-80">{entry.icon}</span>
                  <span className="font-medium truncate flex-1 text-left">{entry.label}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 opacity-70 transition-transform ${
                      isOpenGroup ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>
                {isOpenGroup && (
                  <div className="space-y-0.5">
                    {children.map((child) => {
                      const active = isPathActive(location.pathname, child.path);
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          onClick={closeMobile}
                          className={linkClass(active, true)}
                        >
                          <span className="text-sm w-4 text-center opacity-80">{child.icon}</span>
                          <span className="font-medium truncate">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-700 space-y-1.5 shrink-0 bg-slate-950">
          {impersonating && (
            <button
              type="button"
              onClick={backToAdmin}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('backToSuperadmin')}
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('logout')}
          </button>
        </div>
      </aside>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 lg:hidden z-30" onClick={onToggle} />
      )}
    </>
  );
}
