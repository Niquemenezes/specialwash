import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { ensureActiveSession, getStoredRol, getStoredToken, hasAllowedRole, clearStoredSession } from "../utils/authSession";

const isDevAuthBypassEnabled = () => {
  const flag = (process.env.REACT_APP_DEV_AUTH_BYPASS || "").toLowerCase().trim();
  return ["1", "true", "yes", "on"].includes(flag);
};

export default function PrivateRoute({
  allow = [],          // e.g. ["administrador","empleado","encargado"]
  adminOnly = false,   // compat
  children,            // opcional: puedes pasar children o usar <Outlet/>
}) {
  const token = getStoredToken();
  const active = ensureActiveSession();
  const bypass = isDevAuthBypassEnabled();
  if ((!token || !active.ok) && !bypass) {
    clearStoredSession();
    return <Navigate to="/login?expired=1" replace />;
  }

  const rol = token ? getStoredRol() : "administrador";

  // compat: adminOnly gana si está true
  if (adminOnly && rol !== "administrador") return <Navigate to="/" replace />;

  // si hay lista allow, validar
  if (allow.length > 0 && !hasAllowedRole(rol, allow)) {
    return <Navigate to="/" replace />;
  }

  return children ? children : <Outlet />;
}