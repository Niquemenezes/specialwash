import { clearStoredSession, touchSessionActivity } from "../../utils/authSession";

export function createAuthActions({ apiFetch, setStore }) {
  const saveTokenAndUser = (data) => {
    const t = data?.token || data?.access_token || null;
    if (t) {
      localStorage.setItem("token", t);
    }
    const user = data?.user || null;
    if (user) {
      const rol = (user.rol || user.role || "detailing").toLowerCase();
      localStorage.setItem("rol", rol);
      if (user.id) localStorage.setItem("userId", user.id);
    }
    return { token: t, user };
  };

  return {
    signup: async (nombre, email, password, rol = "detailing") => {
      try {
        await apiFetch("/api/signup", { method: "POST", auth: false, body: { nombre, email, password, rol } });
        return { ok: true };
      } catch (err) {
        console.error("signup:", err);
        return { ok: false, error: err.message };
      }
    },

    loginCookie: async (email, password) => {
      try {
        const data = await apiFetch("/api/auth/login_json", { method: "POST", auth: false, body: { email, password } });
        const { token, user } = saveTokenAndUser(data);
        touchSessionActivity();
        setStore({ token, auth: true, user });
        return { ok: true };
      } catch (err) {
        console.error("loginCookie:", err);
        setStore({ auth: false });
        return { ok: false, error: err.message };
      }
    },

    login: async (email, password, rol = "administrador") => {
      try {
        const data = await apiFetch("/api/auth/login_json", { method: "POST", auth: false, body: { email, password, rol } });
        const { token, user } = saveTokenAndUser(data);
        touchSessionActivity();
        setStore({ token, auth: true, user });
        return { ok: true, user, token };
      } catch (err) {
        console.error("login:", err);
        setStore({ auth: false });
        return { ok: false, error: err.message };
      }
    },

    me: async () => {
      try {
        const data = await apiFetch("/api/auth/me");
        const user = data?.user || null;
        if (user) {
          const rol = (user.rol || user.role || "detailing").toLowerCase();
          localStorage.setItem("rol", rol);
          if (user.id) localStorage.setItem("userId", user.id);
        }
        setStore({ auth: true, user });
        return user;
      } catch (err) {
        console.error("me:", err);
        return null;
      }
    },

    logout: async () => {
      try { await apiFetch("/api/auth/logout", { method: "POST", auth: false }); } catch { /* no-op */ }
      clearStoredSession();
      setStore({ auth: false, token: null, user: null });
    },
  };
}
