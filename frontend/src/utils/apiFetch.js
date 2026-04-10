/**
 * apiFetch — helper de fetch centralizado para SpecialWash.
 *
 * Úsalo en utils/*, pages/* o cualquier módulo que no tenga acceso al store de flux.
 * flux.js tiene su propia variante que además actualiza el store; no la reemplaces.
 *
 * Capacidades:
 *  - Timeout configurable (default 15 s)
 *  - Comprueba sesión activa antes de cada petición autenticada
 *  - Redirige a /login cuando la sesión expira (401)
 *  - Extrae el mensaje de error de msg | message | error
 *  - No fuerza Content-Type para que FormData funcione con multipart
 *  - Maneja errores de red con mensaje legible
 */
import { buildApiUrl } from "./apiBase";
import { clearStoredSession, ensureActiveSession, getStoredToken, touchSessionActivity } from "./authSession";

export async function apiFetch(path, options = {}) {
  const {
    auth = true,
    headers = {},
    body,
    timeoutMs = 15000,
    ...rest
  } = options;

  const finalHeaders = { ...headers };

  // JSON automático: solo si el body es un objeto (no FormData, no string)
  const isJsonBody = body && typeof body === "object" && !(body instanceof FormData);
  if (isJsonBody && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }

  // Sesión
  if (auth) {
    const active = ensureActiveSession();
    if (!active.ok) {
      clearStoredSession();
      if (typeof window !== "undefined") {
        window.location.replace("/login?expired=1");
      }
      throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
    }
    touchSessionActivity();
    const token = getStoredToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  // Timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(buildApiUrl(path), {
      ...rest,
      headers: finalHeaders,
      body: isJsonBody ? JSON.stringify(body) : body,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("Tiempo de espera agotado. Revisa la conexión e inténtalo de nuevo.");
    }
    throw new Error("No se pudo conectar con el servidor.");
  } finally {
    clearTimeout(timeoutId);
  }

  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }

  if (!res.ok) {
    if (auth && res.status === 401) {
      clearStoredSession();
      if (typeof window !== "undefined") {
        window.location.replace("/login?expired=1");
      }
      throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
    }
    if (res.status === 403) {
      throw new Error("No tienes permisos para realizar esta acción.");
    }
    const msg = (data && (data.msg || data.message || data.error)) || `Error del servidor (${res.status})`;
    throw new Error(msg);
  }

  if (auth) touchSessionActivity();
  return data;
}
