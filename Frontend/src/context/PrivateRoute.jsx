import React from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "./AuthContext";

/** Requires any authenticated staff account. */
export default function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
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

  return children;
}
