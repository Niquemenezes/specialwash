import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getStoredRol, getStoredToken, normalizeRol } from "../utils/authSession";

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
  const bypass = isDevAuthBypassEnabled();
  if (!token && !bypass) return <Navigate to="/login" replace />;

  const rol = token ? normalizeRol(getStoredRol()) : "administrador";

  // compat: adminOnly gana si está true
  if (adminOnly && rol !== "administrador") return <Navigate to="/" replace />;

  // si hay lista allow, validar
  if (allow.length > 0 && !allow.map((r) => normalizeRol(r)).includes(rol)) {
    return <Navigate to="/" replace />;
  }

  return children ? children : <Outlet />;
}