import { buildApiUrl } from "./apiBase";
import { getStoredToken } from "./authSession";

async function apiFetch(path, options = {}) {
  const { auth = true, headers = {}, ...rest } = options;
  const finalHeaders = { ...headers };

  if (auth) {
    const token = getStoredToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(buildApiUrl(path), { ...rest, headers: finalHeaders });
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }

  if (!res.ok) {
    const msg = (data && (data.msg || data.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

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

export async function obtenerEmpleadosActivos() {
  return apiFetch("/api/horario/empleados-activos");
}

export async function editarRegistro(id, horas) {
  return apiFetch(`/api/horario/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(horas),
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
