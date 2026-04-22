import React, { useEffect, useRef, useState } from "react";
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
  const frenteRef = React.useRef();
  const versoRef = React.useRef();
  const fotoCocheRef = React.useRef();

  const [formDev, setFormDev] = useState({
    km_devolucion: "",
    combustible_devolucion: "lleno",
    estado_devolucion: "",
    firma_devolucion: "",
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

  // ─── FORMULARIO NUEVO ──────────────────────────────────────────────
  if (vista === "nuevo") {
    return (
      <div className="container py-4" style={{ maxWidth: 720 }}>
        <button className="btn btn-outline-secondary btn-sm mb-3" onClick={() => { setVista("lista"); resetForm(); setError(""); }}>
          ← Volver
        </button>
        <h4 className="fw-bold mb-4">Nuevo préstamo de coche de sustitución</h4>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleGuardar}>
          <div className="card mb-3">
            <div className="card-header fw-bold">Datos del cliente</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Nombre completo *</label>
                  <input className="form-control" value={form.cliente_nombre} onChange={e => setForm(f => ({ ...f, cliente_nombre: e.target.value }))} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">DNI / NIE *</label>
                  <input className="form-control" value={form.cliente_dni} onChange={e => setForm(f => ({ ...f, cliente_dni: e.target.value }))} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Teléfono</label>
                  <input className="form-control" value={form.cliente_telefono} onChange={e => setForm(f => ({ ...f, cliente_telefono: e.target.value }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Matrícula coche en taller</label>
                  <input className="form-control" placeholder="Ej: 1234ABC" value={form.coche_cliente_matricula} onChange={e => setForm(f => ({ ...f, coche_cliente_matricula: e.target.value.toUpperCase() }))} />
                </div>
                <div className="col-12">
                  <label className="form-label fw-semibold">Foto del carnet de conducir</label>
                  <div className="d-flex gap-3 flex-wrap mt-1">
                    <div className="text-center">
                      <input ref={frenteRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleCarnetFrente} />
                      <button type="button" className="btn btn-outline-primary d-flex flex-column align-items-center px-4 py-3" style={{ minWidth: 130 }} onClick={() => frenteRef.current.click()}>
                        <i className="fas fa-camera fa-2x mb-1" />
                        <span className="small">Frente</span>
                      </button>
                      {carnetFrentePreview && <img src={carnetFrentePreview} alt="Frente" className="mt-2 rounded border" style={{ height: 80, width: 130, objectFit: "cover" }} />}
                    </div>
                    <div className="text-center">
                      <input ref={versoRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleCarnetVerso} />
                      <button type="button" className="btn btn-outline-primary d-flex flex-column align-items-center px-4 py-3" style={{ minWidth: 130 }} onClick={() => versoRef.current.click()}>
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

          <div className="card mb-3">
            <div className="card-header fw-bold">Coche de sustitución</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Matrícula *</label>
                  <input className="form-control" value={form.matricula} onChange={e => setForm(f => ({ ...f, matricula: e.target.value.toUpperCase() }))} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Marca</label>
                  <input className="form-control" value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Modelo</label>
                  <input className="form-control" value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Kilómetros</label>
                  <input type="number" className="form-control" value={form.km_entrega} onChange={e => setForm(f => ({ ...f, km_entrega: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Combustible</label>
                  <select className="form-select" value={form.combustible_entrega} onChange={e => setForm(f => ({ ...f, combustible_entrega: e.target.value }))}>
                    {COMBUSTIBLE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Estado / daños existentes</label>
                  <textarea className="form-control" rows={3} value={form.estado_entrega} onChange={e => setForm(f => ({ ...f, estado_entrega: e.target.value }))} placeholder="Describa rasguños, golpes u otros daños previos..." />
                </div>
                <div className="col-12">
                  <label className="form-label fw-semibold">Fotos del coche (arañazos, golpes, etc.)</label>
                  <div className="mt-1">
                    <input ref={fotoCocheRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFotos} />
                    <button type="button" className="btn btn-outline-secondary d-flex align-items-center gap-2 px-3 py-2" onClick={() => fotoCocheRef.current.click()}>
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

          <div className="card mb-3">
            <div className="card-header fw-bold">Firma y consentimiento</div>
            <div className="card-body">
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
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar y generar contrato"}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => { setVista("lista"); resetForm(); }}>Cancelar</button>
          </div>
        </form>
      </div>
    );
  }

  // ─── FORMULARIO DEVOLUCIÓN ─────────────────────────────────────────
  if (vista === "devolucion" && seleccionado) {
    return (
      <div className="container py-4" style={{ maxWidth: 720 }}>
        <button className="btn btn-outline-secondary btn-sm mb-3" onClick={() => { setVista("lista"); setError(""); }}>← Volver</button>
        <h4 className="fw-bold mb-1">Registrar devolución</h4>
        <p className="text-muted mb-4">{seleccionado.matricula} — {seleccionado.cliente_nombre}</p>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleDevolucion}>
          <div className="card mb-3">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Kilómetros devolución</label>
                  <input type="number" className="form-control" value={formDev.km_devolucion} onChange={e => setFormDev(f => ({ ...f, km_devolucion: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Combustible</label>
                  <select className="form-select" value={formDev.combustible_devolucion} onChange={e => setFormDev(f => ({ ...f, combustible_devolucion: e.target.value }))}>
                    {COMBUSTIBLE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Observaciones devolución</label>
                  <textarea className="form-control" rows={3} value={formDev.estado_devolucion} onChange={e => setFormDev(f => ({ ...f, estado_devolucion: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>
          <SignaturePad title="Firma del cliente (devolución) *" value={formDev.firma_devolucion} onChange={v => setFormDev(f => ({ ...f, firma_devolucion: v }))} height={160} />
          <div className="d-flex gap-2 mt-2">
            <button type="submit" className="btn btn-success" disabled={guardando}>{guardando ? "Guardando..." : "Confirmar devolución"}</button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setVista("lista")}>Cancelar</button>
          </div>
        </form>
      </div>
    );
  }

  // ─── LISTA ─────────────────────────────────────────────────────────
  return (
    <div className="container py-4">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-0">Coches de sustitución</h4>
          <p className="text-muted small mb-0">Préstamos a clientes mientras su vehículo está en taller</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setError(""); setVista("nuevo"); }}>
          + Nuevo préstamo
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="text-center py-5 text-muted">Cargando...</div>
      ) : lista.length === 0 ? (
        <div className="text-center py-5 text-muted">No hay registros todavía</div>
      ) : (
        <div className="table-responsive">
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
                    <div className="d-flex gap-1">
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => { setSeleccionado(item); setVista("imprimir"); }}>
                        Imprimir
                      </button>
                      {!item.devuelto && (
                        <button className="btn btn-outline-success btn-sm" onClick={() => { setSeleccionado(item); setFormDev({ km_devolucion: "", combustible_devolucion: "lleno", estado_devolucion: "", firma_devolucion: "" }); setVista("devolucion"); }}>
                          Devolver
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── CONTRATO IMPRIMIBLE ───────────────────────────────────────────────────────
function ImprimirContrato({ item, onVolver }) {
  const esDev = !!item.fecha_devolucion;

  return (
    <div>
      <div className="d-print-none d-flex gap-2 p-3">
        <button className="btn btn-primary" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        <button className="btn btn-outline-secondary" onClick={onVolver}>Volver al listado</button>
      </div>

      <div className="contrato-print px-4 py-3" style={{ maxWidth: 800, margin: "0 auto", fontFamily: "Arial, sans-serif", fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, borderBottom: "2px solid #000", paddingBottom: 12 }}>
          <div>
            <div style={{ fontWeight: "bold", fontSize: 16 }}>SpecialWash Studio</div>
            <div style={{ fontSize: 12, color: "#555" }}>Calle Salvador Dalí, 22 · CP 29700</div>
            <div style={{ fontSize: 12, color: "#555" }}>Tel: 645 811 313 · CIF: B21816566</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#777" }}>Nº Contrato</div>
            <div style={{ fontWeight: "bold", fontSize: 15 }}>{String(item.id).padStart(4, "0")}</div>
            <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>Fecha entrega</div>
            <div style={{ fontSize: 12 }}>{fmtFecha(item.fecha_entrega)}</div>
            {esDev && <>
              <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>Fecha devolución</div>
              <div style={{ fontSize: 12 }}>{fmtFecha(item.fecha_devolucion)}</div>
            </>}
          </div>
        </div>

        <div className="text-center mb-3">
          <h5 className="fw-bold mb-0" style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>Contrato de Cesión Temporal de Vehículo de Sustitución</h5>
        </div>

        <Seccion titulo="DATOS DEL CLIENTE">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <Fila label="Nombre" value={item.cliente_nombre} />
              <Fila label="DNI / NIE" value={item.cliente_dni} />
              <Fila label="Teléfono" value={item.cliente_telefono || "-"} />
              <Fila label="Vehículo en taller" value={item.coche_cliente_matricula || "-"} />
            </tbody>
          </table>
          {(item.carnet_foto || item.carnet_foto_verso) && (
            <div className="mt-2 d-flex gap-3 flex-wrap">
              {item.carnet_foto && (
                <div>
                  <strong style={{ fontSize: 11 }}>Carnet — Frente</strong><br />
                  <img src={`/api/coche-sustitucion/media/${item.carnet_foto}`} alt="Frente" style={{ maxHeight: 90, maxWidth: 150, objectFit: "contain", border: "1px solid #ccc", marginTop: 4 }} />
                </div>
              )}
              {item.carnet_foto_verso && (
                <div>
                  <strong style={{ fontSize: 11 }}>Carnet — Verso</strong><br />
                  <img src={`/api/coche-sustitucion/media/${item.carnet_foto_verso}`} alt="Verso" style={{ maxHeight: 90, maxWidth: 150, objectFit: "contain", border: "1px solid #ccc", marginTop: 4 }} />
                </div>
              )}
            </div>
          )}
        </Seccion>

        <Seccion titulo="VEHÍCULO DE SUSTITUCIÓN">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <Fila label="Matrícula" value={item.matricula} />
              <Fila label="Marca / Modelo" value={`${item.marca || "-"} ${item.modelo || ""}`.trim()} />
              <Fila label="Kilómetros entrega" value={item.km_entrega ?? "-"} />
              <Fila label="Combustible entrega" value={item.combustible_entrega || "-"} />
              <Fila label="Estado / daños previos" value={item.estado_entrega || "Sin daños anotados"} />
            </tbody>
          </table>
          {item.fotos_entrega && item.fotos_entrega.length > 0 && (
            <div className="mt-2 d-flex flex-wrap gap-2">
              {item.fotos_entrega.map((f, i) => (
                <img key={i} src={`/api/coche-sustitucion/media/${f}`} alt="" style={{ height: 80, width: 80, objectFit: "cover", border: "1px solid #ccc" }} />
              ))}
            </div>
          )}
        </Seccion>

        {esDev && (
          <Seccion titulo="DEVOLUCIÓN">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <Fila label="Kilómetros devolución" value={item.km_devolucion ?? "-"} />
                <Fila label="Combustible devolución" value={item.combustible_devolucion || "-"} />
                <Fila label="Observaciones" value={item.estado_devolucion || "-"} />
              </tbody>
            </table>
          </Seccion>
        )}

        <Seccion titulo="CONDICIONES DE USO">
          <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
            <li>El conductor se responsabiliza del uso correcto del vehículo durante el préstamo.</li>
            <li>Cualquier multa o infracción cometida durante el período de préstamo es responsabilidad exclusiva del conductor.</li>
            <li>El vehículo debe devolverse en el mismo estado en que fue entregado.</li>
            <li>El conductor deberá estar en posesión de permiso de conducir vigente.</li>
            <li>Queda prohibido el uso del vehículo fuera del territorio nacional sin autorización expresa.</li>
          </ul>
        </Seccion>

        <Seccion titulo="PROTECCIÓN DE DATOS (RGPD)">
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            Los datos personales y la fotografía del carnet de conducir se tratarán conforme al Reglamento (UE) 2016/679 (RGPD) con la única finalidad de identificar al conductor en caso de infracción de tráfico. Los datos se conservarán un mínimo de <strong>1 año</strong>. El responsable del tratamiento es el taller. Puede ejercer sus derechos de acceso, rectificación y supresión contactando directamente con nosotros.
          </p>
          <p style={{ marginTop: 8, marginBottom: 0 }}>
            <strong>Consentimiento RGPD:</strong> {item.consentimiento_rgpd ? "✓ Aceptado por el cliente" : "Pendiente"}
          </p>
        </Seccion>

        <div style={{ display: "flex", gap: 24, marginTop: 32 }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ marginBottom: 4, fontWeight: "bold", fontSize: 12 }}>Firma del cliente (entrega)</p>
            {item.firma_cliente
              ? <img src={item.firma_cliente} alt="Firma" style={{ width: "100%", maxHeight: 100, objectFit: "contain", border: "1px solid #ccc" }} />
              : <div style={{ height: 80, border: "1px solid #ccc" }} />}
            <div style={{ borderTop: "1px solid #000", marginTop: 8, paddingTop: 4, fontSize: 11 }}>{item.cliente_nombre}</div>
            <div style={{ fontSize: 10, color: "#666" }}>DNI/NIE: {item.cliente_dni}</div>
          </div>
          {esDev && (
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ marginBottom: 4, fontWeight: "bold", fontSize: 12 }}>Firma del cliente (devolución)</p>
              {item.firma_devolucion
                ? <img src={item.firma_devolucion} alt="Firma" style={{ width: "100%", maxHeight: 100, objectFit: "contain", border: "1px solid #ccc" }} />
                : <div style={{ height: 80, border: "1px solid #ccc" }} />}
              <div style={{ borderTop: "1px solid #000", marginTop: 8, paddingTop: 4, fontSize: 11 }}>{item.cliente_nombre}</div>
              <div style={{ fontSize: 10, color: "#666" }}>DNI/NIE: {item.cliente_dni}</div>
            </div>
          )}
          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ marginBottom: 4, fontWeight: "bold", fontSize: 12 }}>Sello / Firma del taller</p>
            <div style={{ height: 80, border: "1px solid #ccc" }} />
            <div style={{ borderTop: "1px solid #000", marginTop: 8, paddingTop: 4, fontSize: 11 }}>SpecialWash Studio</div>
            <div style={{ fontSize: 10, color: "#666" }}>CIF: B21816566</div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .d-print-none { display: none !important; }
          nav, header, aside, .sidebar, [class*="sidebar"], [class*="navbar"], [class*="Sidebar"], [class*="Navbar"] { display: none !important; }
          body { margin: 0 !important; background: white !important; color: black !important; }
          body * { color: black !important; background: transparent !important; box-shadow: none !important; }
          .contrato-print { max-width: 100% !important; background: white !important; }
          .contrato-print img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .contrato-seccion { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

function Seccion({ titulo, children }) {
  return (
    <div className="contrato-seccion" style={{ marginBottom: 16, pageBreakInside: "avoid" }}>
      <div style={{ background: "#f0f0f0", padding: "4px 8px", fontWeight: "bold", fontSize: 12, marginBottom: 6 }}>{titulo}</div>
      {children}
    </div>
  );
}

function Fila({ label, value }) {
  return (
    <tr>
      <td style={{ padding: "3px 8px", fontWeight: "bold", width: "35%", borderBottom: "1px solid #eee" }}>{label}</td>
      <td style={{ padding: "3px 8px", borderBottom: "1px solid #eee" }}>{value}</td>
    </tr>
  );
}
