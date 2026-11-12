import React, { useState } from "react";
import { NavLink, Link } from "react-router";
import {
  Menu,
  X,
  Home,
  LayoutDashboard,
  FilePenLine,
  BookOpenText,
  PhoneCall,
  Search,
  LogIn,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { href: "/", label: "Home", icon: <Home size={18} /> },
  { href: "/complaints", label: "All Complaints", icon: <LayoutDashboard size={18} /> },
  { href: "/report", label: "Report Complaint", icon: <FilePenLine size={18} /> },
  { href: "/track", label: "Track Report", icon: <Search size={18} /> },
  { href: "/emergency", label: "Emergency", icon: <PhoneCall size={18} /> },
  { href: "/guidelines", label: "Guidelines", icon: <BookOpenText size={18} /> },
];

const NavItem = ({ href, icon, label, onClick }) => (
  <NavLink
    to={href}
    onClick={onClick}
    end={href === "/"}
    className={({ isActive }) =>
      `flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
        isActive
          ? "bg-indigo-600 text-white shadow-md"
          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
      }`
    }
  >
    {icon}
    <span>{label}</span>
  </NavLink>
);

export default function ProfessionalNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <header className="w-full bg-white navbar shadow-md fixed top-0 left-0 z-[5000]">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/" className="text-2xl font-bold text-indigo-600 tracking-wide">
          SafeVoice
        </Link>

        <nav className="hidden lg:flex gap-1 items-center">
          {navItems.map((item) => (
            <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} />
          ))}

          {isAuthenticated ? (
            <Link
              to={isAdmin ? "/admin" : "/admin/reports"}
              className="ml-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700 transition"
            >
              <LayoutDashboard size={18} />
              Dashboard
            </Link>
          ) : (
            <Link
              to="/admin-login"
              className="ml-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700 transition"
            >
              <LogIn size={18} />
              Staff Login
            </Link>
          )}
        </nav>

        <button
          type="button"
          aria-label="Toggle navigation"
          className="lg:hidden p-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 transition-all"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div
        className={`lg:hidden fixed top-16 left-0 w-full bg-white shadow-lg overflow-hidden transition-all duration-300 ${
          isOpen ? "max-h-screen" : "max-h-0"
        }`}
      >
        <ul className="flex flex-col p-4 gap-2">
          {navItems.map((item) => (
            <li key={item.href}>
              <NavItem
                href={item.href}
                icon={item.icon}
                label={item.label}
                onClick={() => setIsOpen(false)}
              />
            </li>
          ))}
          <li>
            <Link
              to={isAuthenticated ? (isAdmin ? "/admin" : "/admin/reports") : "/admin-login"}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white font-medium"
            >
              <LogIn size={18} />
              {isAuthenticated ? "Dashboard" : "Staff Login"}
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}
