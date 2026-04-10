export function createInventarioActions({ apiFetch, getStore, setStore }) {
  let _loadingUsuarios = false;
  let _loadingProveedores = false;
  let _loadingProductos = false;
  let _loadingMaquinaria = false;
  let _loadingEntradas = false;
  let _loadingSalidas = false;
  let _loadingHistorialSalidas = false;
  let _loadingGastosEmpresa = false;

  return {
    // ===== USUARIOS
    getUsuarios: async () => {
      if (_loadingUsuarios) return getStore().usuarios;
      _loadingUsuarios = true;
      try {
        const data = await apiFetch("/api/usuarios");
        setStore({ usuarios: Array.isArray(data) ? data : (data?.items || []) });
        return getStore().usuarios;
      } catch (e) { console.error("getUsuarios:", e); throw e; }
      finally { _loadingUsuarios = false; }
    },
    createUsuario: async (usuario) => {
      try {
        const created = await apiFetch("/api/usuarios", { method: "POST", body: usuario });
        setStore({ usuarios: [...getStore().usuarios, created] });
        return created;
      } catch (err) { console.error("createUsuario:", err); throw err; }
    },
    updateUsuario: async (id, usuario) => {
      try {
        const updated = await apiFetch(`/api/usuarios/${id}`, { method: "PUT", body: usuario });
        setStore({ usuarios: getStore().usuarios.map(u => u.id === updated.id ? updated : u) });
        return updated;
      } catch (err) { console.error("updateUsuario:", err); throw err; }
    },
    deleteUsuario: async (id) => {
      try {
        await apiFetch(`/api/usuarios/${id}`, { method: "DELETE" });
        setStore({ usuarios: getStore().usuarios.filter(u => u.id !== id) });
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
      } catch (err) { console.error("getProveedores:", err); return []; }
      finally { _loadingProveedores = false; }
    },
    createProveedor: async (p) => {
      try {
        const created = await apiFetch("/api/proveedores", { method: "POST", body: p });
        setStore({ proveedores: [...getStore().proveedores, created] });
        return created;
      } catch (err) { console.error("createProveedor:", err); throw err; }
    },
    updateProveedor: async (id, p) => {
      try {
        const updated = await apiFetch(`/api/proveedores/${id}`, { method: "PUT", body: p });
        setStore({ proveedores: getStore().proveedores.map(x => x.id === updated.id ? updated : x) });
        return updated;
      } catch (err) { console.error("updateProveedor:", err); throw err; }
    },
    deleteProveedor: async (id) => {
      try {
        await apiFetch(`/api/proveedores/${id}`, { method: "DELETE" });
        setStore({ proveedores: getStore().proveedores.filter(x => x.id !== id) });
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
      } catch (err) { console.error("getProductos:", err); return []; }
      finally { _loadingProductos = false; }
    },
    getProductosCatalogo: async () => {
      if (_loadingProductos) return getStore().productos;
      _loadingProductos = true;
      try {
        const data = await apiFetch("/api/productos");
        setStore({ productos: Array.isArray(data) ? data : (data?.items || []) });
        return getStore().productos;
      } catch (err) { console.error("getProductosCatalogo:", err); return []; }
      finally { _loadingProductos = false; }
    },
    getProductoPorCodigoBarras: async (codigoBarras) => {
      try {
        const codigo = encodeURIComponent(String(codigoBarras || "").trim());
        if (!codigo) throw new Error("Codigo de barras vacio");
        return await apiFetch(`/api/productos/barcode/${codigo}`);
      } catch (err) { console.error("getProductoPorCodigoBarras:", err); throw err; }
    },
    createProducto: async (producto) => {
      try {
        const created = await apiFetch("/api/productos", { method: "POST", body: producto });
        setStore({ productos: [...getStore().productos, created] });
        return created;
      } catch (err) { console.error("createProducto:", err); throw err; }
    },
    updateProducto: async (id, producto) => {
      try {
        const payload = { ...producto };
        if (payload.stock_minimo !== undefined) payload.stock_minimo = payload.stock_minimo === "" || payload.stock_minimo === null ? 0 : Number(payload.stock_minimo);
        if (payload.stock_actual !== undefined) payload.stock_actual = payload.stock_actual === "" || payload.stock_actual === null ? 0 : Number(payload.stock_actual);
        const updated = await apiFetch(`/api/productos/${id}`, { method: "PUT", body: payload });
        setStore({ productos: (getStore().productos || []).map(p => p.id === updated.id ? updated : p) });
        return updated;
      } catch (err) { console.error("updateProducto:", err); throw err; }
    },
    deleteProducto: async (id) => {
      try {
        await apiFetch(`/api/productos/${id}`, { method: "DELETE" });
        setStore({ productos: getStore().productos.filter(p => p.id !== id) });
        return true;
      } catch (err) { console.error("deleteProducto:", err); throw err; }
    },

    // ===== ENTRADAS
    registrarEntrada: async (payload) => {
      try { return await apiFetch("/api/registro-entrada", { method: "POST", body: payload }); }
      catch (err) { console.error("registrarEntrada:", err); throw err; }
    },
    sugerirEntradaOCR: async (archivo) => {
      try {
        const formData = new FormData();
        formData.append("file", archivo);
        return await apiFetch("/api/registro-entrada/ocr-sugerencia", { method: "POST", body: formData, json: false, headers: {} });
      } catch (err) { console.error("sugerirEntradaOCR:", err); throw err; }
    },
    actualizarEntrada: async (id, payload) => {
      try { return await apiFetch(`/api/registro-entrada/${id}`, { method: "PUT", body: payload }); }
      catch (err) { console.error("actualizarEntrada:", err); throw err; }
    },
    eliminarEntrada: async (id) => {
      try { await apiFetch(`/api/registro-entrada/${id}`, { method: "DELETE" }); return true; }
      catch (err) { console.error("eliminarEntrada:", err); throw err; }
    },
    getEntradas: async (params = {}) => {
      if (_loadingEntradas) return getStore().entradas;
      _loadingEntradas = true;
      try {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") query.append(k, v); });
        const data = await apiFetch(`/api/registro-entrada${query.toString() ? `?${query}` : ""}`);
        setStore({ entradas: Array.isArray(data) ? data : (data?.items || []) });
        return getStore().entradas;
      } catch (err) { console.error("getEntradas:", err); return []; }
      finally { _loadingEntradas = false; }
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
      } catch (err) { console.error("getResumenEntradas:", err); setStore({ resumenEntradas: [] }); return []; }
    },

    // ===== SALIDAS
    registrarSalida: async (payload) => {
      try { return await apiFetch("/api/registro-salida", { method: "POST", body: payload }); }
      catch (err) { console.error("registrarSalida:", err); throw err; }
    },
    actualizarSalida: async (id, payload) => {
      try { return await apiFetch(`/api/registro-salida/${id}`, { method: "PUT", body: payload }); }
      catch (err) { console.error("actualizarSalida:", err); throw err; }
    },
    eliminarSalida: async (id) => {
      try { await apiFetch(`/api/registro-salida/${id}`, { method: "DELETE" }); return true; }
      catch (err) { console.error("eliminarSalida:", err); throw err; }
    },
    getSalidas: async (params = {}, force = false) => {
      if (_loadingSalidas && !force) return getStore().salidas;
      _loadingSalidas = true;
      try {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") query.append(k, v); });
        const data = await apiFetch(`/api/salidas${query.toString() ? `?${query}` : ""}`);
        setStore({ salidas: Array.isArray(data) ? data : (data?.items || []) });
        return getStore().salidas;
      } catch (err) { console.error("getSalidas:", err); return []; }
      finally { _loadingSalidas = false; }
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
      } catch (err) { console.error("getHistorialSalidas:", err); setStore({ historialSalidas: [] }); return []; }
      finally { _loadingHistorialSalidas = false; }
    },

    // ===== MAQUINARIA
    getMaquinaria: async () => {
      if (_loadingMaquinaria) return getStore().maquinaria;
      _loadingMaquinaria = true;
      try {
        const data = await apiFetch("/api/maquinaria");
        setStore({ maquinaria: Array.isArray(data) ? data : (data?.items || []) });
        return getStore().maquinaria;
      } catch (err) { console.error("getMaquinaria:", err); return []; }
      finally { _loadingMaquinaria = false; }
    },
    createMaquina: async (maquina) => {
      try {
        const created = await apiFetch("/api/maquinaria", { method: "POST", body: maquina });
        setStore({ maquinaria: [...getStore().maquinaria, created] });
        return created;
      } catch (err) { console.error("createMaquina:", err); throw err; }
    },
    sugerirMaquinariaOCR: async (archivo) => {
      try {
        const formData = new FormData();
        formData.append("file", archivo);
        return await apiFetch("/api/maquinaria/ocr-sugerencia", { method: "POST", body: formData, json: false, headers: {} });
      } catch (err) { console.error("sugerirMaquinariaOCR:", err); throw err; }
    },
    subirFacturaMaquinaria: async (maquinariaId, archivo) => {
      try {
        const formData = new FormData();
        formData.append("file", archivo);
        const data = await apiFetch(`/api/maquinaria/${maquinariaId}/upload-factura`, { method: "POST", body: formData, json: false, headers: {} });
        if (data?.maquinaria?.id) setStore({ maquinaria: getStore().maquinaria.map(m => m.id === data.maquinaria.id ? data.maquinaria : m) });
        return data;
      } catch (err) { console.error("subirFacturaMaquinaria:", err); throw err; }
    },
    eliminarFacturaMaquinaria: async (maquinariaId, facturaIndex) => {
      try {
        const data = await apiFetch(`/api/maquinaria/${maquinariaId}/factura/${facturaIndex}`, { method: "DELETE" });
        if (data?.maquinaria?.id) setStore({ maquinaria: getStore().maquinaria.map(m => m.id === data.maquinaria.id ? data.maquinaria : m) });
        return data;
      } catch (err) { console.error("eliminarFacturaMaquinaria:", err); throw err; }
    },
    updateMaquina: async (id, maquina) => {
      try {
        const updated = await apiFetch(`/api/maquinaria/${id}`, { method: "PUT", body: maquina });
        setStore({ maquinaria: getStore().maquinaria.map(m => m.id === updated.id ? updated : m) });
        return updated;
      } catch (err) { console.error("updateMaquina:", err); throw err; }
    },
    deleteMaquina: async (id) => {
      try {
        await apiFetch(`/api/maquinaria/${id}`, { method: "DELETE" });
        setStore({ maquinaria: getStore().maquinaria.filter(m => m.id !== id) });
        return true;
      } catch (err) { console.error("deleteMaquina:", err); throw err; }
    },

    // ===== GASTOS EMPRESA
    getGastosEmpresa: async ({ desde, hasta, categoria, q } = {}) => {
      if (_loadingGastosEmpresa) return { items: getStore().gastosEmpresa || [], total: 0, count: 0 };
      _loadingGastosEmpresa = true;
      try {
        const params = new URLSearchParams();
        if (desde) params.append("desde", desde);
        if (hasta) params.append("hasta", hasta);
        if (categoria) params.append("categoria", categoria);
        if (q) params.append("q", q);
        const data = await apiFetch(`/api/gastos-empresa${params.toString() ? `?${params.toString()}` : ""}`);
        const items = Array.isArray(data?.items) ? data.items : [];
        setStore({ gastosEmpresa: items });
        return { items, total: Number(data?.total || 0), count: Number(data?.count || items.length) };
      } catch (err) { console.error("getGastosEmpresa:", err); setStore({ gastosEmpresa: [] }); return { items: [], total: 0, count: 0 }; }
      finally { _loadingGastosEmpresa = false; }
    },
    createGastoEmpresa: async (payload) => {
      try {
        const created = await apiFetch("/api/gastos-empresa", { method: "POST", body: payload });
        setStore({ gastosEmpresa: [created, ...(getStore().gastosEmpresa || [])] });
        return created;
      } catch (err) { console.error("createGastoEmpresa:", err); throw err; }
    },
    updateGastoEmpresa: async (id, payload) => {
      try {
        const updated = await apiFetch(`/api/gastos-empresa/${id}`, { method: "PUT", body: payload });
        setStore({ gastosEmpresa: (getStore().gastosEmpresa || []).map(g => g.id === updated.id ? updated : g) });
        return updated;
      } catch (err) { console.error("updateGastoEmpresa:", err); throw err; }
    },
    deleteGastoEmpresa: async (id) => {
      try {
        await apiFetch(`/api/gastos-empresa/${id}`, { method: "DELETE" });
        setStore({ gastosEmpresa: (getStore().gastosEmpresa || []).filter(g => g.id !== id) });
        return true;
      } catch (err) { console.error("deleteGastoEmpresa:", err); throw err; }
    },
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
        const fallback = { totales: { sin_iva: 0, con_iva: 0 }, mensual: [] };
        setStore({ reporteGasto: fallback });
        return fallback;
      }
    },
  };
}
