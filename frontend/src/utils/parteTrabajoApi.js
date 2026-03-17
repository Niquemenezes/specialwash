// utils/parteTrabajoApi.js
import { buildApiUrl } from "./apiBase";
import { getStoredToken } from "./authSession";

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
export async function crearParteTrabajo({ coche_id, empleado_id, observaciones }) {
  return apiFetch("/api/parte_trabajo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coche_id, empleado_id, observaciones })
  });
}

// Listar partes de trabajo (con filtros)
export async function listarPartesTrabajo({ estado, empleado_id, coche_id } = {}) {
  const params = [];
  if (estado) params.push(`estado=${estado}`);
  if (empleado_id) params.push(`empleado_id=${empleado_id}`);
  if (coche_id) params.push(`coche_id=${coche_id}`);
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

// Quitar pausa
export async function quitarPausa(parte_id) {
  return apiFetch(`/api/parte_trabajo/${parte_id}/quitar_pausa`, {
    method: "PUT" });
}

// Editar parte de trabajo
export async function editarParteTrabajo(parte_id, { empleado_id, observaciones }) {
  return apiFetch(`/api/parte_trabajo/${parte_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ empleado_id, observaciones })
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

  return list.filter(
    (u) =>
      u &&
      u.activo !== false &&
      ["empleado", "encargado", "detailing", "pintura"].includes((u.rol || "").toLowerCase())
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

  const cochesAsignados = new Set(partesActivas.map((p) => Number(p?.coche_id)).filter((id) => Number.isFinite(id)));

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
    if (cochesAsignados.has(cocheId)) continue;

    const ultima = latestInspeccionByCoche.get(cocheId) || null;
    const fechaUltima = ultima?.fecha_inspeccion || ultima?.created_at || null;

    disponibles.push({
      coche_id: cocheId,
      matricula: coche?.matricula || "Sin matrícula",
      coche_descripcion: coche?.coche_descripcion || "",
      cliente_nombre: coche?.cliente_nombre || "",
      fecha_inspeccion: fechaUltima,
      ultima_inspeccion_id: ultima?.id || null,
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
