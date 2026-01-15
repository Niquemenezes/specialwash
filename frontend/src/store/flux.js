// src/front/js/store/flux.js — SpecialWash (roles + módulos + candados anti-bucle)

const getState = ({ getStore, getActions, setStore }) => {
const API = process.env.REACT_APP_BACKEND_URL || "http://194.164.164.78:5000";




  // ====== Candados simples para evitar múltiples fetch en StrictMode/re-montajes ======
  let _loadingUsuarios = false;
  let _loadingProveedores = false;
  let _loadingProductos = false;
  let _loadingMaquinaria = false;
  let _loadingEntradas = false;
  let _loadingSalidas = false;
  let _loadingHistorialSalidas = false;
  let _loadingClientes = false;
  let _loadingCoches = false;
  let _loadingServicios = false;

  // ========= Helper de fetch =========
  async function apiFetch(
    path,
    {
      method = "GET",
      headers = {},
      body,
      auth = true,
      json = true,
    } = {}
  ) {
    const store = getStore();
    const url = path.startsWith("http") ? path : `${API}${path}`;
    const finalHeaders = { ...headers };

    if (json && !finalHeaders["Content-Type"] && method !== "GET" && method !== "HEAD") {
      finalHeaders["Content-Type"] = "application/json";
    }

    const token =
      store.token ||
      (typeof sessionStorage !== "undefined" && sessionStorage.getItem("token")) ||
      (typeof localStorage !== "undefined" && localStorage.getItem("token"));

    if (auth && token) finalHeaders.Authorization = `Bearer ${token}`;

    const resp = await fetch(url, {
      method,
      headers: finalHeaders,
      body: json && body && typeof body !== "string" ? JSON.stringify(body) : body,
    });

    const raw = await resp.text();
    let data = raw;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* respuesta no-JSON */ }

    if (!resp.ok) {
      const msg = (data && (data.msg || data.message)) || `HTTP ${resp.status}`;
      throw new Error(msg);
    }
    return data;
  }

  // Guarda token + rol de forma consistente
  const saveTokenAndUser = (data) => {
    const t = data?.token || data?.access_token || null;
    if (t) {
      if (typeof localStorage !== "undefined") localStorage.setItem("token", t);
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem("token", t);
    }
    const user = data?.user || null;
    if (user) {
      const rol = (user.rol || user.role || "empleado").toLowerCase();
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem("rol", rol);
      if (typeof localStorage !== "undefined") localStorage.setItem("rol", rol);
    }
    return { token: t, user };
  };

  return {
    store: {
      // Auth
      auth: false,
      token:
        (typeof sessionStorage !== "undefined" && sessionStorage.getItem("token")) ||
        (typeof localStorage !== "undefined" && localStorage.getItem("token")) ||
        null,
      user: null,

      // Datos principales
      usuarios: [],
      proveedores: [],
      productos: [],
      maquinaria: [],
      entradas: [],
      salidas: [],
      clientes: [],
      coches: [],
      servicios: [],

      // Informes
      resumenEntradas: [],
      historialSalidas: [],
      reporteGasto: { totales: { sin_iva: 0, con_iva: 0 }, mensual: [] },

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

      // ===== AUTH
      signup: async (nombre, email, password, rol = "empleado") => {
        try {
          await apiFetch("/api/signup", {
            method: "POST",
            auth: false,
            body: { nombre, email, password, rol },
          });
          // No guardamos token ni auth aquí a propósito
          return { ok: true };
        } catch (err) {
          console.error("signup:", err);
          return { ok: false, error: err.message };
        }
      },
      // (opcional) loginCookie si usas cookie-only
      loginCookie: async (email, password) => {
        try {
          const data = await apiFetch("/api/auth/login", {
            method: "POST",
            auth: false,
            body: { email, password },
          });
          const { token, user } = saveTokenAndUser(data);
          setStore({ token, auth: true, user });
          return { ok: true };
        } catch (err) {
          console.error("loginCookie:", err);
          setStore({ auth: false });
          return { ok: false, error: err.message };
        }
      },

      // login por JSON (usa Authorization en headers después)
      login: async (email, password, rol = "administrador") => {
        try {
          const data = await apiFetch("/api/auth/login_json", {
            method: "POST",
            auth: false,
            // el backend no necesita rol aquí, pero no molesta
            body: { email, password, rol },
          });
          const { token, user } = saveTokenAndUser(data);
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
            const rol = (user.rol || user.role || "empleado").toLowerCase();
            sessionStorage.setItem("rol", rol);
            localStorage.setItem("rol", rol);
          }
          setStore({ auth: true, user });
          return user;
        } catch (err) { console.error("me:", err); return null; }
      },

      logout: async () => {
        try { await apiFetch("/api/auth/logout", { method: "POST", auth: false }); } catch { /* no-op */ }
        localStorage.removeItem("token"); localStorage.removeItem("rol");
        sessionStorage.removeItem("token"); sessionStorage.removeItem("rol");
        setStore({ auth: false, token: null, user: null });
      },

      // ===== USUARIOS (ADMIN)
      getUsuarios: async () => {
        if (_loadingUsuarios) return getStore().usuarios;
        _loadingUsuarios = true;
        try {
          const data = await apiFetch("/api/usuarios", { method: "GET" });
          setStore({ usuarios: Array.isArray(data) ? data : (data?.items || []) });
          return getStore().usuarios;
        } catch (e) {
          console.error("getUsuarios:", e);
          return [];
        } finally {
          _loadingUsuarios = false;
        }
      },

      createUsuario: async (usuario) => {
        try {
          const created = await apiFetch("/api/usuarios", { method: "POST", body: usuario });
          const { usuarios } = getStore();
          setStore({ usuarios: [...usuarios, created] });
          return created;
        } catch (err) { console.error("createUsuario:", err); throw err; }
      },

      updateUsuario: async (id, usuario) => {
        try {
          const updated = await apiFetch(`/api/usuarios/${id}`, { method: "PUT", body: usuario });
          const { usuarios } = getStore();
          setStore({ usuarios: usuarios.map(u => u.id === updated.id ? updated : u) });
          return updated;
        } catch (err) { console.error("updateUsuario:", err); throw err; }
      },

      deleteUsuario: async (id) => {
        try {
          await apiFetch(`/api/usuarios/${id}`, { method: "DELETE" });
          const { usuarios } = getStore();
          setStore({ usuarios: usuarios.filter(u => u.id !== id) });
          return true;
        } catch (err) { console.error("deleteUsuario:", err); throw err; }
      },

      // ===== PROVEEDORES
      getProveedores: async () => {
        if (_loadingProveedores) return getStore().proveedores;
        _loadingProveedores = true;
        try {
          const data = await apiFetch("/api/proveedores");
          setStore({ proveedores: Array.isArray(data) ? data : (data?.items || []) });
          return getStore().proveedores;
        } catch (err) {
          console.error("getProveedores:", err);
          return [];
        } finally {
          _loadingProveedores = false;
        }
      },

      createProveedor: async (proveedor) => {
        try {
          const created = await apiFetch("/api/proveedores", { method: "POST", body: proveedor });
          const { proveedores } = getStore();
          setStore({ proveedores: [...proveedores, created] });
          return created;
        } catch (err) { console.error("createProveedor:", err); throw err; }
      },

      updateProveedor: async (id, proveedor) => {
        try {
          const updated = await apiFetch(`/api/proveedores/${id}`, { method: "PUT", body: proveedor });
          const { proveedores } = getStore();
          setStore({ proveedores: proveedores.map(p => p.id === updated.id ? updated : p) });
          return updated;
        } catch (err) { console.error("updateProveedor:", err); throw err; }
      },

      deleteProveedor: async (id) => {
        try {
          await apiFetch(`/api/proveedores/${id}`, { method: "DELETE" });
          const { proveedores } = getStore();
          setStore({ proveedores: proveedores.filter(p => p.id !== id) });
          return true;
        } catch (err) { console.error("deleteProveedor:", err); throw err; }
      },

      // ===== PRODUCTOS
      getProductos: async (opts = {}) => {
  if (_loadingProductos) return getStore().productos;
  _loadingProductos = true;
  try {
    const params = new URLSearchParams();
    if (opts.bajo_stock) params.set("bajo_stock", "true");
    if (opts.q) params.set("q", opts.q);
    if (opts.categoria) params.set("categoria", opts.categoria);

    const data = await apiFetch(`/api/productos${params.toString() ? `?${params}` : ""}`);
    setStore({ productos: Array.isArray(data) ? data : (data?.items || []) });
    return getStore().productos;
  } catch (err) {
    console.error("getProductos:", err);
    return [];
  } finally {
    _loadingProductos = false;
  }
},


      getProductosCatalogo: async () => {
        return getActions().getProductos();
      },

      createProducto: async (producto) => {
        try {
          const created = await apiFetch("/api/productos", { method: "POST", body: producto });
          const { productos } = getStore();
          setStore({ productos: [...productos, created] });
          return created;
        } catch (err) { console.error("createProducto:", err); throw err; }
      },

      updateProducto: async (id, producto) => {
        try {
          // Asegura tipos numéricos válidos si vienen como string
          const payload = { ...producto };

          if (payload.stock_minimo !== undefined) {
            payload.stock_minimo =
              payload.stock_minimo === "" || payload.stock_minimo === null
                ? 0
                : Number(payload.stock_minimo);
          }
          if (payload.stock_actual !== undefined) {
            payload.stock_actual =
              payload.stock_actual === "" || payload.stock_actual === null
                ? 0
                : Number(payload.stock_actual);
          }

          const updated = await apiFetch(`/api/productos/${id}`, {
            method: "PUT",
            body: payload
          });

          const { productos } = getStore();
          setStore({
            productos: (productos || []).map(p => (p.id === updated.id ? updated : p))
          });
          return updated;
        } catch (err) {
          console.error("updateProducto:", err);
          throw err;
        }
      },

      deleteProducto: async (id) => {
        try {
          await apiFetch(`/api/productos/${id}`, { method: "DELETE" });
          const { productos } = getStore();
          setStore({ productos: productos.filter(p => p.id !== id) });
          return true;
        } catch (err) { console.error("deleteProducto:", err); throw err; }
      },

      // ===== ENTRADAS (solo admin para crear)
      registrarEntrada: async (payload) => {
        try {
          const created = await apiFetch("/api/registro-entrada", { method: "POST", body: payload });
          return created;
        } catch (err) { console.error("registrarEntrada:", err); throw err; }
      },

      actualizarEntrada: async (id, payload) => {
        try {
          const updated = await apiFetch(`/api/registro-entrada/${id}`, { method: "PUT", body: payload });
          return updated;
        } catch (err) { console.error("actualizarEntrada:", err); throw err; }
      },

      eliminarEntrada: async (id) => {
        try {
          await apiFetch(`/api/registro-entrada/${id}`, { method: "DELETE" });
          return true;
        } catch (err) { console.error("eliminarEntrada:", err); throw err; }
      },

      getEntradas: async (params = {}) => {
        if (_loadingEntradas) return getStore().entradas;
        _loadingEntradas = true;
        try {
          const query = new URLSearchParams();
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") query.append(k, v);
          });
          const data = await apiFetch(`/api/registro-entrada${query.toString() ? `?${query}` : ""}`);
          setStore({ entradas: Array.isArray(data) ? data : (data?.items || []) });
          return getStore().entradas;
        } catch (err) {
          console.error("getEntradas:", err);
          return [];
        } finally {
          _loadingEntradas = false;
        }
      },

      getResumenEntradas: async ({ desde, hasta, proveedorId } = {}) => {
        try {
          const params = new URLSearchParams();
          if (desde) params.append("desde", desde);
          if (hasta) params.append("hasta", hasta);
          if (proveedorId) params.append("proveedor_id", proveedorId);
          const data = await apiFetch(`/api/registro-entrada${params.toString() ? `?${params}` : ""}`);
          setStore({ resumenEntradas: Array.isArray(data) ? data : (data?.items || []) });
          return getStore().resumenEntradas;
        } catch (err) {
          console.error("getResumenEntradas:", err);
          setStore({ resumenEntradas: [] });
          return [];
        }
      },

      // ===== SALIDAS (admin/empleado)
      registrarSalida: async (payload) => {
        try {
          const created = await apiFetch("/api/registro-salida", { method: "POST", body: payload });
          return created;
        } catch (err) { console.error("registrarSalida:", err); throw err; }
      },

      actualizarSalida: async (id, payload) => {
        try {
          const updated = await apiFetch(`/api/registro-salida/${id}`, { method: "PUT", body: payload });
          return updated;
        } catch (err) { console.error("actualizarSalida:", err); throw err; }
      },

      eliminarSalida: async (id) => {
        try {
          await apiFetch(`/api/registro-salida/${id}`, { method: "DELETE" });
          return true;
        } catch (err) { console.error("eliminarSalida:", err); throw err; }
      },

      getSalidas: async (params = {}, force = false) => {
        if (_loadingSalidas && !force) return getStore().salidas;
        _loadingSalidas = true;
        try {
          const query = new URLSearchParams();
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") query.append(k, v);
          });
          const data = await apiFetch(`/api/salidas${query.toString() ? `?${query}` : ""}`);
          setStore({ salidas: Array.isArray(data) ? data : (data?.items || []) });
          return getStore().salidas;
        } catch (err) {
          console.error("getSalidas:", err);
          return [];
        } finally {
          _loadingSalidas = false;
        }
      },

      getHistorialSalidas: async ({ desde, hasta, productoId } = {}, force = false) => {
        if (_loadingHistorialSalidas && !force) return getStore().historialSalidas;
        _loadingHistorialSalidas = true;
        try {
          const params = new URLSearchParams();
          if (desde) params.append("desde", desde);
          if (hasta) params.append("hasta", hasta);
          if (productoId) params.append("producto_id", productoId);
          const data = await apiFetch(`/api/salidas${params.toString() ? `?${params}` : ""}`);
          setStore({ historialSalidas: Array.isArray(data) ? data : (data?.items || []) });
          return getStore().historialSalidas;
        } catch (err) {
          console.error("getHistorialSalidas:", err);
          setStore({ historialSalidas: [] });
          return [];
        } finally {
          _loadingHistorialSalidas = false;
        }
      },

      // ===== MAQUINARIA
      getMaquinaria: async () => {
        if (_loadingMaquinaria) return getStore().maquinaria;
        _loadingMaquinaria = true;
        try {
          const data = await apiFetch("/api/maquinaria");
          setStore({ maquinaria: Array.isArray(data) ? data : (data?.items || []) });
          return getStore().maquinaria;
        } catch (err) {
          console.error("getMaquinaria:", err);
          return [];
        } finally {
          _loadingMaquinaria = false;
        }
      },

      createMaquina: async (maquina) => {
        try {
          const created = await apiFetch("/api/maquinaria", { method: "POST", body: maquina });
          const { maquinaria } = getStore();
          setStore({ maquinaria: [...maquinaria, created] });
          return created;
        } catch (err) { console.error("createMaquina:", err); throw err; }
      },

      updateMaquina: async (id, maquina) => {
        try {
          const updated = await apiFetch(`/api/maquinaria/${id}`, { method: "PUT", body: maquina });
          const { maquinaria } = getStore();
          setStore({ maquinaria: maquinaria.map(m => m.id === updated.id ? updated : m) });
          return updated;
        } catch (err) { console.error("updateMaquina:", err); throw err; }
      },

      deleteMaquina: async (id) => {
        try {
          await apiFetch(`/api/maquinaria/${id}`, { method: "DELETE" });
          const { maquinaria } = getStore();
          setStore({ maquinaria: maquinaria.filter(m => m.id !== id) });
          return true;
        } catch (err) { console.error("deleteMaquina:", err); throw err; }
      },

      // ===== Reporte extra opcional
      getReporteGastoProductos: async ({ desde, hasta, producto_id } = {}) => {
        try {
          const params = new URLSearchParams();
          if (desde) params.append("desde", desde);
          if (hasta) params.append("hasta", hasta);
          if (producto_id) params.append("producto_id", producto_id);
          const data = await apiFetch(`/api/reportes/gasto-productos${params.toString() ? `?${params}` : ""}`);
          setStore({ reporteGasto: data || { totales: { sin_iva: 0, con_iva: 0 }, mensual: [] } });
          return getStore().reporteGasto;
        } catch (err) {
          console.error("getReporteGastoProductos:", err);
          const fallback = { totales: { sin_iva: 0, con_iva: 0 }, mensual: [] };
          setStore({ reporteGasto: fallback });
          return fallback;
        }
      },

      // ===== CLIENTES =====
      getClientes: async () => {
        if (_loadingClientes) return getStore().clientes;
        _loadingClientes = true;
        try {
          const data = await apiFetch("/api/clientes");
          setStore({ clientes: data || [] });
          return data;
        } catch (err) {
          console.error("getClientes:", err);
          return [];
        } finally {
          _loadingClientes = false;
        }
      },

      crearCliente: async (payload) => {
        try {
          const created = await apiFetch("/api/clientes", { method: "POST", body: payload });
          return created;
        } catch (err) { console.error("crearCliente:", err); throw err; }
      },

      actualizarCliente: async (id, payload) => {
        try {
          const updated = await apiFetch(`/api/clientes/${id}`, { method: "PUT", body: payload });
          return updated;
        } catch (err) { console.error("actualizarCliente:", err); throw err; }
      },

      eliminarCliente: async (id) => {
        try {
          await apiFetch(`/api/clientes/${id}`, { method: "DELETE" });
          const clientes = getStore().clientes;
          setStore({ clientes: clientes.filter(c => c.id !== id) });
          return true;
        } catch (err) { console.error("eliminarCliente:", err); throw err; }
      },

      // ===== COCHES =====
      getCoches: async () => {
        if (_loadingCoches) return getStore().coches;
        _loadingCoches = true;
        try {
          const data = await apiFetch("/api/coches");
          setStore({ coches: data || [] });
          return data;
        } catch (err) {
          console.error("getCoches:", err);
          return [];
        } finally {
          _loadingCoches = false;
        }
      },

      crearCoche: async (payload) => {
        try {
          const created = await apiFetch("/api/coches", { method: "POST", body: payload });
          return created;
        } catch (err) { console.error("crearCoche:", err); throw err; }
      },

      actualizarCoche: async (id, payload) => {
        try {
          const updated = await apiFetch(`/api/coches/${id}`, { method: "PUT", body: payload });
          return updated;
        } catch (err) { console.error("actualizarCoche:", err); throw err; }
      },

      eliminarCoche: async (id) => {
        try {
          await apiFetch(`/api/coches/${id}`, { method: "DELETE" });
          const coches = getStore().coches;
          setStore({ coches: coches.filter(c => c.id !== id) });
          return true;
        } catch (err) { console.error("eliminarCoche:", err); throw err; }
      },

      // ===== SERVICIOS =====
      getServicios: async (cocheId = null) => {
        if (_loadingServicios) return getStore().servicios;
        _loadingServicios = true;
        try {
          const url = cocheId ? `/api/servicios?coche_id=${cocheId}` : "/api/servicios";
          const data = await apiFetch(url);
          setStore({ servicios: data || [] });
          return data;
        } catch (err) {
          console.error("getServicios:", err);
          return [];
        } finally {
          _loadingServicios = false;
        }
      },

      crearServicio: async (payload) => {
        try {
          const created = await apiFetch("/api/servicios", { method: "POST", body: payload });
          return created;
        } catch (err) { console.error("crearServicio:", err); throw err; }
      },

      actualizarServicio: async (id, payload) => {
        try {
          const updated = await apiFetch(`/api/servicios/${id}`, { method: "PUT", body: payload });
          return updated;
        } catch (err) { console.error("actualizarServicio:", err); throw err; }
      },

      eliminarServicio: async (id) => {
        try {
          await apiFetch(`/api/servicios/${id}`, { method: "DELETE" });
          const servicios = getStore().servicios;
          setStore({ servicios: servicios.filter(s => s.id !== id) });
          return true;
        } catch (err) { console.error("eliminarServicio:", err); throw err; }
      },

      // ===== SERVICIOS PERSONALIZADOS POR CLIENTE =====
      getServiciosCliente: async (clienteId) => {
        try {
          const data = await apiFetch(`/api/clientes/${clienteId}/servicios`);
          return Array.isArray(data) ? data : [];
        } catch (err) {
          console.error("getServiciosCliente:", err);
          return [];
        }
      },

      createServicioCliente: async (clienteId, servicio) => {
        try {
          const created = await apiFetch(`/api/clientes/${clienteId}/servicios`, {
            method: "POST",
            body: servicio
          });
          return created;
        } catch (err) {
          console.error("createServicioCliente:", err);
          throw err;
        }
      },

      updateServicioCliente: async (clienteId, servicioId, servicio) => {
        try {
          const updated = await apiFetch(`/api/clientes/${clienteId}/servicios/${servicioId}`, {
            method: "PUT",
            body: servicio
          });
          return updated;
        } catch (err) {
          console.error("updateServicioCliente:", err);
          throw err;
        }
      },

      deleteServicioCliente: async (clienteId, servicioId) => {
        try {
          await apiFetch(`/api/clientes/${clienteId}/servicios/${servicioId}`, {
            method: "DELETE"
          });
          return true;
        } catch (err) {
          console.error("deleteServicioCliente:", err);
          throw err;
        }
      },

      // ===== REPORTES =====
      getReporteClientes: async (fechaDesde, fechaHasta) => {
        try {
          const params = new URLSearchParams();
          if (fechaDesde) params.append("fecha_desde", fechaDesde);
          if (fechaHasta) params.append("fecha_hasta", fechaHasta);
          const data = await apiFetch(`/api/reportes/clientes?${params.toString()}`);
          return data;
        } catch (err) {
          console.error("getReporteClientes:", err);
          return { clientes: [], fecha_desde: fechaDesde, fecha_hasta: fechaHasta };
        }
      },
    },
  };
};

export default getState;