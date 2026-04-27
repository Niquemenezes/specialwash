import React, { useEffect, useState } from "react";
import SignaturePad from "../components/SignaturePad.jsx";
import { apiFetch } from "../utils/apiFetch";

const COMBUSTIBLE_OPTS = ["lleno", "3/4", "1/2", "1/4", "vacío"];

const fmtFecha = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES") + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
};

const estadoBadge = (devuelto) =>
  devuelto
    ? <span className="badge bg-success">Devuelto</span>
    : <span className="badge bg-warning text-dark">En préstamo</span>;

const pageShellStyle = {
  minHeight: "calc(100vh - 56px)",
  color: "var(--sw-text)",
  position: "relative",
  zIndex: 1,
};

const sectionCardStyle = {
  background: "var(--sw-surface)",
  border: "1px solid var(--sw-border)",
  borderRadius: 18,
  boxShadow: "var(--sw-shadow)",
  position: "relative",
  zIndex: 2,
};

const sectionHeaderStyle = {
  padding: "1rem 1.15rem",
  borderBottom: "1px solid var(--sw-border)",
  fontWeight: 700,
  color: "var(--sw-text)",
};

const sectionBodyStyle = {
  padding: "1rem 1.15rem",
};

const inputStyle = {
  background: "var(--sw-surface-2)",
  border: "1px solid var(--sw-border)",
  color: "var(--sw-text)",
};

const ghostButtonStyle = {
  background: "var(--sw-surface-2)",
  border: "1px solid var(--sw-border)",
  color: "var(--sw-text)",
};

const primaryButtonStyle = {
  background: "linear-gradient(135deg,#f5e19a,#d4af37)",
  border: "none",
  color: "#0a0b0e",
  fontWeight: 700,
};

const successButtonStyle = {
  background: "color-mix(in srgb, #22c55e 18%, white)",
  border: "1px solid color-mix(in srgb, #22c55e 40%, transparent)",
  color: "#14532d",
  fontWeight: 700,
};

const infoButtonStyle = {
  background: "color-mix(in srgb, var(--sw-accent) 10%, var(--sw-surface))",
  border: "1px solid color-mix(in srgb, var(--sw-accent) 28%, var(--sw-border))",
  color: "var(--sw-text)",
};

