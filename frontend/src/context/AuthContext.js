import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined=loading, null=guest
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem("aurax_token");
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("aurax_token");
      setUser(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (window.location.hash?.includes("session_id=")) { setLoading(false); return; }
    loadMe();
  }, [loadMe]);

  const applyAuth = (data) => {
    localStorage.setItem("aurax_token", data.token);
    setUser(data.user);
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("aurax_token");
    setUser(null);
  };

  const refresh = loadMe;

  return (
    <AuthContext.Provider value={{ user, loading, applyAuth, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
