// utils/parteTrabajoApi.js
import { normalizeRol } from "./authSession";
import { apiFetch } from "./apiFetch";

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

// Crear parte de trabajo
export async function crearParteTrabajo({ coche_id, empleado_id, observaciones, tiempo_estimado_minutos, tipo_tarea, servicios = [] }) {
  return apiFetch("/api/parte_trabajo", {
    method: "POST",
    body: { coche_id, empleado_id, observaciones, tiempo_estimado_minutos, tipo_tarea, servicios },
  });
}

export async function crearParteInterno({ observaciones, tiempo_estimado_minutos = 0, tipo_tarea }) {
  return apiFetch("/api/parte_trabajo/interno", {
    method: "POST",
    body: { observaciones, tiempo_estimado_minutos, tipo_tarea },
  });
}

export async function sumarmeACoche({ coche_id, observaciones = "", tiempo_estimado_minutos = 0, tipo_tarea }) {
  return apiFetch(`/api/parte_trabajo/coche/${coche_id}/sumarme`, {
    method: "POST",
    body: { observaciones, tiempo_estimado_minutos, tipo_tarea },
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
    body: { estado },
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
export async function editarParteTrabajo(parte_id, { empleado_id, observaciones, tiempo_estimado_minutos, tipo_tarea }) {
  return apiFetch(`/api/parte_trabajo/${parte_id}`, {
    method: "PUT",
    body: { empleado_id, observaciones, tiempo_estimado_minutos, ...(tipo_tarea ? { tipo_tarea } : {}) },
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
  // Simplificado: solo retorna la lista de coches disponibles
  // La enriquecimiento con partes_activas e inspeccion es opcional y se omite
  // para reducir llamadas API (reducción de 5 a 1 llamada)
  return listarCochesCatalogo();
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

// === NUEVAS FUNCIONES PARA FLUJO REDISEÑADO ===

// Obtener SOLO los partes del empleado actual (sin mezclar con otros)
export async function obtenerPartesPorEmpleadoYEstado(empleado_id, estado = null) {
  const params = [];
  if (empleado_id) params.push(`empleado_id=${empleado_id}`);
  if (estado) params.push(`estado=${estado}`);
  const query = params.length ? `?${params.join("&")}` : "";
  return apiFetch(`/api/parte_trabajo/empleado${query}`);
}

// Obtener coches en progreso (para timeline admin)
export async function obtenerCochesEnProgreso() {
  return apiFetch("/api/parte_trabajo/coches-en-progreso");
}

// Generar/obtener informe técnico para un coche
export async function generarInformeTecnico(coche_id) {
  return apiFetch(`/api/parte_trabajo/informe-tecnico/${coche_id}`, {
    method: "GET",
  });
}

// Obtener el siguiente trabajo sugerido para un empleado
export async function sugerirSiguienteTrabajo(empleado_id) {
  return apiFetch(`/api/parte_trabajo/empleado/${empleado_id}/siguiente`, {
    method: "GET",
  });
}
