import React from "react";
import { Outlet } from "react-router";
import AdminSidebar from "./AdminSidebar";

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-gray-100">

      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Content Area */}
      <div className="flex-1">
        
        {/* Topbar */}
        <div className="h-16 bg-white shadow flex items-center px-6 border-b">
          <h1 className="text-xl font-semibold text-gray-800">Admin Panel</h1>
        </div>

        {/* OUTLET AREA */}
        <div className="p-8">
          <Outlet />
        </div>

      </div>
    </div>
  );
}
