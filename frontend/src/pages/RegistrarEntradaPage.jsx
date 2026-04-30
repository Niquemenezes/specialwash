import React, {
  useEffect,
  useMemo,
  useState,
  useContext,
} from "react";
import { Context } from "../store/appContext";
import ProductoFormModal from "../components/ProductoFormModal.jsx";
import GoldSelect from "../components/GoldSelect.jsx";
import { confirmar } from "../utils/confirmar";
import EmptyState from "../components/EmptyState.jsx";

/* ======================
   Utils
====================== */
const fmtDateTime = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? "-"
    : d.toLocaleString("es-ES", {
        dateStyle: "short",
        timeStyle: "short",
      });
};

/* ── Iconos SVG ────────────────────────────────────────────────── */
const ICONS = {
  scan:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 9h.01M7 12h.01M7 15h.01M11 9h6M11 12h6M11 15h6"/></svg>),
  camera:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>),
  upload:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>),
  box:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>),
  plus:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  edit:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
  trash:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>),
  back:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>),
  spinner: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sw-veh-spinner"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>),
};

/* ── Feedback banner ────────────────────────────────────────────── */
const Feedback = ({ msg, type, onClose }) => {
  if (!msg) return null;
  const colors = {
    success: { border: "#22c55e", bg: "rgba(34,197,94,0.08)", text: "#86efac" },
    danger:  { border: "#ef4444", bg: "rgba(239,68,68,0.08)",  text: "#fca5a5" },
    warning: { border: "#f59e0b", bg: "rgba(245,158,11,0.08)", text: "#fcd34d" },
  };
  const c = colors[type] || colors.warning;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      gap: "0.75rem", padding: "0.85rem 1.1rem", borderRadius: 10, marginBottom: "1.25rem",
      background: c.bg, border: `1px solid ${c.border}30`, color: c.text,
      fontSize: "0.875rem", fontWeight: 500, animation: "sw-fade-up 0.3s ease both",
    }}>
      <span>{msg}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "inherit", opacity: 0.6, cursor: "pointer", padding: 0, lineHeight: 1, fontSize: "1rem" }}>✕</button>
    </div>
  );
};

/* ── Totales row ────────────────────────────────────────────────── */
const TotalesRow = ({ subtotal, descuento, totalSinIva, totalIva, ivaPct, totalConIva }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "0.6rem", padding: "1rem 1.1rem", borderRadius: 10, marginTop: "0.25rem",
    background: "color-mix(in srgb, var(--sw-accent,#d4af37) 5%, var(--sw-surface-2))",
    border: "1px solid color-mix(in srgb, var(--sw-accent,#d4af37) 18%, transparent)",
  }}>
    {[
      { l: "Subtotal",       v: subtotal.toFixed(2) + " €" },
      ...(descuento > 0 ? [{ l: "Descuento", v: "-" + descuento.toFixed(2) + " €" }] : []),
      { l: "Base sin IVA",   v: totalSinIva.toFixed(2) + " €" },
      { l: `IVA (${ivaPct}%)`, v: totalIva.toFixed(2) + " €" },
      { l: "Total con IVA",  v: totalConIva.toFixed(2) + " €", accent: true },
    ].map((item) => (
      <div key={item.l} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)", opacity: 0.8 }}>{item.l}</span>
        <span style={{ fontSize: item.accent ? "1.05rem" : "0.9rem", fontWeight: item.accent ? 700 : 500, color: item.accent ? "var(--sw-accent,#d4af37)" : "var(--sw-text)" }}>{item.v}</span>
      </div>
    ))}
  </div>
);

