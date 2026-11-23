import { NavLink } from "react-router-dom";

export default function AdminNav() {
  return (
    <div className="subnav">
      <NavLink to="/admin" end>Dashboard</NavLink>
      <NavLink to="/admin/users">Users</NavLink>
      <NavLink to="/admin/reports">Reports</NavLink>
      <NavLink to="/admin/chats">Chats</NavLink>
      <NavLink to="/admin/logs">Audit log</NavLink>
    </div>
  );
}
