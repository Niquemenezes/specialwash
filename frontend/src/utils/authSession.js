export const normalizeRol = (r) => {
  const raw = (r || "").toLowerCase().trim();
  if (!raw) return "";

  const value = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (value === "admin" || value === "administrator") return "administrador";
  if (value === "employee" || value === "staff" || value === "empleado") return "detailing";
  if (value === "manager" || value === "responsable" || value.includes("encarg")) return "encargado";
  if (value === "deteiling") return "detailing";
  if (value === "quality" || value.includes("calidad")) return "calidad";
  if (value === "tapiceria" || value === "tapicería" || value === "upholstery" || value === "upholsterer" || value.includes("tapicer")) return "tapicero";
  if (value === "paint" || value === "painter" || value.includes("pintur") || value.includes("pintor")) return "pintura";
  if (value.includes("detail") || value.includes("lavado")) return "detailing";
  if (value === "other" || value === "otro") return "otro";
  return value;
};

export const isEmployeeRole = (rol) => {
  const value = normalizeRol(rol);
  return value === "detailing" || value === "pintura" || value === "tapicero";
};

export const getDefaultRouteForRole = (rol) => {
  const value = normalizeRol(rol);
  if (isEmployeeRole(value)) return "/mis-partes-trabajo";
  return "/";
};

export const roleMatches = (currentRol, allowedRol) => {
  const current = normalizeRol(currentRol);
  const allowed = normalizeRol(allowedRol);

  if (!current || !allowed) return false;
  if (current === allowed) return true;

  if (allowed === "empleado") {
    return isEmployeeRole(current);
  }

  return false;
};

export const hasAllowedRole = (currentRol, allowedRoles = []) =>
  allowedRoles.some((allowedRol) => roleMatches(currentRol, allowedRol));

export const getStoredToken = () =>
  (typeof localStorage !== "undefined" && localStorage.getItem("token")) ||
  "";

const DEFAULT_IDLE_TIMEOUT_MINUTES = 60;

const getIdleTimeoutMinutes = () => {
  const raw = process.env.REACT_APP_SESSION_IDLE_TIMEOUT_MINUTES;
  const parsed = Number.parseInt(String(raw || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_IDLE_TIMEOUT_MINUTES;
};

export const SESSION_IDLE_TIMEOUT_MS = getIdleTimeoutMinutes() * 60 * 1000;
const LAST_ACTIVITY_KEY = "sw_last_activity_at";

export const clearStoredSession = () => {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("rol");
    localStorage.removeItem("userId");
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  }
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("rol");
    sessionStorage.removeItem("userId");
  }
};

const decodeJwtPayload = (token) => {
  try {
    const payloadPart = String(token || "").split(".")[1];
    if (!payloadPart) return null;

    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const raw = atob(padded);
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const toUnixMs = (value) => {
  const n = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(n) ? n : 0;
};

export const getTokenExpiryMs = (token = getStoredToken()) => {
  if (!token) return 0;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return 0;
  return Number(payload.exp) * 1000;
};

export const isTokenExpired = (token = getStoredToken(), skewMs = 5000) => {
  const expMs = getTokenExpiryMs(token);
  if (!expMs) return false;
  return Date.now() >= (expMs - skewMs);
};

export const touchSessionActivity = () => {
  if (typeof localStorage !== "undefined") localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
};

export const getLastActivityMs = () => {
  const s = (typeof localStorage !== "undefined" && localStorage.getItem(LAST_ACTIVITY_KEY)) || "";
  return toUnixMs(s);
};

export const isSessionIdleExpired = (idleTimeoutMs = SESSION_IDLE_TIMEOUT_MS) => {
  const last = getLastActivityMs();
  if (!last) return false;
  return (Date.now() - last) >= idleTimeoutMs;
};

export const ensureActiveSession = ({ idleTimeoutMs = SESSION_IDLE_TIMEOUT_MS } = {}) => {
  const token = getStoredToken();
  if (!token) return { ok: false, reason: "missing" };
  if (isTokenExpired(token)) return { ok: false, reason: "jwt" };
  if (isSessionIdleExpired(idleTimeoutMs)) return { ok: false, reason: "idle" };
  return { ok: true, reason: "active" };
};

export const getStoredRol = () => {
  const fromStorage = normalizeRol(
    (typeof localStorage !== "undefined" && localStorage.getItem("rol")) || ""
  );

  if (fromStorage) return fromStorage;

  const token = getStoredToken();
  if (!token) return "";

  const payload = decodeJwtPayload(token);
  const fromToken = normalizeRol(payload?.rol || payload?.role || "");

  if (fromToken && typeof localStorage !== "undefined") {
    localStorage.setItem("rol", fromToken);
  }

  return fromToken;
};