const Field = ({ label, required, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
    <label className="sw-plbl">
      {label}
      {required && <span style={{ color: "var(--sw-accent,#d4af37)", marginLeft: 2 }}>*</span>}
    </label>
    {children}
  </div>
);

/* ======================
   Componente principal
====================== */
const RegistrarEntradaPage = () => {
  const { store, actions } = useContext(Context);

  const [feedback, setFeedback] = useState(null);

  const [form, setForm] = useState({
    producto_id: "",
    proveedor_id: "",
    cantidad: "",
    tipo_documento: "albaran",
    numero_documento: "",
    precio_unitario: "",
    iva_porcentaje: "21",
    descuento_porcentaje: "0",
  });

  const [saving, setSaving] = useState(false);
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrMsg, setOcrMsg] = useState("");
  const [showNuevo, setShowNuevo] = useState(false);
  const [productoModalInitial, setProductoModalInitial] = useState(null);
  const [editando, setEditando] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    actions.getProductos();
    actions.getProveedores();
    actions.getEntradas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cantidad       = Number(form.cantidad) || 0;
  const precioUnitario = Number(form.precio_unitario) || 0;
  const ivaPct         = Number(form.iva_porcentaje) || 0;
  const descuentoPct   = Number(form.descuento_porcentaje) || 0;
  const subtotal       = precioUnitario * cantidad;
  const descuento      = +(subtotal * (descuentoPct / 100)).toFixed(2);
  const totalSinIva    = +(subtotal - descuento).toFixed(2);
  const totalIva       = +(totalSinIva * (ivaPct / 100)).toFixed(2);
  const totalConIva    = +(totalSinIva + totalIva).toFixed(2);
  const productoSeleccionado = (store.productos || []).find(
    (p) => String(p.id) === String(form.producto_id)
  );

  const openProductoModal = (producto = null) => {
    setProductoModalInitial(producto || null);
    setShowNuevo(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.producto_id || !form.cantidad || !form.precio_unitario) {
      setFeedback({ type: "warning", msg: "Producto, cantidad y precio unitario son obligatorios." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const body = {
        producto_id: Number(form.producto_id),
        proveedor_id: form.proveedor_id ? Number(form.proveedor_id) : null,
        cantidad: Number(form.cantidad),
        precio_unitario: precioUnitario,
        porcentaje_iva: ivaPct,
        descuento_porcentaje: descuentoPct,
        numero_albaran: form.numero_documento || null,
      };
      const res = await actions.registrarEntrada(body);
      setFeedback({
        type: "success",
        msg: `Entrada registrada correctamente. Stock actual: ${res?.producto?.stock_actual ?? "-"}`,
      });
      setForm((f) => ({ ...f, cantidad: "", numero_documento: "", precio_unitario: "" }));
      actions.getEntradas();
      actions.getProductos();
    } catch {
      setFeedback({ type: "danger", msg: "Error al registrar la entrada. Inténtalo de nuevo." });
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = (entrada) => {
    setEditando(entrada);
    setShowEditModal(true);
  };

  const handleEliminar = async (entradaId) => {
    if (!await confirmar("¿Seguro que deseas eliminar esta entrada?")) return;
    try {
      await actions.eliminarEntrada(entradaId);
      setFeedback({ type: "success", msg: "Entrada eliminada correctamente." });
      actions.getEntradas();
      actions.getProductos();
    } catch {
      setFeedback({ type: "danger", msg: "Error al eliminar la entrada." });
    }
  };

  const procesarOcrArchivo = async (file) => {
    if (!file) return;
    setOcrFile(file);
    setOcrMsg("");
    setOcrLoading(true);
    try {
      const sugerencia = await actions.sugerirEntradaOCR(file);
      const hasCantidad   = sugerencia?.cantidad != null && Number.isFinite(Number(sugerencia.cantidad));
      const hasPrecio     = sugerencia?.precio_unitario != null && Number.isFinite(Number(sugerencia.precio_unitario));
      const hasIva        = sugerencia?.porcentaje_iva != null && Number.isFinite(Number(sugerencia.porcentaje_iva));
      const hasDescuento  = sugerencia?.descuento_porcentaje != null && Number.isFinite(Number(sugerencia.descuento_porcentaje));
      const hasNumero     = Boolean((sugerencia?.numero_albaran || "").trim());
      setForm((prev) => ({
        ...prev,
        cantidad:             hasCantidad  ? String(sugerencia.cantidad)            : prev.cantidad,
        precio_unitario:      hasPrecio    ? String(sugerencia.precio_unitario)     : prev.precio_unitario,
        iva_porcentaje:       hasIva       ? String(sugerencia.porcentaje_iva)      : prev.iva_porcentaje,
        descuento_porcentaje: hasDescuento ? String(sugerencia.descuento_porcentaje): prev.descuento_porcentaje,
        numero_documento:     sugerencia?.numero_albaran || prev.numero_documento,
      }));
      const detectedUseful = [hasCantidad, hasPrecio, hasIva, hasDescuento].filter(Boolean).length;
      if (detectedUseful === 0 && !hasNumero) {
        setOcrMsg("warning:No se detectaron datos. Intenta con otra foto más cerca y con mejor luz.");
      } else if (sugerencia?.multiple_items_detected) {
        setOcrMsg("warning:OCR parcial: varios artículos detectados. Revisa los campos antes de guardar.");
      } else {
        setOcrMsg("success:Datos detectados y completados. Revisa y confirma antes de guardar.");
      }
    } catch (err) {
      setOcrMsg("danger:" + (err?.message || "No se pudo leer el documento."));
    } finally {
      setOcrLoading(false);
    }
  };

  const entradasOrdenadas = useMemo(() => {
    return [...(store.entradas || [])].sort(
      (a, b) => new Date(b.created_at || b.fecha) - new Date(a.created_at || a.fecha)
    );
  }, [store.entradas]);

  /* ── Parsear ocrMsg ──────── */
  const ocrMsgType  = ocrMsg ? ocrMsg.split(":")[0] : null;
  const ocrMsgText  = ocrMsg ? ocrMsg.slice(ocrMsgType.length + 1) : "";

  return (
    <div className="sw-ent-wrapper">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="sw-veh-hero">
        <div className="sw-veh-hero-inner container">
          <div className="sw-veh-hero-body">
            <div className="sw-veh-hero-icon" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}>
              <span style={{ width: 24, height: 24, display: "flex" }}>{ICONS.box}</span>
            </div>
            <div>
              <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Inventario · Entradas</p>
              <h1 className="sw-veh-hero-title">Registrar Entrada de Stock</h1>
              <p className="sw-veh-hero-sub">Registra entradas de producto con soporte OCR para albaranes y facturas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container sw-ent-content">
        <Feedback msg={feedback?.msg} type={feedback?.type} onClose={() => setFeedback(null)} />

        {/* ── Tarjeta formulario ───────────────────────────────── */}
        <div className="sw-ent-card">
          <form onSubmit={handleSubmit}>
            <div className="sw-ent-card-body">

              {/* ── Bloque OCR ─────────────────────────────────── */}
              <div className="sw-ent-ocr-block">
                <div className="sw-ent-ocr-header">
                  <span className="sw-ent-ocr-icon">{ICONS.scan}</span>
                  <div>
                    <p className="sw-ent-ocr-title">Escaneo OCR</p>
                    <p className="sw-ent-ocr-sub">Extrae precio, cantidad e IVA directamente de una foto del albarán</p>
                  </div>
                </div>

                {/* Inputs file ocultos */}
                <input id="ocr-camera" type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                  onChange={(e) => procesarOcrArchivo(e.target.files?.[0])} />
                <input id="ocr-gallery" type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => procesarOcrArchivo(e.target.files?.[0])} />

                <div className="sw-ent-ocr-actions">
                  <label htmlFor="ocr-camera" className="sw-ent-ocr-btn sw-ent-ocr-btn--primary"
                    style={{ opacity: ocrLoading ? 0.5 : 1, pointerEvents: ocrLoading ? "none" : "auto" }}>
                    <span style={{ width: 16, height: 16, display: "flex" }}>{ocrLoading ? ICONS.spinner : ICONS.camera}</span>
                    {ocrLoading ? "Escaneando…" : "Escanear Factura"}
                  </label>
                  <label htmlFor="ocr-gallery" className="sw-ent-ocr-btn sw-ent-ocr-btn--outline"
                    style={{ opacity: ocrLoading ? 0.5 : 1, pointerEvents: ocrLoading ? "none" : "auto" }}>
                    <span style={{ width: 16, height: 16, display: "flex" }}>{ICONS.upload}</span>
                    Seleccionar archivo
                  </label>
                </div>

                {ocrFile && !ocrLoading && !ocrMsg && (
                  <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--sw-muted)" }}>
                    {ocrFile.name} ({(ocrFile.size / 1024).toFixed(0)} KB)
                  </p>
                )}
                {!ocrMsg && !ocrFile && (
                  <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--sw-muted)", opacity: 0.7 }}>
                    Toma una foto o selecciona una imagen para extraer los datos automáticamente
                  </p>
                )}
                {ocrMsg && (
                  <Feedback msg={ocrMsgText} type={ocrMsgType} onClose={() => setOcrMsg("")} />
                )}
              </div>

              {/* ── Grid campos ────────────────────────────────── */}
              <div className="sw-ent-grid">
                <Field label="Producto" required>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "stretch" }}>
                    <div style={{ flex: "1 1 260px" }}>
                      <GoldSelect
                        value={form.producto_id}
                        onChange={(v) => setForm((f) => ({ ...f, producto_id: v }))}
                        placeholder="— Seleccione un producto —"
                        options={(store.productos || []).map((p) => ({
                          value: p.id,
                          label: p.nombre + (p.categoria ? ` — ${p.categoria}` : ""),
                        }))}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => openProductoModal(null)}
                      style={{
                        background: "var(--sw-surface-2)",
                        border: "1px solid var(--sw-border)",
                        color: "var(--sw-accent,#d4af37)",
                        borderRadius: "10px",
                        padding: "0.55rem 0.9rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                      }}
                    >
                      + Nuevo producto
                    </button>
                    {productoSeleccionado && (
                      <button
                        type="button"
                        onClick={() => openProductoModal(productoSeleccionado)}
                        style={{
                          background: "var(--sw-surface-2)",
                          border: "1px solid var(--sw-border)",
                          color: "var(--sw-accent,#d4af37)",
                          borderRadius: "10px",
                          padding: "0.55rem 0.9rem",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                        }}
                      >
                        ✏ Editar producto / código
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "var(--sw-muted)" }}>
                    Si lo tienes a mano, puedes guardar aquí el código del fabricante; no es obligatorio.
                  </span>
                  {!form.producto_id && (
                    <span style={{ fontSize: "0.72rem", color: "var(--sw-danger,#ef4444)" }}>
                      Debe seleccionar un producto
                    </span>
                  )}
                </Field>

                <Field label="Proveedor (opcional)">
                  <GoldSelect
                    value={form.proveedor_id || ""}
                    onChange={(v) => setForm((f) => ({ ...f, proveedor_id: v }))}
                    placeholder="— Sin proveedor / opcional —"
                    options={(store.proveedores || []).map((p) => ({
                      value: p.id,
                      label: p.nombre,
                    }))}
                  />
                  <span style={{ fontSize: "0.72rem", color: "var(--sw-muted)" }}>
                    Puedes dejarlo vacío si no quieres indicar proveedor ahora.
                  </span>
                </Field>

                <Field label="Nº Albarán / Factura">
                  <input className="form-control sw-pinput" name="numero_documento"
                    value={form.numero_documento} onChange={handleChange} placeholder="Opcional" />
                </Field>

                <Field label="Cantidad" required>
                  <input type="number" min="1" className="form-control sw-pinput" name="cantidad"
                    value={form.cantidad} onChange={handleChange} required placeholder="0" />
                </Field>

                <Field label="Precio unitario (€ sin IVA)" required>
                  <input type="number" className="form-control sw-pinput" name="precio_unitario"
                    value={form.precio_unitario} onChange={handleChange} min={0} step="0.01" required placeholder="0.00" />
                </Field>

                <Field label="% Descuento">
                  <input type="number" className="form-control sw-pinput" name="descuento_porcentaje"
                    value={form.descuento_porcentaje} onChange={handleChange} min={0} max={100} step="0.01" />
                </Field>

                <Field label="% IVA" required>
                  <input type="number" className="form-control sw-pinput" name="iva_porcentaje"
                    value={form.iva_porcentaje} onChange={handleChange} min={0} step="0.01" required />
                </Field>
              </div>

              {/* ── Totales ────────────────────────────────────── */}
              {cantidad > 0 && precioUnitario > 0 && (
                <TotalesRow subtotal={subtotal} descuento={descuento} totalSinIva={totalSinIva}
                  totalIva={totalIva} ivaPct={ivaPct} totalConIva={totalConIva} />
              )}
            </div>

            {/* ── Footer tarjeta ─────────────────────────────── */}
            <div className="sw-ent-card-footer">
              <button type="submit" className="sw-ent-submit-btn" disabled={saving}>
                {saving ? (
                  <><span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.spinner}</span> Guardando…</>
                ) : (
                  <><span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.plus}</span> Registrar entrada</>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ── Tabla últimas entradas ───────────────────────────── */}
        <div className="sw-ent-table-card">
          <div className="sw-ent-table-header">
            <p className="sw-home-eyebrow" style={{ marginBottom: 0 }}>Historial</p>
            <h3 className="sw-ent-table-title">Últimas entradas registradas</h3>
          </div>

          <div className="table-responsive">
            <table className="table mb-0 sw-ent-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Proveedor</th>
                  <th className="text-end">Uds.</th>
                  <th className="text-end">Sin IVA</th>
                  <th className="text-end">Con IVA</th>
                  <th>Albarán</th>
                  <th style={{ width: 72 }}></th>
                </tr>
              </thead>
              <tbody>
                {entradasOrdenadas.map((ent) => {
                  const prod = (store.productos || []).find((p) => p.id === ent.producto_id);
                  const prov = (store.proveedores || []).find((p) => p.id === ent.proveedor_id);
                  return (
                    <tr key={ent.id}>
                      <td style={{ fontSize: "0.8rem", color: "var(--sw-muted)", whiteSpace: "nowrap" }}>
                        {fmtDateTime(ent.created_at || ent.fecha)}
                      </td>
                      <td style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                        {prod?.nombre || ent.producto_nombre || ent.producto_id}
                      </td>
                      <td style={{ fontSize: "0.82rem", color: "var(--sw-muted)" }}>
                        {prov?.nombre || ent.proveedor_nombre || "—"}
                      </td>
                      <td className="text-end" style={{ fontWeight: 700, color: "var(--sw-accent,#d4af37)" }}>
                        {ent.cantidad}
                      </td>
                      <td className="text-end" style={{ fontSize: "0.82rem" }}>
                        {ent.precio_sin_iva != null && Number(ent.precio_sin_iva) > 0
                          ? Number(ent.precio_sin_iva).toFixed(2) + " €" : "—"}
                      </td>
                      <td className="text-end" style={{ fontWeight: 600 }}>
                        {ent.precio_con_iva != null && Number(ent.precio_con_iva) > 0
                          ? Number(ent.precio_con_iva).toFixed(2) + " €" : "—"}
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "var(--sw-muted)" }}>
                        {ent.numero_albaran || ent.numero_documento || "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="sw-ent-icon-btn" title="Editar" onClick={() => handleEditar(ent)}>
                            <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.edit}</span>
                          </button>
                          <button className="sw-ent-icon-btn sw-ent-icon-btn--danger" title="Eliminar" onClick={() => handleEliminar(ent.id)}>
                            <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.trash}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {entradasOrdenadas.length === 0 && (
                  <EmptyState
                    colSpan={8}
                    title="Sin entradas registradas"
                    subtitle="Registra la primera entrada de stock con el formulario de arriba."
                  />
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal editar */}
      {editando && (
        <EditarEntradaModal
          show={showEditModal}
          entrada={editando}
          productos={store.productos || []}
          proveedores={store.proveedores || []}
          onClose={() => { setShowEditModal(false); setEditando(null); }}
          onSaved={() => {
            setShowEditModal(false);
            setEditando(null);
            actions.getEntradas();
            actions.getProductos();
          }}
        />
      )}

      <ProductoFormModal
        show={showNuevo}
        initial={productoModalInitial}
        onClose={() => {
          setShowNuevo(false);
          setProductoModalInitial(null);
        }}
        onSaved={() => {
          setShowNuevo(false);
          setProductoModalInitial(null);
          actions.getProductos();
        }}
      />
    </div>
  );
};

/* ======================
   Modal Editar Entrada
====================== */
const EditarEntradaModal = ({ show, entrada, productos, proveedores, onClose, onSaved }) => {
  const { actions } = useContext(Context);

  const precioUnitarioInicial = entrada.cantidad > 0 && entrada.precio_sin_iva > 0
    ? +(entrada.precio_sin_iva / entrada.cantidad).toFixed(4) : "";

  const [form, setForm] = useState({
    producto_id:          entrada.producto_id || "",
    proveedor_id:         entrada.proveedor_id || "",
    cantidad:             entrada.cantidad || "",
    numero_documento:     entrada.numero_documento || "",
    precio_unitario:      precioUnitarioInicial,
    descuento_porcentaje: "0",
    iva_porcentaje:       entrada.porcentaje_iva || "21",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const cantidad       = Number(form.cantidad) || 0;
  const precioUnitario = Number(form.precio_unitario) || 0;
  const ivaPct         = Number(form.iva_porcentaje) || 0;
  const descuentoPct   = Number(form.descuento_porcentaje) || 0;
  const subtotal       = precioUnitario * cantidad;
  const descuento      = +(subtotal * (descuentoPct / 100)).toFixed(2);
  const totalSinIva    = +(subtotal - descuento).toFixed(2);
  const totalIva       = +(totalSinIva * (ivaPct / 100)).toFixed(2);
  const totalConIva    = +(totalSinIva + totalIva).toFixed(2);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.producto_id || !form.cantidad || !form.precio_unitario) {
      setErr("Producto, cantidad y precio unitario son obligatorios.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await actions.actualizarEntrada(entrada.id, {
        producto_id:          Number(form.producto_id),
        proveedor_id:         form.proveedor_id ? Number(form.proveedor_id) : null,
        cantidad:             Number(form.cantidad),
        numero_albaran:       form.numero_documento || null,
        precio_unitario:      precioUnitario,
        porcentaje_iva:       ivaPct,
        descuento_porcentaje: descuentoPct,
      });
      onSaved();
    } catch {
      setErr("Error al actualizar la entrada.");
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--sw-overlay-bg-strong,rgba(0,0,0,0.7))", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
      <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderRadius: 16, width: "100%", maxWidth: 700, maxHeight: "90vh", overflowY: "auto", animation: "sw-fade-up 0.25s ease both" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--sw-border)", background: "var(--sw-surface-2)", borderRadius: "16px 16px 0 0" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)", opacity: 0.85 }}>Entrada de stock</p>
            <h5 style={{ margin: 0, fontWeight: 700, color: "var(--sw-text)", fontSize: "1rem" }}>Editar Entrada</h5>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--sw-muted)", fontSize: "1.1rem", cursor: "pointer", padding: "0.25rem", borderRadius: 6, lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {err && <Feedback msg={err} type="danger" onClose={() => setErr("")} />}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              <Field label="Producto" required>
                <GoldSelect value={form.producto_id} onChange={(v) => setForm((f) => ({ ...f, producto_id: v }))}
                  placeholder="— Seleccione —"
                  options={productos.map((p) => ({ value: p.id, label: p.nombre }))} />
              </Field>
              <Field label="Proveedor (opcional)">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <GoldSelect value={form.proveedor_id || ""} onChange={(v) => setForm((f) => ({ ...f, proveedor_id: v }))}
                    placeholder="— Sin proveedor / opcional —"
                    options={proveedores.map((p) => ({ value: p.id, label: p.nombre }))} />
                  <span style={{ fontSize: "0.72rem", color: "var(--sw-muted)" }}>
                    Este campo se puede dejar vacío.
                  </span>
                </div>
              </Field>
              <Field label="Nº Albarán / Factura">
                <input className="form-control sw-pinput" name="numero_documento" value={form.numero_documento} onChange={handleChange} />
              </Field>
              <Field label="Cantidad" required>
                <input type="number" min="1" className="form-control sw-pinput" name="cantidad" value={form.cantidad} onChange={handleChange} required />
              </Field>
              <Field label="Precio unitario (€ sin IVA)" required>
                <input type="number" className="form-control sw-pinput" name="precio_unitario" value={form.precio_unitario} onChange={handleChange} min={0} step="0.01" required />
              </Field>
              <Field label="% Descuento">
                <input type="number" className="form-control sw-pinput" name="descuento_porcentaje" value={form.descuento_porcentaje} onChange={handleChange} min={0} max={100} step="0.01" />
              </Field>
              <Field label="% IVA" required>
                <input type="number" className="form-control sw-pinput" name="iva_porcentaje" value={form.iva_porcentaje} onChange={handleChange} min={0} step="0.01" required />
              </Field>
            </div>

            {cantidad > 0 && precioUnitario > 0 && (
              <TotalesRow subtotal={subtotal} descuento={descuento} totalSinIva={totalSinIva}
                totalIva={totalIva} ivaPct={ivaPct} totalConIva={totalConIva} />
            )}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", padding: "1rem 1.5rem", borderTop: "1px solid var(--sw-border)", background: "var(--sw-surface-2)", borderRadius: "0 0 16px 16px" }}>
            <button type="button" onClick={onClose} style={{ padding: "0.5rem 1.2rem", borderRadius: 8, border: "1px solid var(--sw-border)", background: "transparent", color: "var(--sw-muted)", fontSize: "0.85rem", cursor: "pointer" }}>
              Cancelar
            </button>
            <button type="submit" className="sw-ent-submit-btn" disabled={saving} style={{ padding: "0.5rem 1.5rem" }}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegistrarEntradaPage;
