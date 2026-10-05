import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const nav = useNavigate();
  const { applyAuth } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    
    // Supabase يضع الرمز في الرابط تحت اسم access_token
    const hash = window.location.hash || "";
    const token = new URLSearchParams(hash.replace("#", "")).get("access_token");
    
    (async () => {
      if (!token) { nav("/login"); return; }
      try {
        // نرسل الرمز مباشرة للسيرفر الخاص بك الذي جهزناه لفك تشفير بيانات جوجل
        const { data } = await api.post("/auth/google/session", { session_token: token });
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
