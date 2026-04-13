import { buildApiUrl } from "./apiBase";
import { getStoredToken } from "./authSession";
import { apiFetch } from "./apiFetch";

export async function fichar(tipo, fotoBlob) {
  const formData = new FormData();
  formData.append("tipo", tipo);
  if (fotoBlob) formData.append("foto", fotoBlob, "selfie.jpg");
  return apiFetch("/api/horario/fichar", { method: "POST", body: formData });
}

export async function obtenerHoy() {
  return apiFetch("/api/horario/hoy");
}

export async function obtenerMensual({ anio, mes, empleado_id } = {}) {
  const params = new URLSearchParams();
  if (anio) params.set("anio", anio);
  if (mes) params.set("mes", mes);
  if (empleado_id) params.set("empleado_id", empleado_id);
  return apiFetch(`/api/horario/mensual?${params}`);
}

export async function obtenerDiario({ fecha, empleado_id } = {}) {
  const params = new URLSearchParams();
  if (fecha) params.set("fecha", fecha);
  if (empleado_id) params.set("empleado_id", empleado_id);
  // Reutiliza el endpoint mensual filtrando por un solo día
  const anio = fecha ? fecha.slice(0, 4) : "";
  const mes = fecha ? fecha.slice(5, 7) : "";
  if (anio) params.set("anio", anio);
  if (mes) params.set("mes", mes);
  const todos = await apiFetch(`/api/horario/mensual?${params}`);
  if (!fecha) return todos;
  return (todos || []).filter((r) => r.fecha === fecha);
}

export async function obtenerEmpleadosActivos() {
  return apiFetch("/api/horario/empleados-activos");
}

export async function editarRegistro(id, horas) {
  return apiFetch(`/api/horario/${id}`, {
    method: "PUT",
    body: horas,
  });
}

export async function obtenerSelfieBlobUrl({ empleado_id, tipo, fecha }) {
  const token = getStoredToken();
  const res = await fetch(
    buildApiUrl(`/api/horario/selfie/${empleado_id}/${tipo}?fecha=${encodeURIComponent(fecha)}`),
    {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );

  if (!res.ok) {
    const raw = await res.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    throw new Error((data && (data.msg || data.message)) || `HTTP ${res.status}`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
