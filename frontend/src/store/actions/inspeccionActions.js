export function createInspeccionActions({ apiFetch }) {
  return {
    crearInspeccion: async (payload) => {
      try { return await apiFetch("/api/inspeccion-recepcion", { method: "POST", body: payload }); }
      catch (err) { console.error("crearInspeccion:", err); throw err; }
    },
    getMisInspecciones: async () => {
      try {
        const data = await apiFetch("/api/inspeccion-recepcion");
        return Array.isArray(data) ? data : [];
      } catch (err) { console.error("getMisInspecciones:", err); return []; }
    },
    getPendientesEntrega: async () => {
      try {
        const data = await apiFetch("/api/inspeccion-recepcion/pendientes-entrega");
        return Array.isArray(data) ? data : [];
      } catch (err) { console.error("getPendientesEntrega:", err); return []; }
    },
    getInspeccion: async (id) => {
      try { return await apiFetch(`/api/inspeccion-recepcion/${id}`); }
      catch (err) { console.error("getInspeccion:", err); throw err; }
    },
    actualizarInspeccion: async (id, payload) => {
      try { return await apiFetch(`/api/inspeccion-recepcion/${id}`, { method: "PUT", body: payload }); }
      catch (err) { console.error("actualizarInspeccion:", err); throw err; }
    },
    eliminarInspeccion: async (id) => {
      try { await apiFetch(`/api/inspeccion-recepcion/${id}`, { method: "DELETE" }); return true; }
      catch (err) { console.error("eliminarInspeccion:", err); throw err; }
    },
    registrarCobroInspeccion: async (id, payload) => {
      try { return await apiFetch(`/api/inspeccion-recepcion/${id}/cobro`, { method: "POST", body: payload }); }
      catch (err) { console.error("registrarCobroInspeccion:", err); throw err; }
    },
    registrarEntregaInspeccion: async (id, payload) => {
      try { return await apiFetch(`/api/inspeccion-recepcion/${id}/entrega`, { method: "POST", body: payload }); }
      catch (err) { console.error("registrarEntregaInspeccion:", err); throw err; }
    },
    guardarRepasoInspeccion: async (id, payload) => {
      try { return await apiFetch(`/api/inspeccion-recepcion/${id}/repaso`, { method: "POST", body: payload }); }
      catch (err) { console.error("guardarRepasoInspeccion:", err); throw err; }
    },
    guardarActaInspeccion: async (id, payload) => {
      try { return await apiFetch(`/api/inspeccion-recepcion/${id}/acta`, { method: "POST", body: payload }); }
      catch (err) { console.error("guardarActaInspeccion:", err); throw err; }
    },
    sugerirActaInspeccion: async (id, payload) => {
      try { return await apiFetch(`/api/inspeccion-recepcion/${id}/sugerir-acta`, { method: "POST", body: payload }); }
      catch (err) { console.error("sugerirActaInspeccion:", err); throw err; }
    },
    chatActaInspeccion: async (id, payload) => {
      try { return await apiFetch(`/api/inspeccion-recepcion/${id}/chat-acta`, { method: "POST", body: payload }); }
      catch (err) { console.error("chatActaInspeccion:", err); throw err; }
    },
    subirFotoInspeccion: async (inspeccionId, archivo) => {
      try {
        const formData = new FormData();
        formData.append("file", archivo);
        return await apiFetch(`/api/inspeccion-recepcion/${inspeccionId}/upload-foto`, { method: "POST", body: formData, json: false, headers: {} });
      } catch (err) { console.error("subirFotoInspeccion:", err); throw err; }
    },
    subirVideoInspeccion: async (inspeccionId, archivo) => {
      try {
        const formData = new FormData();
        formData.append("file", archivo);
        return await apiFetch(`/api/inspeccion-recepcion/${inspeccionId}/upload-video`, { method: "POST", body: formData, json: false, headers: {} });
      } catch (err) { console.error("subirVideoInspeccion:", err); throw err; }
    },
    getDashboard: async (anio = new Date().getFullYear()) => {
      try { return await apiFetch(`/api/dashboard?anio=${anio}`); }
      catch (err) { console.error("getDashboard:", err); throw err; }
    },
    getCobrosProfesionales: async ({ soloPendientes = true } = {}) => {
      try {
        const params = new URLSearchParams();
        params.append("solo_pendientes", soloPendientes ? "1" : "0");
        const data = await apiFetch(`/api/inspeccion-recepcion/cobros/profesionales?${params.toString()}`);
        return Array.isArray(data) ? data : [];
      } catch (err) { console.error("getCobrosProfesionales:", err); return []; }
    },
    getPagosProfesionalesPendientes: async () => {
      try {
        const data = await apiFetch("/api/inspeccion-recepcion/profesionales/pagos-pendientes");
        return Array.isArray(data) ? data : [];
      } catch (err) { console.error("getPagosProfesionalesPendientes:", err); return []; }
    },
    registrarPagoProfesional: async (id, payload) => {
      try { return await apiFetch(`/api/inspeccion-recepcion/${id}/registrar-pago-profesional`, { method: "POST", body: payload }); }
      catch (err) { console.error("registrarPagoProfesional:", err); throw err; }
    },
    registrarPagoProesional: async (id, payload) => {
      try { return await apiFetch(`/api/inspeccion-recepcion/${id}/pago-profesional`, { method: "POST", body: payload }); }
      catch (err) { console.error("registrarPagoProesional:", err); throw err; }
    },
    getNotificaciones: async () => {
      try { return await apiFetch("/api/notificaciones"); }
      catch { return []; }
    },
    contarNoLeidas: async () => {
      try {
        const data = await apiFetch("/api/notificaciones/no-leidas");
        return data?.count ?? 0;
      } catch { return 0; }
    },
    marcarNotificacionLeida: async (id) => {
      try { return await apiFetch(`/api/notificaciones/${id}/leida`, { method: "PATCH" }); }
      catch { return null; }
    },
    marcarTodasLeidas: async () => {
      try { return await apiFetch("/api/notificaciones/marcar-todas", { method: "PATCH" }); }
      catch { return null; }
    },
  };
}
