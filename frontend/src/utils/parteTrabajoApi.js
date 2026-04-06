// utils/parteTrabajoApi.js
import { buildApiUrl } from "./apiBase";
import { getStoredToken } from "./authSession";
import { normalizeRol } from "./authSession";

export function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMinutes(value) {
  const total = Number(value || 0);
  if (!Number.isFinite(total) || total <= 0) return "0 min";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} h`;
  return `${h} h ${m} min`;
}

async function apiFetch(path, options = {}) {
  const { auth = true, headers = {}, ...rest } = options;
  const finalHeaders = { ...headers };

  if (auth) {
    const token = getStoredToken();
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(buildApiUrl(path), {
    ...rest,
    headers: finalHeaders,
  });
  const raw = await res.text();

  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!res.ok) {
    const msg = (data && (data.msg || data.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

// Crear parte de trabajo
export async function crearParteTrabajo({ coche_id, empleado_id, observaciones, tiempo_estimado_minutos, tipo_tarea, servicios = [] }) {
  return apiFetch("/api/parte_trabajo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coche_id, empleado_id, observaciones, tiempo_estimado_minutos, tipo_tarea, servicios })
  });
}

export async function crearParteInterno({ observaciones, tiempo_estimado_minutos = 0, tipo_tarea }) {
  return apiFetch("/api/parte_trabajo/interno", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ observaciones, tiempo_estimado_minutos, tipo_tarea }),
  });
}

export async function sumarmeACoche({ coche_id, observaciones = "", tiempo_estimado_minutos = 0, tipo_tarea }) {
  return apiFetch(`/api/parte_trabajo/coche/${coche_id}/sumarme`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ observaciones, tiempo_estimado_minutos, tipo_tarea }),
  });
}

// Listar partes de trabajo (con filtros)
export async function listarPartesTrabajo({ estado, empleado_id, coche_id, tipo_tarea } = {}) {
  const params = [];
  if (estado) params.push(`estado=${estado}`);
  if (empleado_id) params.push(`empleado_id=${empleado_id}`);
  if (coche_id) params.push(`coche_id=${coche_id}`);
    if (tipo_tarea) params.push(`tipo_tarea=${encodeURIComponent(tipo_tarea)}`);
  const query = params.length ? `?${params.join("&")}` : "";
  return apiFetch(`/api/parte_trabajo${query}`);
}

// Cambiar estado de parte de trabajo
export async function cambiarEstadoParte(parte_id, estado) {
  return apiFetch(`/api/parte_trabajo/${parte_id}/estado`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado })
  });
}

// Tomar un parte pendiente y asignarlo al usuario actual
export async function tomarParteTrabajo(parte_id) {
  return apiFetch(`/api/parte_trabajo/${parte_id}/tomar`, {
    method: "PUT",
  });
}

// Quitar pausa
export async function quitarPausa(parte_id) {
  return apiFetch(`/api/parte_trabajo/${parte_id}/quitar_pausa`, {
    method: "PUT" });
}

// Editar parte de trabajo
export async function editarParteTrabajo(parte_id, { empleado_id, observaciones, tiempo_estimado_minutos }) {
  return apiFetch(`/api/parte_trabajo/${parte_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ empleado_id, observaciones, tiempo_estimado_minutos })
  });
}

export async function eliminarParteTrabajo(parte_id) {
  return apiFetch(`/api/parte_trabajo/${parte_id}`, {
    method: "DELETE",
  });
}

// Analítica por empleado y fechas
export async function analiticaPartes({ empleado_id, fecha_inicio, fecha_fin } = {}) {
  const params = [];
  if (empleado_id) params.push(`empleado_id=${empleado_id}`);
  if (fecha_inicio) params.push(`fecha_inicio=${fecha_inicio}`);
  if (fecha_fin) params.push(`fecha_fin=${fecha_fin}`);
  const query = params.length ? `?${params.join("&")}` : "";
  return apiFetch(`/api/parte_trabajo/analitica${query}`);
}

export async function listarEmpleadosDisponibles() {
  const users = await apiFetch("/api/usuarios");
  const list = Array.isArray(users) ? users : [];
  const WORKSHOP_ROLES = new Set(["tapicero", "detailing", "calidad", "pintura"]);

  return list.filter(
    (u) =>
      u &&
      u.activo !== false &&
      WORKSHOP_ROLES.has(normalizeRol(u.rol || ""))
  );
}

