import React from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "./AuthContext";

/** Requires an ADMIN role account. */
export default function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-500">Checking your session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin-login" state={{ from: location.pathname }} replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10 max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Administrator access required</h2>
          <p className="text-gray-600">
            Your account is signed in, but this area is restricted to administrators.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
