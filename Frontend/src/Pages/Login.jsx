// src/Pages/Login.jsx
import React, { useEffect, useState } from "react";
import { Lock, Mail, LogIn, ShieldCheck, Loader2 } from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, isAuthenticated, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already signed in - send them straight to the panel.
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(isAdmin ? "/admin" : "/admin/all-reports", { replace: true });
    }
  }, [loading, isAuthenticated, isAdmin, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter both your email and password.");
      return;
    }

    setSubmitting(true);
    const result = await login(email.trim(), password);
    setSubmitting(false);

    if (result.success) {
      const target = result.user.role === "ADMIN" ? "/admin" : "/admin/all-reports";
      navigate(location.state?.from || target, { replace: true });
    } else {
      setError(result.message || "Invalid email or password.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 px-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl rounded-2xl p-10 shadow-2xl border border-white/10">
        <div className="flex flex-col items-center mb-8">
          <ShieldCheck size={50} className="text-red-400" />
          <h1 className="text-3xl font-bold text-white mt-4 tracking-tight">
            SafeVoice Admin
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Authorised personnel only
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="text-gray-300 text-sm mb-2 block">Email</label>
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3">
              <Mail className="text-gray-400" size={20} />
              <input
                type="email"
                autoComplete="username"
                className="w-full bg-transparent p-3 focus:outline-none text-white placeholder-gray-500"
                placeholder="you@safepath.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-gray-300 text-sm mb-2 block">Password</label>
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3">
              <Lock className="text-gray-400" size={20} />
              <input
                type="password"
                autoComplete="current-password"
                className="w-full bg-transparent p-3 focus:outline-none text-white placeholder-gray-500"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/15 border border-red-500/40 text-red-200 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-all text-white font-semibold py-3 rounded-xl shadow-lg"
          >
            {submitting ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <LogIn size={20} />
            )}
            {submitting ? "Signing in..." : "Login"}
          </button>
        </form>

        <p className="text-center text-gray-500 text-xs mt-8">
          <Link to="/" className="hover:text-gray-300">
            ← Back to the public site
          </Link>
        </p>
      </div>
    </div>
  );
}
