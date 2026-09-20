import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const nav = useNavigate();
  const { applyAuth } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const hash = window.location.hash || "";
    const sid = new URLSearchParams(hash.replace("#", "")).get("session_id");
    (async () => {
      if (!sid) { nav("/login"); return; }
      try {
        const { data } = await api.post("/auth/google/session", { session_id: sid });
        applyAuth(data);
        window.history.replaceState(null, "", "/wallet");
        nav("/wallet");
      } catch {
        nav("/login");
      }
    })();
  }, [nav, applyAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center text-[var(--ax-text2)]">
      جاري تسجيل الدخول…
    </div>
  );
}
