export const normalizeRol = (r) => {
  const value = (r || "").toLowerCase().trim();
  if (value === "admin" || value === "administrator") return "administrador";
  if (value === "employee" || value === "staff") return "empleado";
  if (value === "detailing" || value === "pintura") return "empleado";
  if (value === "manager" || value === "responsable") return "encargado";
  return value;
};

export const getStoredToken = () =>
  (typeof sessionStorage !== "undefined" && sessionStorage.getItem("token")) ||
  (typeof localStorage !== "undefined" && localStorage.getItem("token")) ||
  "";

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

export const getStoredRol = () => {
  const fromStorage = normalizeRol(
    (typeof sessionStorage !== "undefined" && sessionStorage.getItem("rol")) ||
      (typeof localStorage !== "undefined" && localStorage.getItem("rol")) ||
      ""
  );

  if (fromStorage) return fromStorage;

  const token = getStoredToken();
  if (!token) return "";

  const payload = decodeJwtPayload(token);
  const fromToken = normalizeRol(payload?.rol || payload?.role || "");

  if (fromToken) {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem("rol", fromToken);
    if (typeof localStorage !== "undefined") localStorage.setItem("rol", fromToken);
  }

  return fromToken;
};
