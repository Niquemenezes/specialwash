// src/store/flux.js — SpecialWash
// Orquestador principal: combina módulos de acciones por dominio.
// La interfaz pública (store + actions) no cambia — todos los componentes siguen funcionando igual.

import { buildApiUrl } from "../utils/apiBase";
import { clearStoredSession, ensureActiveSession, touchSessionActivity } from "../utils/authSession";
import { createAuthActions } from "./actions/authActions";
import { createInventarioActions } from "./actions/inventarioActions";
import { createClientesActions } from "./actions/clientesActions";
import { createInspeccionActions } from "./actions/inspeccionActions";

const getState = ({ getStore, getActions, setStore }) => {
  // ========= Helper de fetch centralizado =========
  async function apiFetch(
    path,
    {
      method = "GET",
      headers = {},
      body,
      auth = true,
      json = true,
      timeoutMs = 15000,
    } = {}
  ) {
    const store = getStore();
    const url = buildApiUrl(path);
    const finalHeaders = { ...headers };

    if (json && !finalHeaders["Content-Type"] && method !== "GET" && method !== "HEAD") {
      finalHeaders["Content-Type"] = "application/json";
    }

    const token =
      store.token ||
      (typeof localStorage !== "undefined" && localStorage.getItem("token")) ||
      null;

    if (auth) {
      const active = ensureActiveSession();
      if (!active.ok) {
        clearStoredSession();
        setStore({ auth: false, token: null, user: null });
        throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
      }
      touchSessionActivity();
    }

    if (auth && token) finalHeaders.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let resp;
    try {
      resp = await fetch(url, {
        method,
        headers: finalHeaders,
        body: json && body && typeof body !== "string" ? JSON.stringify(body) : body,
        signal: controller.signal,
      });
    } catch (err) {
      if (err?.name === "AbortError") {
        throw new Error("Tiempo de espera agotado. Revisa la conexión y vuelve a intentar.");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    const raw = await resp.text();
    let data = raw;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* respuesta no-JSON */ }

    if (!resp.ok) {
      if (auth && resp.status === 401) {
        clearStoredSession();
        setStore({ auth: false, token: null, user: null });
        throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
      }
      if (resp.status === 403) {
        throw new Error("No tienes permisos para realizar esta acción.");
      }
      const msg = (data && (data.msg || data.message || data.error)) || `Error del servidor (${resp.status})`;
      throw new Error(msg);
    }

    if (auth) touchSessionActivity();
    return data;
  }

  const ctx = { apiFetch, getStore, setStore };

  return {
    store: {
      // Auth
      auth: false,
      token: (typeof localStorage !== "undefined" && localStorage.getItem("token")) || null,
      user: null,

      // Inventario
      usuarios: [],
      proveedores: [],
      productos: [],
      maquinaria: [],
      entradas: [],
      salidas: [],
      gastosEmpresa: [],
      resumenEntradas: [],
      historialSalidas: [],
      reporteGasto: { totales: { sin_iva: 0, con_iva: 0 }, mensual: [] },

      // Clientes
      clientes: [],
      coches: [],
      servicios: [],

      message: null,
    },

    actions: {
      // ===== Demo / ping
      getMessage: async () => {
        try {
          const data = await apiFetch("/api/hello", { auth: false });
          setStore({ message: data?.msg || data?.message || "ok" });
          return data;
        } catch (err) { console.error("getMessage:", err); return null; }
      },

      // ===== Módulos por dominio
      ...createAuthActions(ctx),
      ...createInventarioActions(ctx),
      ...createClientesActions(ctx),
      ...createInspeccionActions(ctx),
    },
  };
};

export default getState;
