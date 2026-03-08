import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getStoredRol, getStoredToken, normalizeRol } from "../utils/authSession";

export default function PrivateRoute({
  allow = [],          // e.g. ["administrador","empleado","encargado"]
  adminOnly = false,   // compat
  children,            // opcional: puedes pasar children o usar <Outlet/>
}) {
  const token = getStoredToken();
  if (!token) return <Navigate to="/login" replace />;

  const rol = normalizeRol(getStoredRol());

  // compat: adminOnly gana si está true
  if (adminOnly && rol !== "administrador") return <Navigate to="/" replace />;

  // si hay lista allow, validar
  if (allow.length > 0 && !allow.map((r) => normalizeRol(r)).includes(rol)) {
    return <Navigate to="/" replace />;
  }

  return children ? children : <Outlet />;
}