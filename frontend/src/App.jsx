import { Routes, Route, Link, NavLink, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Badge from "./components/Badge";
import Home from "./pages/Home";
import MapPage from "./pages/MapPage";
import InvestigatorProfile from "./pages/InvestigatorProfile";
import { useUnread } from "./UnreadContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RegisterInvestigator from "./pages/RegisterInvestigator";
import ReportCrime from "./pages/ReportCrime";
import MyReports from "./pages/MyReports";
import Messages from "./pages/Messages";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminReports from "./pages/admin/AdminReports";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminChats from "./pages/admin/AdminChats";

// Only lets the right roles in; everyone else is sent to the login page
function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="page">Loading...</p>;
  if (!user) return <Navigate to="/login" />;
  if (!roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

export default function App() {
  const { user, logout } = useAuth();
  const { count: unread } = useUnread();

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">🗺️ CrimeMap</Link>
        <nav>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/map">Full map</NavLink>
          {user?.role === "user" && (
            <>
              <NavLink to="/report">Report a crime</NavLink>
              <NavLink to="/my-reports">My reports</NavLink>
            </>
          )}
          {(user?.role === "user" || user?.role === "investigator") && (
            <NavLink to="/messages">
              Messages{unread > 0 && <span className="unread" title={`${unread} unread`}>{unread > 99 ? "99+" : unread}</span>}
            </NavLink>
          )}
          {user?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="right">
          {user ? (
            <>
              <span className="who">
                {user.role === "investigator" ? <Link to={`/investigators/${user.username}`} className="me-link">{user.username}</Link> : user.username}
                {user.role === "investigator" && user.investigator && <Badge status={user.investigator.status} jobType={user.investigator.jobType} />}
                {user.role === "admin" && <span className="badge admin">Admin</span>}
              </span>
              <button className="secondary small" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/register" className="cta">Register</NavLink>
            </>
          )}
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/investigators/:username" element={<Protected roles={["user", "investigator", "admin"]}><InvestigatorProfile /></Protected>} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register/investigator" element={<RegisterInvestigator />} />
        <Route path="/report" element={<Protected roles={["user"]}><ReportCrime /></Protected>} />
        <Route path="/my-reports" element={<Protected roles={["user"]}><MyReports /></Protected>} />
        <Route path="/messages" element={<Protected roles={["user", "investigator"]}><Messages /></Protected>} />
        <Route path="/admin" element={<Protected roles={["admin"]}><AdminDashboard /></Protected>} />
        <Route path="/admin/users" element={<Protected roles={["admin"]}><AdminUsers /></Protected>} />
        <Route path="/admin/users/:id" element={<Protected roles={["admin"]}><AdminUserDetail /></Protected>} />
        <Route path="/admin/reports" element={<Protected roles={["admin"]}><AdminReports /></Protected>} />
        <Route path="/admin/chats" element={<Protected roles={["admin"]}><AdminChats /></Protected>} />
        <Route path="/admin/logs" element={<Protected roles={["admin"]}><AdminLogs /></Protected>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}
