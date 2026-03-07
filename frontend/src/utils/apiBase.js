// Resolve API base URL per environment:
// 1) explicit REACT_APP_BACKEND_URL (highest priority)
// 2) Codespaces frontend URL (port 3000) -> backend URL (port 5000)
// 3) same-origin (production behind Nginx /api proxy)
export function getApiBase() {
  const explicit = (process.env.REACT_APP_BACKEND_URL || "").trim();
  if (explicit) {
    // Safety net: if a stale production build was created with a Codespaces
    // backend URL, ignore it when running on a non-Codespaces host.
    if (typeof window !== "undefined") {
      try {
        const currentHost = window.location.hostname;
        const explicitHost = new URL(explicit, window.location.origin).hostname;
        const explicitIsCodespace = explicitHost.endsWith(".app.github.dev");
        const currentIsCodespace = currentHost.endsWith(".app.github.dev");
        if (explicitIsCodespace && !currentIsCodespace) {
          return "";
        }
      } catch {
        // If URL parsing fails, keep explicit as-is.
      }
    }

    return explicit;
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (hostname.endsWith(".app.github.dev")) {
      const backendHost = hostname.replace(/-3000\./, "-5000.");
      if (backendHost !== hostname) {
        return `${protocol}//${backendHost}`;
      }
    }
  }

  return "";
}

// Build API URLs defensively so `/api` is not duplicated when both
// base and path already include it (e.g. base=/api and path=/api/auth/login_json).
export function buildApiUrl(path = "") {
  const base = getApiBase();
  const normalizedPath = String(path || "").trim();

  if (!normalizedPath) return base;
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;

  const baseNoTrailingSlash = String(base || "").replace(/\/+$/, "");
  const pathWithSlash = normalizedPath.startsWith("/")
    ? normalizedPath
    : `/${normalizedPath}`;

  const baseEndsWithApi = /\/api$/i.test(baseNoTrailingSlash);
  const pathStartsWithApi = /^\/api(\/|$)/i.test(pathWithSlash);

  if (baseEndsWithApi && pathStartsWithApi) {
    return `${baseNoTrailingSlash}${pathWithSlash.replace(/^\/api/i, "")}`;
  }

  return `${baseNoTrailingSlash}${pathWithSlash}`;
}
