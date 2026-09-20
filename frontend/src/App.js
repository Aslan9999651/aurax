import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CryptoProvider } from "./context/CryptoContext";
import Layout from "./components/Layout";
import AuthCallback from "./components/AuthCallback";
import Home from "./pages/Home";
import Markets from "./pages/Markets";
import Spot from "./pages/Spot";
import Futures from "./pages/Futures";
import Wallet from "./pages/Wallet";
import VerificationFees from "./pages/VerificationFees";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Admin from "./pages/Admin";

function Protected({ children, admin }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--ax-text2)]">جاري التحميل…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
      <Route path="/*" element={
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/spot" element={<Spot />} />
            <Route path="/futures" element={<Futures />} />
            <Route path="/wallet" element={<Protected><Wallet /></Protected>} />
            <Route path="/verification-fees" element={<Protected><VerificationFees /></Protected>} />
          </Routes>
        </Layout>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <CryptoProvider>
          <BrowserRouter>
            <AppRoutes />
            <Toaster position="top-left" theme="dark" toastOptions={{ style: { background: "#121721", border: "1px solid #1E293B", color: "#F8FAFC" } }} />
          </BrowserRouter>
        </CryptoProvider>
      </AuthProvider>
    </div>
  );
}
