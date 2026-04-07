import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Context } from "../store/appContext";

// ------- CONFIGURACIÓN DE GARANTÍA -------
const DAYS_WARNING = 90;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function getWarrantyInfo(m) {
  if (!m.fecha_compra) {
    return { hasDate: false, status: "unknown", daysRemaining: null, endDate: null };
  }

  const buy = new Date(m.fecha_compra);
  if (isNaN(buy.getTime())) {
    return { hasDate: false, status: "unknown", daysRemaining: null, endDate: null };
  }

  const end = new Date(buy);
  end.setFullYear(end.getFullYear() + 2);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffDays = Math.round((end - today) / MS_PER_DAY);

  let status = "ok";
  if (diffDays < 0) status = "expired";
  else if (diffDays <= DAYS_WARNING) status = "warning";

  return { hasDate: true, status, daysRemaining: diffDays, endDate: end };
}

function fmtDate(d) {
  if (!d) return "-";
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? "-" : dt.toLocaleDateString("es-ES");
}

export default function Maquinaria() {
  const { store, actions } = useContext(Context);
  const facturaCamaraRef = useRef(null);
  const facturaArchivoRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrMsg, setOcrMsg] = useState("");
  const [facturaFile, setFacturaFile] = useState(null);
  const [facturaUploading, setFacturaUploading] = useState(false);
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState({
    nombre: "",
    descuento: "",
    marca: "",
    modelo: "",
    numero_serie: "",
    ubicacion: "",
    estado: "",
    fecha_compra: "",
    precio_sin_iva: "",
    iva: "",
    precio_con_iva: "",
    cantidad: "",
    notas: "",
  });

  // ---------------- LOAD ----------------
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await actions.getMaquinaria();
      } finally {
        setLoading(false);
      }
    })();
  }, [actions]);

  // ---------------- FILTER ----------------
  const items = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = store.maquinaria || [];
    if (!q) return list;

    return list.filter((m) => {
      const s = `${m.nombre} ${m.tipo} ${m.marca} ${m.modelo} ${m.numero_serie} ${m.ubicacion}`
        .toLowerCase();
      return s.includes(q);
    });
  }, [store.maquinaria, filter]);

  const proximasGarantia = useMemo(
    () => items.filter((m) => getWarrantyInfo(m).status === "warning"),
    [items]
  );

  // ---------------- FORM HANDLERS ----------------
  const startCreate = () => {
    setFormError("");
    setEditing({});
    setOcrFile(null);
    setOcrMsg("");
    setFacturaFile(null);
    setForm({
      nombre: "",
      tipo: "",
      marca: "",
      modelo: "",
      numero_serie: "",
      ubicacion: "",
      estado: "",
      fecha_compra: "",
      precio_sin_iva: "",
      iva: "",
      precio_con_iva: "",
      cantidad: "",
      notas: "",
    });
  };

  const startEdit = (m) => {
    setEditing(m);
    setOcrFile(null);
    setOcrMsg("");
    setFacturaFile(null);
    setForm({
      nombre: m.nombre || "",
      descuento: m.descuento ?? "",
      marca: m.marca || "",
      modelo: m.modelo || "",
      numero_serie: m.numero_serie || "",
      ubicacion: m.ubicacion || "",
      estado: m.estado || "",
      fecha_compra: (m.fecha_compra || "").slice(0, 10),
      precio_sin_iva: m.precio_sin_iva ?? "",
      iva: m.iva ?? "",
      precio_con_iva: m.precio_con_iva ?? "",
      cantidad: m.cantidad ?? "",
      notas: m.notas || "",
    });
  };

  const cancel = () => {
    setFormError("");
    setEditing(null);
    setOcrFile(null);
    setOcrMsg("");
    setFacturaFile(null);
    setForm({
      nombre: "",
      descuento: "",
      marca: "",
      modelo: "",
      numero_serie: "",
      ubicacion: "",
      estado: "",
      fecha_compra: "",
      precio_sin_iva: "",
      iva: "",
      precio_con_iva: "",
      cantidad: "",
      notas: "",
    });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setFormError("El nombre es obligatorio"); return; }
    setFormError("");

    const payload = {
      nombre: form.nombre.trim(),
      descuento: form.descuento !== "" ? parseFloat(form.descuento) : 0,
      marca: form.marca.trim() || undefined,
      modelo: form.modelo.trim() || undefined,
      numero_serie: form.numero_serie.trim() || undefined,
      ubicacion: form.ubicacion.trim() || undefined,
      estado: form.estado.trim() || undefined,
      fecha_compra: form.fecha_compra || undefined,
      precio_sin_iva: form.precio_sin_iva !== "" ? parseFloat(form.precio_sin_iva) : 0,
      iva: form.iva !== "" ? parseFloat(form.iva) : 0,
      precio_con_iva: form.precio_con_iva !== "" ? parseFloat(form.precio_con_iva) : 0,
      cantidad: form.cantidad !== "" ? parseInt(form.cantidad) : 1,
      notas: form.notas.trim() || undefined,
    };

    try {
      const saved = editing?.id
        ? await actions.updateMaquina(editing.id, payload)
        : await actions.createMaquina(payload);

      if (facturaFile) {
        setFacturaUploading(true);
        await actions.subirFacturaMaquinaria(saved.id, facturaFile);
      }

      cancel();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFacturaUploading(false);
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`¿Eliminar máquina "${m.nombre}"?`)) return;
    try {
      await actions.deleteMaquina(m.id);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => {
      const updated = { ...f, [name]: value };
      // Cálculo automático del precio con IVA considerando descuento
      if (["precio_sin_iva", "iva", "descuento"].includes(name)) {
        const base = parseFloat(name === "precio_sin_iva" ? value : updated.precio_sin_iva) || 0;
        const ivaVal = parseFloat(name === "iva" ? value : updated.iva) || 0;
        const desc = parseFloat(name === "descuento" ? value : updated.descuento) || 0;
        const baseConDescuento = base * (1 - desc / 100);
        updated.precio_con_iva = (baseConDescuento + (baseConDescuento * ivaVal / 100)).toFixed(2);
      }
      return updated;
    });
  };

  const aplicarSugerenciaOCR = async () => {
    if (!ocrFile) {
      setOcrMsg("Selecciona una imagen de factura/albaran para escanear.");
      return;
    }

    setOcrLoading(true);
    setOcrMsg("");
    try {
      const data = await actions.sugerirMaquinariaOCR(ocrFile);
      setForm((prev) => {
        const next = {
          ...prev,
          nombre: data?.nombre || prev.nombre,
          marca: data?.marca || prev.marca,
          modelo: data?.modelo || prev.modelo,
          numero_serie: data?.numero_serie || prev.numero_serie,
          fecha_compra: data?.fecha_compra || prev.fecha_compra,
          precio_sin_iva:
            data?.precio_sin_iva != null && Number.isFinite(Number(data.precio_sin_iva))
              ? String(data.precio_sin_iva)
              : prev.precio_sin_iva,
          iva:
            data?.iva != null && Number.isFinite(Number(data.iva))
              ? String(data.iva)
              : prev.iva,
          cantidad:
            data?.cantidad != null && Number.isFinite(Number(data.cantidad))
              ? String(data.cantidad)
              : prev.cantidad,
        };

        const base = parseFloat(next.precio_sin_iva) || 0;
        const ivaVal = parseFloat(next.iva) || 0;
        const desc = parseFloat(next.descuento) || 0;
        const baseConDescuento = base * (1 - desc / 100);
        next.precio_con_iva = (baseConDescuento + (baseConDescuento * ivaVal / 100)).toFixed(2);

        return next;
      });
      setOcrMsg("Sugerencias OCR aplicadas. Puedes ajustar cualquier campo manualmente.");
    } catch (err) {
      setOcrMsg(err?.message || "No se pudo leer el documento con OCR.");
    } finally {
      setOcrLoading(false);
    }
  };

  const facturasDe = (m) => (Array.isArray(m?.facturas_cloudinary) ? m.facturas_cloudinary : []);

  const facturaUrl = (factura) => {
    if (!factura) return "";
    if (typeof factura === "string") return factura;
    return factura.url || "";
  };

  const facturaNombre = (factura, index) => {
    if (!factura) return `Factura ${index + 1}`;
    if (typeof factura === "string") return `Factura ${index + 1}`;
    return factura.original_filename || `Factura ${index + 1}`;
  };

  const eliminarFactura = async (facturaIndex) => {
    if (!editing?.id) return;
    if (!window.confirm("¿Eliminar esta factura de la maquinaria?")) return;

    try {
      const data = await actions.eliminarFacturaMaquinaria(editing.id, facturaIndex);
      if (data?.maquinaria) setEditing(data.maquinaria);
    } catch (err) {
      setFormError(err.message || "No se pudo eliminar la factura.");
    }
  };

  // ---------------- UI ----------------
  return (
    <div className="container py-4" style={{ maxWidth: "1100px" }}>
      
      {/* HEADER PREMIUM */}
      <div
        className="d-flex justify-content-between align-items-center p-3 mb-4 shadow-sm sw-machinery-header"
        style={{
          background: "#0f0f0f",
          borderRadius: "12px",
          color: "white",
        }}
      >
        <h2 className="fw-bold m-0" style={{ color: "#d4af37" }}>⚙️ Maquinaria</h2>

        <button
          className="btn"
          onClick={startCreate}
          style={{
            background: "#d4af37",
            color: "black",
            fontWeight: "600",
            borderRadius: "8px",
          }}
        >
          ➕ Nueva máquina
        </button>
      </div>

      {/* BADGES RESUMEN */}
      <div className="d-flex gap-3 mb-3 sw-machinery-summary">
        <span className="badge text-bg-secondary fs-6 px-3 py-2">
          Total: {items.length}
        </span>
        <span className="badge text-bg-warning text-dark fs-6 px-3 py-2">
          Garantía por vencer: {proximasGarantia.length}
        </span>
      </div>

      {/* ALERTA GARANTÍA */}
      {proximasGarantia.length > 0 && (
        <div className="alert alert-warning shadow-sm" style={{ borderRadius: "10px" }}>
          <strong>{proximasGarantia.length}</strong> máquina(s) con garantía próxima a vencer.
          <details className="mt-2">
            <summary>Ver detalle</summary>
            <ul className="mt-2">
              {proximasGarantia.slice(0, 8).map((m) => {
                const info = getWarrantyInfo(m);
                return (
                  <li key={m.id}>
                    {m.nombre} — vence {fmtDate(info.endDate)} ({info.daysRemaining} días)
                  </li>
                );
              })}
              {proximasGarantia.length > 8 && (
                <li>… y {proximasGarantia.length - 8} más</li>
              )}
            </ul>
          </details>
        </div>
      )}

      {/* BUSCADOR */}
      <div className="row g-2 mb-4">
        <div className="col-md-6">
          <input
            className="form-control"
            placeholder="Buscar maquinaria…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ borderRadius: "10px" }}
          />
        </div>
      </div>

      {/* FORMULARIO */}
      {editing !== null && (
        <div
          className="card shadow-sm mb-4"
          style={{ borderRadius: "14px", border: "1px solid var(--sw-accent)" }}
        >
          <div className="card-body">
            <h5 className="fw-bold mb-3">
              {editing?.id ? "Editar máquina" : "Nueva máquina"}
            </h5>

            <form onSubmit={save} className="row g-3">
              <div className="col-12">
                <div className="alert alert-info mb-0" role="alert">
                  <strong>Nota:</strong> El bloque OCR solo sugiere datos. La factura se guarda en el sistema desde "Factura de compra" al pulsar "Guardar".
                </div>
              </div>

              <div className="col-12">
                <label className="form-label fw-semibold">Escaneo OCR (opcional, no guarda factura)</label>
                <div className="d-flex gap-2 flex-wrap">
                  <input
                    type="file"
                    className="form-control"
                    style={{ maxWidth: "420px" }}
                    accept="image/*"
                    onChange={(e) => {
                      setOcrFile(e.target.files?.[0] || null);
                      setOcrMsg("");
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-dark"
                    disabled={ocrLoading}
                    onClick={aplicarSugerenciaOCR}
                  >
                    {ocrLoading ? "Leyendo..." : "Escanear OCR"}
                  </button>
                </div>
                {!ocrMsg && (
                  <small className="text-muted d-block mt-1">
                    OCR sugiere nombre, marca, modelo, serie, fecha, precio, IVA y cantidad. Sirve para autocompletar.
                  </small>
                )}
                {ocrMsg && <small className="text-muted d-block mt-1">{ocrMsg}</small>}
              </div>

              <div className="col-12">
                <label className="form-label fw-semibold">Factura de compra (se guarda en el sistema)</label>

                <input
                  ref={facturaCamaraRef}
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="d-none"
                  onChange={(e) => setFacturaFile(e.target.files?.[0] || null)}
                />
                <input
                  ref={facturaArchivoRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="d-none"
                  onChange={(e) => setFacturaFile(e.target.files?.[0] || null)}
                />

                <div className="d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-dark"
                    onClick={() => facturaCamaraRef.current?.click()}
                  >
                    📷 Sacar foto factura
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => facturaArchivoRef.current?.click()}
                  >
                    📎 Subir archivo factura
                  </button>
                  {facturaFile && (
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => setFacturaFile(null)}
                    >
                      Quitar selección
                    </button>
                  )}
                </div>

                <small className="text-muted d-block mt-1">
                  Formatos permitidos: PDF o imágenes. Esta es la sección correcta para guardar factura.
                </small>
                {facturaFile && (
                  <small className="d-block mt-1 text-success">
                    Archivo seleccionado: {facturaFile.name}
                  </small>
                )}
              </div>

              {editing?.id && facturasDe(editing).length > 0 && (
                <div className="col-12">
                  <label className="form-label fw-semibold">Facturas guardadas</label>
                  <div className="d-flex flex-column gap-2">
                    {facturasDe(editing).map((factura, index) => {
                      const url = facturaUrl(factura);
                      return (
                        <div
                          key={`${editing.id}-factura-${index}`}
                          className="d-flex align-items-center justify-content-between border rounded px-3 py-2"
                        >
                          <div className="text-truncate me-2">{facturaNombre(factura, index)}</div>
                          <div className="d-flex gap-2">
                            {url && (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-outline-primary"
                              >
                                Ver
                              </a>
                            )}
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => eliminarFactura(index)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {Object.entries({
                nombre: "Nombre *",
                marca: "Marca",
                modelo: "Modelo",
                numero_serie: "Nº Serie",
                ubicacion: "Ubicación",
                estado: "Estado",
              }).map(([key, label]) => (
                <div className="col-md-6" key={key}>
                  <label className="form-label">{label}</label>
                  <input
                    className="form-control"
                    name={key}
                    value={form[key]}
                    onChange={onChange}
                    required={key === "nombre"}
                    style={{ borderRadius: "10px" }}
                  />
                </div>
              ))}

              <div className="col-md-3">
                <label className="form-label">Descuento (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  name="descuento"
                  value={form.descuento}
                  onChange={onChange}
                  style={{ borderRadius: "10px" }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Fecha compra</label>
                <input
                  type="date"
                  className="form-control"
                  name="fecha_compra"
                  value={form.fecha_compra}
                  onChange={onChange}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label">Precio sin IVA (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  name="precio_sin_iva"
                  value={form.precio_sin_iva}
                  onChange={onChange}
                  style={{ borderRadius: "10px" }}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label">IVA (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  name="iva"
                  value={form.iva}
                  onChange={onChange}
                  style={{ borderRadius: "10px" }}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label">Precio con IVA (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  name="precio_con_iva"
                  value={form.precio_con_iva}
                  readOnly
                  style={{ borderRadius: "10px", backgroundColor: "#f0f0f0" }}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label">Cantidad</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  className="form-control"
                  name="cantidad"
                  value={form.cantidad}
                  onChange={onChange}
                  style={{ borderRadius: "10px" }}
                />
              </div>

              <div className="col-12">
                <label className="form-label">Notas</label>
                <textarea
                  className="form-control"
                  rows="3"
                  name="notas"
                  value={form.notas}
                  onChange={onChange}
                  style={{ borderRadius: "10px" }}
                />
              </div>

              {formError && (
                <div className="col-12">
                  <div className="alert alert-danger d-flex justify-content-between align-items-start py-2 mb-0">
                    <span>{formError}</span>
                    <button className="btn-close ms-3" onClick={() => setFormError("")} />
                  </div>
                </div>
              )}

              <div className="col-12 mt-3 d-flex gap-2">
                <button
                  className="btn"
                  type="submit"
                  disabled={facturaUploading}
                  style={{
                    background: "#d4af37",
                    color: "black",
                    fontWeight: "600",
                    borderRadius: "8px",
                    paddingLeft: "1rem",
                    paddingRight: "1rem",
                  }}
                >
                  {facturaUploading ? "Subiendo factura..." : "💾 Guardar"}
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={cancel}
                  style={{
                    borderColor: "#d4af37",
                    color: "#d4af37",
                    background: "transparent",
                    borderStyle: "solid",
                    borderWidth: "1px",
                    borderRadius: "8px",
                    paddingLeft: "1rem",
                    paddingRight: "1rem",
                  }}
                >
                  Cancelar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* TABLA */}
      <div className="card shadow-sm" style={{ borderRadius: "14px" }}>
        <div className="table-responsive sw-machinery-table-responsive">
          <table className="table align-middle">
            <thead className="table-light">
              <tr>
                <th>Nombre</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Ubicación</th>
                <th>Estado</th>
                <th className="text-end">P. sin IVA</th>
                <th className="text-end">IVA %</th>
                <th className="text-end">P. con IVA</th>
                <th className="text-center">Cant.</th>
                <th className="text-center">Facturas</th>
                <th>Garantía</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr><td colSpan="13" className="text-center py-4">Cargando…</td></tr>
              )}

              {!loading && items.length === 0 && (
                <tr><td colSpan="13" className="text-center text-muted py-4">Sin maquinaria</td></tr>
              )}

              {!loading &&
                items.map((m) => {
                  const info = getWarrantyInfo(m);

                  let rowClass = "";
                  if (info.status === "expired") rowClass = "table-danger";
                  else if (info.status === "warning") rowClass = "table-warning";

                  let badgeClass = "badge bg-secondary";
                  let text = "No registrada";

                  if (info.status === "expired") {
                    badgeClass = "badge bg-danger";
                    text = `Expirada (${fmtDate(info.endDate)})`;
                  } else if (info.status === "warning") {
                    badgeClass = "badge bg-warning text-dark";
                    text = `Vence en ${info.daysRemaining} días`;
                  } else if (info.status === "ok") {
                    badgeClass = "badge bg-success";
                    text = `Vigente hasta ${fmtDate(info.endDate)}`;
                  }

                  return (
                    <tr key={m.id} className={rowClass}>
                      <td>{m.nombre}</td>
                      <td>{m.marca || "-"}</td>
                      <td>{m.modelo || "-"}</td>
                      <td>{m.ubicacion || "-"}</td>
                      <td>{m.estado || "-"}</td>
                      <td className="text-end">{(m.precio_sin_iva ?? 0).toFixed(2)} €</td>
                      <td className="text-end">{(m.iva ?? 0).toFixed(2)}%</td>
                      <td className="text-end">{(m.precio_con_iva ?? 0).toFixed(2)} €</td>
                      <td className="text-center">{m.cantidad ?? 1}</td>
                      <td className="text-center">
                        {facturasDe(m).length > 0 ? (
                          <div className="d-flex flex-column gap-1 align-items-center">
                            <span className="badge bg-info text-dark">{facturasDe(m).length}</span>
                            {facturaUrl(facturasDe(m)[0]) && (
                              <a
                                href={facturaUrl(facturasDe(m)[0])}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-outline-info"
                              >
                                Ver última
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td><span className={badgeClass}>{text}</span></td>

                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-outline-primary me-1"
                          onClick={() => startEdit(m)}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          disabled={facturaUploading}
                          onClick={() => remove(m)}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>

          </table>
        </div>
      </div>

    </div>
  );
}