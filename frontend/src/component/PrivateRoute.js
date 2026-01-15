import React from "react";
import { Navigate, Outlet } from "react-router-dom";

const getStored = (k) =>
  (typeof sessionStorage !== "undefined" && sessionStorage.getItem(k)) ||
  (typeof localStorage !== "undefined" && localStorage.getItem(k)) ||
  "";

const normalizeRol = (r) => {
  r = (r || "").toLowerCase().trim();
  if (r === "admin" || r === "administrator") return "administrador";
  if (r === "employee" || r === "staff") return "empleado";
  if (r === "manager" || r === "responsable") return "encargado";
  return r;
};

export default function PrivateRoute({
  allow = [],          // e.g. ["administrador","empleado","encargado"]
  adminOnly = false,   // compat
  children,            // opcional: puedes pasar children o usar <Outlet/>
}) {
  const token = getStored("token");
  if (!token) return <Navigate to="/login" replace />;

  const rol = normalizeRol(getStored("rol"));

  // compat: adminOnly gana si está true
  if (adminOnly && rol !== "administrador") return <Navigate to="/" replace />;

  // si hay lista allow, validar
  if (allow.length > 0 && !allow.map((r) => normalizeRol(r)).includes(rol)) {
    return <Navigate to="/" replace />;
  }

  return children ? children : <Outlet />;
}