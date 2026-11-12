import { NavLink, useNavigate } from "react-router";
import {
  LayoutDashboard,
  FileWarning,
  Tags,
  BookOpenText,
  PhoneCall,
  Users,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const menuItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true, adminOnly: true },
  { to: "/admin/all-reports", label: "All Reports", icon: FileWarning },
  { to: "/admin/categories", label: "Categories", icon: Tags, adminOnly: true },
  { to: "/admin/guidelines", label: "Guidelines", icon: BookOpenText, adminOnly: true },
  {
    to: "/admin/emergency-contacts",
    label: "Emergency Contacts",
    icon: PhoneCall,
    adminOnly: true,
  },
  { to: "/admin/users", label: "Users", icon: Users, adminOnly: true },
  { to: "/admin/settings", label: "Settings", icon: Settings, adminOnly: true },
];

export default function AdminSidebar() {
  const navigate = useNavigate();
  const { logout, user, isAdmin } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/admin-login", { replace: true });
  };

  const base =
    "flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 transition-all duration-300";
  const active =
    "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-md shadow-red-500/20";

  const visibleItems = menuItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="w-72 min-h-screen bg-[#0D0F12] text-white border-r border-white/5 flex flex-col py-6">
      <div className="px-6 mb-8">
        <h2 className="text-2xl font-extrabold tracking-wide bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">
          SafeVoice Admin
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          {user?.full_name || "Control Center"}
        </p>
        {user?.role && (
          <span className="mt-2 inline-block text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-300">
            {user.role === "ADMIN" ? "Administrator" : "Investigator"}
          </span>
        )}
      </div>

      <nav className="px-4 space-y-2 flex-1 overflow-y-auto">
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-2 px-2">
          Main Menu
        </p>

        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? `${base} ${active}` : `${base} hover:bg-gray-800/40`
              }
            >
              <Icon size={20} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-6 mt-6">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-xl transition cursor-pointer"
        >
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </aside>
  );
}