export default function CocheSustitucionPage() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState("lista"); // lista | nuevo | devolucion | detalle | imprimir
  const [seleccionado, setSeleccionado] = useState(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState({
    cliente_nombre: "",
    cliente_dni: "",
    cliente_telefono: "",
    coche_cliente_matricula: "",
    matricula: "",
    marca: "",
    modelo: "",
    km_entrega: "",
    combustible_entrega: "lleno",
    estado_entrega: "",
    firma_cliente: "",
    consentimiento_rgpd: false,
  });
  const [carnetFrenteFile, setCarnetFrenteFile] = useState(null);
  const [carnetFrentePreview, setCarnetFrentePreview] = useState(null);
  const [carnetVersoFile, setCarnetVersoFile] = useState(null);
  const [carnetVersoPreview, setCarnetVersoPreview] = useState(null);
  const [fotosFiles, setFotosFiles] = useState([]);
  const [fotosPreviews, setFotosPreviews] = useState([]);
  const frenteRef = React.useRef(null);
  const versoRef = React.useRef(null);
  const fotoCocheRef = React.useRef(null);

  const [formDev, setFormDev] = useState({
    km_devolucion: "",
    combustible_devolucion: "lleno",
    estado_devolucion: "",
    firma_devolucion: "",
  });

  const [formEdit, setFormEdit] = useState({
    cliente_nombre: "", cliente_dni: "", cliente_telefono: "",
    coche_cliente_matricula: "", matricula: "", marca: "", modelo: "",
    km_entrega: "", combustible_entrega: "lleno", estado_entrega: "",
  });

  const cargarLista = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/coche-sustitucion");
      setLista(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarLista(); }, []);

  const handleCarnetFrente = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCarnetFrenteFile(file);
    setCarnetFrentePreview(URL.createObjectURL(file));
  };

  const handleCarnetVerso = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCarnetVersoFile(file);
    setCarnetVersoPreview(URL.createObjectURL(file));
  };

  const handleFotos = (e) => {
    const files = Array.from(e.target.files);
    setFotosFiles((prev) => [...prev, ...files]);
    setFotosPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.firma_cliente) { setError("La firma del cliente es obligatoria"); return; }
    setGuardando(true);
    try {
      // 1. Crear el registro
      const nuevo = await apiFetch("/api/coche-sustitucion", {
        method: "POST",
        body: {
          ...form,
          km_entrega: form.km_entrega ? parseInt(form.km_entrega) : null,
        },
      });

      // 2. Subir fotos carnet (frente y verso)
      for (const [file, lado] of [[carnetFrenteFile, "frente"], [carnetVersoFile, "verso"]]) {
        if (file) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("lado", lado);
          await apiFetch(`/api/coche-sustitucion/${nuevo.id}/upload-carnet`, { method: "POST", body: fd });
        }
      }

      // 3. Subir fotos del coche
      for (const foto of fotosFiles) {
        const fd = new FormData();
        fd.append("file", foto);
        await apiFetch(`/api/coche-sustitucion/${nuevo.id}/upload-foto`, { method: "POST", body: fd });
      }

      await cargarLista();
      const actualizado = await apiFetch(`/api/coche-sustitucion/${nuevo.id}`);
      setSeleccionado(actualizado);
      setVista("imprimir");
      resetForm();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleDevolucion = async (e) => {
    e.preventDefault();
    setError("");
    if (!formDev.firma_devolucion) { setError("La firma de devolución es obligatoria"); return; }
    setGuardando(true);
    try {
      const actualizado = await apiFetch(`/api/coche-sustitucion/${seleccionado.id}/devolucion`, {
        method: "PUT",
        body: { ...formDev, km_devolucion: formDev.km_devolucion ? parseInt(formDev.km_devolucion) : null },
      });
      setSeleccionado(actualizado);
      await cargarLista();
      setVista("imprimir");
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirEditar = (item) => {
    setSeleccionado(item);
    setFormEdit({
      cliente_nombre: item.cliente_nombre || "",
      cliente_dni: item.cliente_dni || "",
      cliente_telefono: item.cliente_telefono || "",
      coche_cliente_matricula: item.coche_cliente_matricula || "",
      matricula: item.matricula || "",
      marca: item.marca || "",
      modelo: item.modelo || "",
      km_entrega: item.km_entrega ?? "",
      combustible_entrega: item.combustible_entrega || "lleno",
      estado_entrega: item.estado_entrega || "",
    });
    setError("");
    setVista("editar");
  };

  const handleEditarGuardar = async (e) => {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      await apiFetch(`/api/coche-sustitucion/${seleccionado.id}`, {
        method: "PUT",
        body: { ...formEdit, km_entrega: formEdit.km_entrega !== "" ? parseInt(formEdit.km_entrega) : null },
      });
      await cargarLista();
      setVista("lista");
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (item) => {
    if (!window.confirm(`¿Eliminar el préstamo de ${item.cliente_nombre} (${item.matricula})?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      await apiFetch(`/api/coche-sustitucion/${item.id}`, { method: "DELETE" });
      await cargarLista();
    } catch (e) {
      setError(e.message);
    }
  };

  const resetForm = () => {
    setForm({ cliente_nombre: "", cliente_dni: "", cliente_telefono: "", coche_cliente_matricula: "", matricula: "", marca: "", modelo: "", km_entrega: "", combustible_entrega: "lleno", estado_entrega: "", firma_cliente: "", consentimiento_rgpd: false });
    setCarnetFrenteFile(null); setCarnetFrentePreview(null);
    setCarnetVersoFile(null); setCarnetVersoPreview(null);
    setFotosFiles([]); setFotosPreviews([]);
  };

  // ─── VISTA IMPRIMIR ────────────────────────────────────────────────
  if (vista === "imprimir" && seleccionado) {
    return <ImprimirContrato item={seleccionado} onVolver={() => setVista("lista")} />;
  }

  // ─── FORMULARIO EDITAR ─────────────────────────────────────────────
  if (vista === "editar" && seleccionado) {
    return (
      <div className="sw-page-bg" style={pageShellStyle}>
      <div className="container py-4" style={{ maxWidth: 860, color: "var(--sw-text)", position: "relative", zIndex: 3 }}>
        <button className="btn btn-sm mb-3" style={ghostButtonStyle} onClick={() => { setVista("lista"); setError(""); }}>
          ← Volver
        </button>
        <div style={{ ...sectionCardStyle, marginBottom: "1rem" }}>
          <div style={sectionBodyStyle}>
            <div className="small text-uppercase fw-bold mb-1" style={{ color: "#d4af37", letterSpacing: "0.08em" }}>Coches Sustitución</div>
            <h4 className="fw-bold mb-1">Editar préstamo #{String(seleccionado.id).padStart(4, "0")}</h4>
            <p className="text-muted mb-0">Modifica los datos del préstamo. La firma y las fotos no se pueden cambiar desde aquí.</p>
          </div>
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleEditarGuardar}>
          <div className="mb-3" style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>Datos del cliente</div>
            <div style={sectionBodyStyle}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Nombre completo *</label>
                  <input className="form-control" style={inputStyle} value={formEdit.cliente_nombre} onChange={e => setFormEdit(f => ({ ...f, cliente_nombre: e.target.value }))} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">DNI / NIE *</label>
                  <input className="form-control" style={inputStyle} value={formEdit.cliente_dni} onChange={e => setFormEdit(f => ({ ...f, cliente_dni: e.target.value }))} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Teléfono</label>
                  <input className="form-control" style={inputStyle} value={formEdit.cliente_telefono} onChange={e => setFormEdit(f => ({ ...f, cliente_telefono: e.target.value }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Matrícula coche en taller</label>
                  <input className="form-control" style={inputStyle} value={formEdit.coche_cliente_matricula} onChange={e => setFormEdit(f => ({ ...f, coche_cliente_matricula: e.target.value.toUpperCase() }))} />
                </div>
              </div>
            </div>
          </div>
          <div className="mb-3" style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>Coche de sustitución</div>
            <div style={sectionBodyStyle}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Matrícula *</label>
                  <input className="form-control" style={inputStyle} value={formEdit.matricula} onChange={e => setFormEdit(f => ({ ...f, matricula: e.target.value.toUpperCase() }))} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Marca</label>
                  <input className="form-control" style={inputStyle} value={formEdit.marca} onChange={e => setFormEdit(f => ({ ...f, marca: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Modelo</label>
                  <input className="form-control" style={inputStyle} value={formEdit.modelo} onChange={e => setFormEdit(f => ({ ...f, modelo: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Kilómetros</label>
                  <input type="number" className="form-control" style={inputStyle} value={formEdit.km_entrega} onChange={e => setFormEdit(f => ({ ...f, km_entrega: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Combustible</label>
                  <select className="form-select" style={inputStyle} value={formEdit.combustible_entrega} onChange={e => setFormEdit(f => ({ ...f, combustible_entrega: e.target.value }))}>
                    {COMBUSTIBLE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Estado / daños existentes</label>
                  <textarea className="form-control" style={inputStyle} rows={3} value={formEdit.estado_entrega} onChange={e => setFormEdit(f => ({ ...f, estado_entrega: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>
          <div className="d-flex gap-2">
            <button type="submit" className="btn" style={primaryButtonStyle} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
            <button type="button" className="btn" style={ghostButtonStyle} onClick={() => { setVista("lista"); setError(""); }}>Cancelar</button>
          </div>
        </form>
      </div>
      </div>
    );
  }

  // ─── FORMULARIO NUEVO ──────────────────────────────────────────────
  if (vista === "nuevo") {
    return (
      <div className="sw-page-bg" style={pageShellStyle}>
      <div className="container py-4" style={{ maxWidth: 860, color: "var(--sw-text)", position: "relative", zIndex: 3 }}>
        <button className="btn btn-sm mb-3" style={ghostButtonStyle} onClick={() => { setVista("lista"); resetForm(); setError(""); }}>
          ← Volver
        </button>
        <div style={{ ...sectionCardStyle, marginBottom: "1rem" }}>
          <div style={sectionBodyStyle}>
            <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
              <div>
                <div className="small text-uppercase fw-bold" style={{ color: "#d4af37", letterSpacing: "0.08em" }}>
                  Coches Sustitución
                </div>
                <h4 className="fw-bold mb-1">Nuevo préstamo de coche de sustitución</h4>
                <p className="text-muted mb-0">Completa los datos del cliente, del coche prestado y la firma.</p>
              </div>
              <span className="badge rounded-pill" style={{ background: "var(--sw-surface-2)", color: "var(--sw-text)", border: "1px solid var(--sw-border)", padding: "0.65rem 0.9rem" }}>
                Formulario activo
              </span>
            </div>
          </div>
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleGuardar}>
          <div className="mb-3" style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>Datos del cliente</div>
            <div style={sectionBodyStyle}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Nombre completo *</label>
                  <input className="form-control" style={inputStyle} value={form.cliente_nombre} onChange={e => setForm(f => ({ ...f, cliente_nombre: e.target.value }))} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">DNI / NIE *</label>
                  <input className="form-control" style={inputStyle} value={form.cliente_dni} onChange={e => setForm(f => ({ ...f, cliente_dni: e.target.value }))} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Teléfono</label>
                  <input className="form-control" style={inputStyle} value={form.cliente_telefono} onChange={e => setForm(f => ({ ...f, cliente_telefono: e.target.value }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Matrícula coche en taller</label>
                  <input className="form-control" style={inputStyle} placeholder="Ej: 1234ABC" value={form.coche_cliente_matricula} onChange={e => setForm(f => ({ ...f, coche_cliente_matricula: e.target.value.toUpperCase() }))} />
                </div>
                <div className="col-12">
                  <label className="form-label fw-semibold">Foto del carnet de conducir</label>
                  <div className="d-flex gap-3 flex-wrap mt-1">
                    <div className="text-center">
                      <input ref={frenteRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleCarnetFrente} />
                      <button type="button" className="btn d-flex flex-column align-items-center px-4 py-3" style={{ ...infoButtonStyle, minWidth: 130 }} onClick={() => frenteRef.current.click()}>
                        <i className="fas fa-camera fa-2x mb-1" />
                        <span className="small">Frente</span>
                      </button>
                      {carnetFrentePreview && <img src={carnetFrentePreview} alt="Frente" className="mt-2 rounded border" style={{ height: 80, width: 130, objectFit: "cover" }} />}
                    </div>
                    <div className="text-center">
                      <input ref={versoRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleCarnetVerso} />
                      <button type="button" className="btn d-flex flex-column align-items-center px-4 py-3" style={{ ...infoButtonStyle, minWidth: 130 }} onClick={() => versoRef.current.click()}>
                        <i className="fas fa-camera fa-2x mb-1" />
                        <span className="small">Verso</span>
                      </button>
                      {carnetVersoPreview && <img src={carnetVersoPreview} alt="Verso" className="mt-2 rounded border" style={{ height: 80, width: 130, objectFit: "cover" }} />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-3" style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>Coche de sustitución</div>
            <div style={sectionBodyStyle}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Matrícula *</label>
                  <input className="form-control" style={inputStyle} value={form.matricula} onChange={e => setForm(f => ({ ...f, matricula: e.target.value.toUpperCase() }))} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Marca</label>
                  <input className="form-control" style={inputStyle} value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Modelo</label>
                  <input className="form-control" style={inputStyle} value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Kilómetros</label>
                  <input type="number" className="form-control" style={inputStyle} value={form.km_entrega} onChange={e => setForm(f => ({ ...f, km_entrega: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Combustible</label>
                  <select className="form-select" style={inputStyle} value={form.combustible_entrega} onChange={e => setForm(f => ({ ...f, combustible_entrega: e.target.value }))}>
                    {COMBUSTIBLE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Estado / daños existentes</label>
                  <textarea className="form-control" style={inputStyle} rows={3} value={form.estado_entrega} onChange={e => setForm(f => ({ ...f, estado_entrega: e.target.value }))} placeholder="Describa rasguños, golpes u otros daños previos..." />
                </div>
                <div className="col-12">
                  <label className="form-label fw-semibold">Fotos del coche (arañazos, golpes, etc.)</label>
                  <div className="mt-1">
                    <input ref={fotoCocheRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFotos} />
                    <button type="button" className="btn d-flex align-items-center gap-2 px-3 py-2" style={ghostButtonStyle} onClick={() => fotoCocheRef.current.click()}>
                      <i className="fas fa-camera" />
                      <span>Hacer foto</span>
                    </button>
                  </div>
                  {fotosPreviews.length > 0 && (
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      {fotosPreviews.map((src, i) => (
                        <div key={i} style={{ position: "relative" }}>
                          <img src={src} alt="" className="rounded border" style={{ height: 90, width: 90, objectFit: "cover" }} />
                          <button type="button" className="btn btn-danger btn-sm" style={{ position: "absolute", top: 2, right: 2, padding: "0 4px", lineHeight: 1.2, fontSize: 11 }}
                            onClick={() => { setFotosPreviews(p => p.filter((_, j) => j !== i)); setFotosFiles(f => f.filter((_, j) => j !== i)); }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-3" style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>Firma y consentimiento</div>
            <div style={sectionBodyStyle}>
              <div className="alert alert-info small mb-3">
                <strong>Información RGPD:</strong> Los datos personales y la fotografía del carnet de conducir se tratarán conforme al Reglamento (UE) 2016/679 (RGPD) con la finalidad de identificar al conductor en caso de infracción de tráfico. Los datos se conservarán un mínimo de 1 año. El responsable del tratamiento es el taller. Puede ejercer sus derechos de acceso, rectificación y supresión contactando con nosotros.
              </div>
              <div className="form-check mb-3">
                <input type="checkbox" className="form-check-input" id="rgpd" checked={form.consentimiento_rgpd} onChange={e => setForm(f => ({ ...f, consentimiento_rgpd: e.target.checked }))} required />
                <label className="form-check-label" htmlFor="rgpd">
                  He leído y acepto el tratamiento de mis datos personales según el RGPD *
                </label>
              </div>
              <SignaturePad title="Firma del cliente *" value={form.firma_cliente} onChange={v => setForm(f => ({ ...f, firma_cliente: v }))} height={160} />
            </div>
          </div>

          <div className="d-flex gap-2">
            <button type="submit" className="btn" style={primaryButtonStyle} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar y generar contrato"}
            </button>
            <button type="button" className="btn" style={ghostButtonStyle} onClick={() => { setVista("lista"); resetForm(); }}>Cancelar</button>
          </div>
        </form>
      </div>
      </div>
    );
  }

  // ─── FORMULARIO DEVOLUCIÓN ─────────────────────────────────────────
  if (vista === "devolucion" && seleccionado) {
    return (
      <div className="sw-page-bg" style={pageShellStyle}>
      <div className="container py-4" style={{ maxWidth: 860, color: "var(--sw-text)", position: "relative", zIndex: 3 }}>
        <button className="btn btn-sm mb-3" style={ghostButtonStyle} onClick={() => { setVista("lista"); setError(""); }}>← Volver</button>
        <div style={{ ...sectionCardStyle, marginBottom: "1rem" }}>
          <div style={sectionBodyStyle}>
            <h4 className="fw-bold mb-1">Registrar devolución</h4>
            <p className="text-muted mb-0">{seleccionado.matricula} — {seleccionado.cliente_nombre}</p>
          </div>
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleDevolucion}>
          <div className="mb-3" style={sectionCardStyle}>
            <div style={sectionBodyStyle}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Kilómetros devolución</label>
                  <input type="number" className="form-control" style={inputStyle} value={formDev.km_devolucion} onChange={e => setFormDev(f => ({ ...f, km_devolucion: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Combustible</label>
                  <select className="form-select" style={inputStyle} value={formDev.combustible_devolucion} onChange={e => setFormDev(f => ({ ...f, combustible_devolucion: e.target.value }))}>
                    {COMBUSTIBLE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Observaciones devolución</label>
                  <textarea className="form-control" style={inputStyle} rows={3} value={formDev.estado_devolucion} onChange={e => setFormDev(f => ({ ...f, estado_devolucion: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>
          <SignaturePad title="Firma del cliente (devolución) *" value={formDev.firma_devolucion} onChange={v => setFormDev(f => ({ ...f, firma_devolucion: v }))} height={160} />
          <div className="d-flex gap-2 mt-2">
            <button type="submit" className="btn" style={successButtonStyle} disabled={guardando}>{guardando ? "Guardando..." : "Confirmar devolución"}</button>
            <button type="button" className="btn" style={ghostButtonStyle} onClick={() => setVista("lista")}>Cancelar</button>
          </div>
        </form>
      </div>
      </div>
    );
  }

  // ─── LISTA ─────────────────────────────────────────────────────────
  return (
    <div className="sw-page-bg" style={pageShellStyle}>
    <div className="container py-4" style={{ color: "var(--sw-text)", position: "relative", zIndex: 3 }}>
      <div style={{ ...sectionCardStyle, marginBottom: "1rem" }}>
        <div style={sectionBodyStyle}>
          <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
            <div>
                <div className="small text-uppercase fw-bold" style={{ color: "#d4af37", letterSpacing: "0.08em" }}>
                Coches Sustitución
              </div>
              <h4 className="fw-bold mb-1">Gestión de préstamos de coche de sustitución</h4>
              <p className="text-muted small mb-0">Préstamos a clientes mientras su vehículo está en taller</p>
            </div>
            <button className="btn" style={primaryButtonStyle} onClick={() => { resetForm(); setError(""); setVista("nuevo"); }}>
              + Nuevo préstamo
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div style={{ ...sectionCardStyle, ...sectionBodyStyle }} className="text-center py-5 text-muted">Cargando...</div>
      ) : lista.length === 0 ? (
        <div style={{ ...sectionCardStyle, ...sectionBodyStyle }} className="text-center py-5 text-muted">No hay registros todavía</div>
      ) : (
        <div className="table-responsive" style={sectionCardStyle}>
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>Cliente</th>
                <th>DNI</th>
                <th>Coche prestado</th>
                <th>Coche en taller</th>
                <th>Fecha entrega</th>
                <th>Fecha devolución</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map(item => (
                <tr key={item.id}>
                  <td className="fw-semibold">{item.cliente_nombre}</td>
                  <td className="text-muted small">{item.cliente_dni}</td>
                  <td>{item.matricula}{item.marca ? ` · ${item.marca} ${item.modelo || ""}` : ""}</td>
                  <td>{item.coche_cliente_matricula || "-"}</td>
                  <td className="small">{fmtFecha(item.fecha_entrega)}</td>
                  <td className="small">{item.fecha_devolucion ? fmtFecha(item.fecha_devolucion) : "-"}</td>
                  <td>{estadoBadge(item.devuelto)}</td>
                  <td>
                    <div className="d-flex gap-1 flex-wrap">
                      <button className="btn btn-sm" style={ghostButtonStyle} onClick={() => { setSeleccionado(item); setVista("imprimir"); }}>
                        Imprimir
                      </button>
                      {!item.devuelto && (
                        <button className="btn btn-sm" style={successButtonStyle} onClick={() => { setSeleccionado(item); setFormDev({ km_devolucion: "", combustible_devolucion: "lleno", estado_devolucion: "", firma_devolucion: "" }); setVista("devolucion"); }}>
                          Devolver
                        </button>
                      )}
                      <button className="btn btn-sm" style={infoButtonStyle} onClick={() => abrirEditar(item)} title="Editar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleEliminar(item)} title="Eliminar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </div>
  );
}

// ─── CONTRATO IMPRIMIBLE ───────────────────────────────────────────────────────
function generarHtmlContrato(item) {
  const esDev = !!item.fecha_devolucion;
  const apiBase = window.location.origin;
  const fila = (label, value) => `
    <tr>
      <td style="padding:4px 8px;font-weight:bold;width:35%;border-bottom:1px solid #eee;">${label}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;">${value ?? "-"}</td>
    </tr>`;
  const seccion = (titulo, contenido) => `
    <div style="margin-bottom:16px;page-break-inside:avoid;">
      <div style="background:#f0f0f0;padding:4px 8px;font-weight:bold;font-size:12px;margin-bottom:6px;">${titulo}</div>
      ${contenido}
    </div>`;

  const carnetFotos = (item.carnet_foto || item.carnet_foto_verso) ? `
    <div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap;">
      ${item.carnet_foto ? `<div><strong style="font-size:11px;">Carnet — Frente</strong><br/>
        <img src="${apiBase}/api/coche-sustitucion/media/${item.carnet_foto}" style="max-height:90px;max-width:150px;object-fit:contain;border:1px solid #ccc;margin-top:4px;" /></div>` : ""}
      ${item.carnet_foto_verso ? `<div><strong style="font-size:11px;">Carnet — Verso</strong><br/>
        <img src="${apiBase}/api/coche-sustitucion/media/${item.carnet_foto_verso}" style="max-height:90px;max-width:150px;object-fit:contain;border:1px solid #ccc;margin-top:4px;" /></div>` : ""}
    </div>` : "";

  const fotosEntrega = item.fotos_entrega && item.fotos_entrega.length > 0 ? `
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
      ${item.fotos_entrega.map(f => `<img src="${apiBase}/api/coche-sustitucion/media/${f}" style="height:80px;width:80px;object-fit:cover;border:1px solid #ccc;" />`).join("")}
    </div>` : "";

  const firmaEntrega = item.firma_cliente
    ? `<img src="${item.firma_cliente}" style="width:100%;max-height:100px;object-fit:contain;border:1px solid #ccc;" />`
    : `<div style="height:80px;border:1px solid #ccc;"></div>`;
  const firmaDevolucion = item.firma_devolucion
    ? `<img src="${item.firma_devolucion}" style="width:100%;max-height:100px;object-fit:contain;border:1px solid #ccc;" />`
    : `<div style="height:80px;border:1px solid #ccc;"></div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Contrato Nº ${String(item.id).padStart(4,"0")} — ${item.cliente_nombre}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #000; background: #fff; padding: 20px; }
    @media print {
      body { padding: 0; }
      @page { size: A4; margin: 12mm; }
    }
  </style>
</head>
<body>
  <div style="max-width:780px;margin:0 auto;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:2px solid #000;padding-bottom:12px;">
      <div>
        <div style="font-weight:bold;font-size:16px;">SpecialWash Studio</div>
        <div style="font-size:12px;color:#555;">Calle Salvador Dalí, 22 · CP 29700</div>
        <div style="font-size:12px;color:#555;">Tel: 645 811 313 · CIF: B21816566</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:#777;">Nº Contrato</div>
        <div style="font-weight:bold;font-size:15px;">${String(item.id).padStart(4,"0")}</div>
        <div style="font-size:11px;color:#777;margin-top:4px;">Fecha entrega</div>
        <div style="font-size:12px;">${fmtFecha(item.fecha_entrega)}</div>
        ${esDev ? `<div style="font-size:11px;color:#777;margin-top:4px;">Fecha devolución</div><div style="font-size:12px;">${fmtFecha(item.fecha_devolucion)}</div>` : ""}
      </div>
    </div>

    <div style="text-align:center;margin-bottom:16px;">
      <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.05em;font-weight:bold;">Contrato de Cesión Temporal de Vehículo de Sustitución</h2>
    </div>

    ${seccion("DATOS DEL CLIENTE", `
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${fila("Nombre", item.cliente_nombre)}
          ${fila("DNI / NIE", item.cliente_dni)}
          ${fila("Teléfono", item.cliente_telefono || "-")}
          ${fila("Vehículo en taller", item.coche_cliente_matricula || "-")}
        </tbody>
      </table>
      ${carnetFotos}
    `)}

    ${seccion("VEHÍCULO DE SUSTITUCIÓN", `
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${fila("Matrícula", item.matricula)}
          ${fila("Marca / Modelo", (item.marca || "-") + " " + (item.modelo || ""))}
          ${fila("Kilómetros entrega", item.km_entrega ?? "-")}
          ${fila("Combustible entrega", item.combustible_entrega || "-")}
          ${fila("Estado / daños previos", item.estado_entrega || "Sin daños anotados")}
        </tbody>
      </table>
      ${fotosEntrega}
    `)}

    ${esDev ? seccion("DEVOLUCIÓN", `
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${fila("Kilómetros devolución", item.km_devolucion ?? "-")}
          ${fila("Combustible devolución", item.combustible_devolucion || "-")}
          ${fila("Observaciones", item.estado_devolucion || "-")}
        </tbody>
      </table>
    `) : ""}

    ${seccion("CONDICIONES DE USO", `
      <ul style="padding-left:18px;line-height:1.8;">
        <li>El conductor se responsabiliza del uso correcto del vehículo durante el préstamo.</li>
        <li>Cualquier multa o infracción cometida durante el período de préstamo es responsabilidad exclusiva del conductor.</li>
        <li>El vehículo debe devolverse en el mismo estado en que fue entregado.</li>
        <li>El conductor deberá estar en posesión de permiso de conducir vigente.</li>
        <li>Queda prohibido el uso del vehículo fuera del territorio nacional sin autorización expresa.</li>
      </ul>
    `)}

    ${seccion("PROTECCIÓN DE DATOS (RGPD)", `
      <p style="line-height:1.6;">Los datos personales y la fotografía del carnet de conducir se tratarán conforme al Reglamento (UE) 2016/679 (RGPD) con la única finalidad de identificar al conductor en caso de infracción de tráfico. Los datos se conservarán un mínimo de <strong>1 año</strong>. El responsable del tratamiento es el taller. Puede ejercer sus derechos de acceso, rectificación y supresión contactando directamente con nosotros.</p>
      <p style="margin-top:8px;"><strong>Consentimiento RGPD:</strong> ${item.consentimiento_rgpd ? "✓ Aceptado por el cliente" : "Pendiente"}</p>
    `)}

    <div style="display:flex;gap:24px;margin-top:32px;">
      <div style="flex:1;text-align:center;">
        <p style="margin-bottom:4px;font-weight:bold;font-size:12px;">Firma del cliente (entrega)</p>
        ${firmaEntrega}
        <div style="border-top:1px solid #000;margin-top:8px;padding-top:4px;font-size:11px;">${item.cliente_nombre}</div>
        <div style="font-size:10px;color:#666;">DNI/NIE: ${item.cliente_dni}</div>
      </div>
      ${esDev ? `
      <div style="flex:1;text-align:center;">
        <p style="margin-bottom:4px;font-weight:bold;font-size:12px;">Firma del cliente (devolución)</p>
        ${firmaDevolucion}
        <div style="border-top:1px solid #000;margin-top:8px;padding-top:4px;font-size:11px;">${item.cliente_nombre}</div>
        <div style="font-size:10px;color:#666;">DNI/NIE: ${item.cliente_dni}</div>
      </div>` : ""}
      <div style="flex:1;text-align:center;">
        <p style="margin-bottom:4px;font-weight:bold;font-size:12px;">Sello / Firma del taller</p>
        <div style="height:80px;border:1px solid #ccc;"></div>
        <div style="border-top:1px solid #000;margin-top:8px;padding-top:4px;font-size:11px;">SpecialWash Studio</div>
        <div style="font-size:10px;color:#666;">CIF: B21816566</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function ImprimirContrato({ item, onVolver }) {
  const abrirImpresion = () => {
    const html = generarHtmlContrato(item);
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 800);
  };

  return (
    <div className="container py-4" style={{ maxWidth: 720 }}>
      <h4 className="fw-bold mb-1">Contrato generado</h4>
      <p className="text-muted mb-4">{item.matricula} — {item.cliente_nombre}</p>
      <div className="d-flex gap-2">
        <button className="btn btn-primary" onClick={abrirImpresion}>
          <i className="fas fa-print me-2" />Imprimir / Guardar PDF
        </button>
        <button className="btn btn-outline-secondary" onClick={onVolver}>Volver al listado</button>
      </div>
      <div className="alert alert-info mt-3 small">
        Se abrirá una ventana nueva con el contrato listo para imprimir o guardar como PDF.
      </div>
    </div>
  );
}