export async function listarCochesCatalogo() {
  const coches = await apiFetch("/api/coches");
  const list = Array.isArray(coches) ? coches : [];

  return list.map((coche) => ({
    coche_id: Number(coche?.id),
    matricula: coche?.matricula || "Sin matricula",
    coche_descripcion: [coche?.marca || "", coche?.modelo || ""].join(" ").trim(),
    cliente_nombre: coche?.cliente_nombre || "",
  }));
}

export async function listarCochesParaCrearParte() {
  const [coches, partesPendientes, partesEnProceso, partesEnPausa, inspecciones] = await Promise.all([
    listarCochesCatalogo(),
    listarPartesTrabajo({ estado: "pendiente" }),
    listarPartesTrabajo({ estado: "en_proceso" }),
    listarPartesTrabajo({ estado: "en_pausa" }),
    apiFetch("/api/inspeccion-recepcion").catch(() => []),
  ]);

  const listaCoches = Array.isArray(coches) ? coches : [];
  const partesActivas = [
    ...(Array.isArray(partesPendientes) ? partesPendientes : []),
    ...(Array.isArray(partesEnProceso) ? partesEnProceso : []),
    ...(Array.isArray(partesEnPausa) ? partesEnPausa : []),
  ];
  const partesActivasPorCoche = new Map();
  for (const parte of partesActivas) {
    const cocheId = Number(parte?.coche_id);
    if (!Number.isFinite(cocheId)) continue;
    partesActivasPorCoche.set(cocheId, (partesActivasPorCoche.get(cocheId) || 0) + 1);
  }

  const latestInspeccionByCoche = new Map();
  const listaInspecciones = Array.isArray(inspecciones) ? inspecciones : [];
  for (const insp of listaInspecciones) {
    const cocheId = Number(insp?.coche_id);
    if (!Number.isFinite(cocheId)) continue;

    const ts = new Date(insp?.fecha_inspeccion || insp?.created_at || 0).getTime();
    const prev = latestInspeccionByCoche.get(cocheId);
    const prevTs = prev ? new Date(prev?.fecha_inspeccion || prev?.created_at || 0).getTime() : -1;
    const inspId = Number(insp?.id || 0);
    const prevId = Number(prev?.id || 0);

    if (!prev || ts > prevTs || (ts === prevTs && inspId > prevId)) {
      latestInspeccionByCoche.set(cocheId, insp);
    }
  }

  const disponibles = [];
  for (const coche of listaCoches) {
    const cocheId = Number(coche?.coche_id);
    if (!Number.isFinite(cocheId)) continue;

    const ultima = latestInspeccionByCoche.get(cocheId) || null;
    const fechaUltima = ultima?.fecha_inspeccion || ultima?.created_at || null;

    disponibles.push({
      coche_id: cocheId,
      matricula: coche?.matricula || "Sin matrícula",
      coche_descripcion: coche?.coche_descripcion || "",
      cliente_nombre: coche?.cliente_nombre || "",
      fecha_inspeccion: fechaUltima,
      ultima_inspeccion_id: ultima?.id || null,
      partes_activas: partesActivasPorCoche.get(cocheId) || 0,
    });
  }

  return disponibles.sort((a, b) => {
    const ta = new Date(a?.fecha_inspeccion || 0).getTime();
    const tb = new Date(b?.fecha_inspeccion || 0).getTime();
    if (tb !== ta) return tb - ta;
    return String(a.matricula).localeCompare(String(b.matricula));
  });
}

// Listar servicios del catálogo (solo activos por defecto)
export async function listarServiciosCatalogo(soloActivos = true) {
  const query = soloActivos ? "?activos=true" : "";
  return apiFetch(`/api/servicios_catalogo${query}`);
}

export async function obtenerUltimaInspeccionPorCoche(cocheId) {
  const id = Number(cocheId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const inspecciones = await apiFetch("/api/inspeccion-recepcion");
  const lista = Array.isArray(inspecciones) ? inspecciones : [];

  const candidatas = lista
    .filter((i) => Number(i?.coche_id) === id)
    .sort((a, b) => {
      const da = new Date(a?.fecha_inspeccion || a?.created_at || 0).getTime();
      const db = new Date(b?.fecha_inspeccion || b?.created_at || 0).getTime();
      if (db !== da) return db - da;
      return Number(b?.id || 0) - Number(a?.id || 0);
    });

  return candidatas[0] || null;
}

export async function reporteEmpleados({ fecha_inicio, fecha_fin } = {}) {
  const params = [];
  if (fecha_inicio) params.push(`fecha_inicio=${fecha_inicio}`);
  if (fecha_fin) params.push(`fecha_fin=${fecha_fin}`);
  const query = params.length ? `?${params.join("&")}` : "";
  return apiFetch(`/api/parte_trabajo/reporte_empleados${query}`);
}
