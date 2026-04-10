export function createClientesActions({ apiFetch, getStore, setStore }) {
  let _loadingClientes = false;
  let _loadingCoches = false;
  let _loadingServicios = false;

  return {
    // ===== CLIENTES
    getClientes: async () => {
      if (_loadingClientes) return getStore().clientes;
      _loadingClientes = true;
      try {
        const data = await apiFetch("/api/clientes");
        setStore({ clientes: data || [] });
        return data;
      } catch (err) { console.error("getClientes:", err); return []; }
      finally { _loadingClientes = false; }
    },
    crearCliente: async (payload) => {
      try { return await apiFetch("/api/clientes", { method: "POST", body: payload }); }
      catch (err) { console.error("crearCliente:", err); throw err; }
    },
    actualizarCliente: async (id, payload) => {
      try { return await apiFetch(`/api/clientes/${id}`, { method: "PUT", body: payload }); }
      catch (err) { console.error("actualizarCliente:", err); throw err; }
    },
    eliminarCliente: async (id) => {
      try {
        await apiFetch(`/api/clientes/${id}`, { method: "DELETE" });
        setStore({ clientes: getStore().clientes.filter(c => c.id !== id) });
        return true;
      } catch (err) { console.error("eliminarCliente:", err); throw err; }
    },

    // ===== COCHES
    getCoches: async () => {
      if (_loadingCoches) return getStore().coches;
      _loadingCoches = true;
      try {
        const data = await apiFetch("/api/coches");
        setStore({ coches: data || [] });
        return data;
      } catch (err) { console.error("getCoches:", err); return []; }
      finally { _loadingCoches = false; }
    },
    crearCoche: async (payload) => {
      try { return await apiFetch("/api/coches", { method: "POST", body: payload }); }
      catch (err) { console.error("crearCoche:", err); throw err; }
    },
    actualizarCoche: async (id, payload) => {
      try { return await apiFetch(`/api/coches/${id}`, { method: "PUT", body: payload }); }
      catch (err) { console.error("actualizarCoche:", err); throw err; }
    },
    eliminarCoche: async (id) => {
      try {
        await apiFetch(`/api/coches/${id}`, { method: "DELETE" });
        setStore({ coches: getStore().coches.filter(c => c.id !== id) });
        return true;
      } catch (err) { console.error("eliminarCoche:", err); throw err; }
    },

    // ===== SERVICIOS
    getServicios: async (cocheId = null) => {
      if (_loadingServicios) return getStore().servicios;
      _loadingServicios = true;
      try {
        const url = cocheId ? `/api/servicios?coche_id=${cocheId}` : "/api/servicios";
        const data = await apiFetch(url);
        setStore({ servicios: data || [] });
        return data;
      } catch (err) { console.error("getServicios:", err); return []; }
      finally { _loadingServicios = false; }
    },
    crearServicio: async (payload) => {
      try { return await apiFetch("/api/servicios", { method: "POST", body: payload }); }
      catch (err) { console.error("crearServicio:", err); throw err; }
    },
    actualizarServicio: async (id, payload) => {
      try { return await apiFetch(`/api/servicios/${id}`, { method: "PUT", body: payload }); }
      catch (err) { console.error("actualizarServicio:", err); throw err; }
    },
    eliminarServicio: async (id) => {
      try {
        await apiFetch(`/api/servicios/${id}`, { method: "DELETE" });
        setStore({ servicios: getStore().servicios.filter(s => s.id !== id) });
        return true;
      } catch (err) { console.error("eliminarServicio:", err); throw err; }
    },

    // ===== SERVICIOS PERSONALIZADOS POR CLIENTE
    getServiciosCliente: async (clienteId) => {
      try {
        const data = await apiFetch(`/api/clientes/${clienteId}/servicios`);
        return Array.isArray(data) ? data : [];
      } catch (err) { console.error("getServiciosCliente:", err); return []; }
    },
    createServicioCliente: async (clienteId, servicio) => {
      try { return await apiFetch(`/api/clientes/${clienteId}/servicios`, { method: "POST", body: servicio }); }
      catch (err) { console.error("createServicioCliente:", err); throw err; }
    },
    updateServicioCliente: async (clienteId, servicioId, servicio) => {
      try { return await apiFetch(`/api/clientes/${clienteId}/servicios/${servicioId}`, { method: "PUT", body: servicio }); }
      catch (err) { console.error("updateServicioCliente:", err); throw err; }
    },
    deleteServicioCliente: async (clienteId, servicioId) => {
      try { await apiFetch(`/api/clientes/${clienteId}/servicios/${servicioId}`, { method: "DELETE" }); return true; }
      catch (err) { console.error("deleteServicioCliente:", err); throw err; }
    },
    getServiciosCatalogo: async (soloActivos = true) => {
      try {
        const data = await apiFetch(`/api/servicios_catalogo${soloActivos ? "?activos=true" : ""}`);
        return Array.isArray(data) ? data : [];
      } catch (err) { console.error("getServiciosCatalogo:", err); return []; }
    },

    // ===== REPORTES
    getReporteClientes: async (fechaDesde, fechaHasta) => {
      try {
        const params = new URLSearchParams();
        if (fechaDesde) params.append("fecha_desde", fechaDesde);
        if (fechaHasta) params.append("fecha_hasta", fechaHasta);
        return await apiFetch(`/api/reportes/clientes?${params.toString()}`);
      } catch (err) { console.error("getReporteClientes:", err); return { clientes: [], fecha_desde: fechaDesde, fecha_hasta: fechaHasta }; }
    },
  };
}
