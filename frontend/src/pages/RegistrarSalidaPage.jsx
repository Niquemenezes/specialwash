import React, { useEffect, useRef, useState, useContext } from "react";
import { Context } from "../store/appContext";
import ProductoFormModal from "../components/ProductoFormModal.jsx";
import GoldSelect from "../components/GoldSelect.jsx";
import { confirmar } from "../utils/confirmar";
import { detectBarcodeFromFile, renderBarcodeToElement } from "../utils/barcode";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { getStoredRol, normalizeRol } from "../utils/authSession";

/* ── Iconos SVG ─────────────────────────────────────────────────── */
const ICONS = {
  salida:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V2M2 12l10 10 10-10"/></svg>),
  scan:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 9h.01M7 12h.01M7 15h.01M11 9h6M11 12h6M11 15h6"/></svg>),
  camera:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>),
  upload:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>),
  plus:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  edit:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
  trash:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>),
  check:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>),
  spinner: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sw-veh-spinner"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>),
};

const fmtDateTime = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "-" : d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
};

const Feedback = ({ msg, type, onClose }) => {
  if (!msg) return null;
  const colors = {
    success: { border: "#22c55e", bg: "rgba(34,197,94,0.08)",  text: "#86efac" },
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

const Field = ({ label, required, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
    <label className="sw-plbl">
      {label}
      {required && <span style={{ color: "var(--sw-accent,#d4af37)", marginLeft: 2 }}>*</span>}
    </label>
    {children}
  </div>
);

const RegistrarSalidaPage = () => {
  const { store, actions } = useContext(Context);

  const rol = normalizeRol(getStoredRol());
  const isAdmin = rol === "administrador";

  const [form, setForm] = useState({
    producto_id: "",
    cantidad: "",
    observaciones: "",
    usuario_id: "",
  });
  const [codigoBarras, setCodigoBarras] = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeMsg, setBarcodeMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type, msg }
  const [errores, setErrores] = useState({});
  const [showProductoModal, setShowProductoModal] = useState(false);
  const [productoModalInitial, setProductoModalInitial] = useState(null);
  const [editando, setEditando] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const cameraScanRef = useRef(null);
  const galleryScanRef = useRef(null);
  const barcodeContainerRef = useRef(null);
  const cantidadInputRef = useRef(null);
  const [scanPrompt, setScanPrompt] = useState({
    open: false,
    producto: null,
    cantidad: "1",
    codigo: "",
    error: "",
  });

  useEffect(() => {
    actions.getProductos();
    if (isAdmin) { actions.getSalidas(); actions.getUsuarios(); }
    if (!store.user) actions.me();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useBarcodeScanner(
    (codigo) => {
      if (codigo) {
        setCodigoBarras(codigo);
        buscarProductoPorCodigo(codigo, { abrirConfirmacion: true });
      }
    },
    { debounceTime: 100, enabled: true }
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === "cantidad" ? Number(value) : value }));
  };

  const setProducto = (id) => setForm((f) => ({ ...f, producto_id: id }));

  const closeScanPrompt = () => {
    setScanPrompt({ open: false, producto: null, cantidad: "1", codigo: "", error: "" });
  };

  const clearSalidaForm = () => {
    setForm((f) => ({ ...f, cantidad: "", observaciones: "", producto_id: "" }));
    setCodigoBarras("");
    setBarcodeMsg("");
    setErrores({});
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const openProductoModal = (producto = null) => {
    setProductoModalInitial(producto || null);
    setShowProductoModal(true);
  };

  const registrarSalidaProducto = async ({
    productoId,
    cantidad,
    observaciones = form.observaciones,
    usuarioId = form.usuario_id,
    desdeEscaner = false,
  }) => {
    const payload = {
      producto_id: Number(productoId),
      cantidad: Number(cantidad),
      observaciones: observaciones || "",
    };
    if (isAdmin && usuarioId) payload.usuario_id = Number(usuarioId);

    const res = await actions.registrarSalida(payload);
    const p = res?.producto;
    const oper = res?.usuario_nombre || store.user?.nombre || "—";

    setFeedback({
      type: "success",
      msg: desdeEscaner
        ? `✅ ${p?.nombre || "Producto"} · ${cantidad} ud. dadas de baja por ${oper}. Stock restante: ${p?.stock_actual ?? "—"}`
        : `✅ Salida registrada — Operario: ${oper} · Producto: ${p?.nombre || "Producto"} · Cantidad: ${cantidad} · Stock restante: ${p?.stock_actual ?? "—"}`,
    });

    if (isAdmin) await actions.getSalidas({}, true);
    await actions.getProductos();
    clearSalidaForm();
    return res;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.producto_id) errs.producto_id = "Selecciona un producto.";
    if (!form.cantidad || Number(form.cantidad) < 1) errs.cantidad = "Indica una cantidad válida.";
    if (isAdmin && !form.usuario_id) errs.usuario_id = "Selecciona el usuario que retira.";
    if (Object.keys(errs).length) { setErrores(errs); return; }
    setErrores({});

    setSaving(true);
    setFeedback(null);
    try {
      await registrarSalidaProducto({
        productoId: form.producto_id,
        cantidad: form.cantidad,
      });
    } catch (err) {
      const msg = err?.message || "Error desconocido";
      if (msg.includes("Stock insuficiente")) {
        setFeedback({ type: "warning", msg: `⚠️ Stock insuficiente. ${msg}` });
      } else {
        setFeedback({ type: "danger", msg: `❌ Error: ${msg}` });
      }
    } finally {
      setSaving(false);
    }
  };

  const buscarProductoPorCodigo = async (forcedCode = "", options = {}) => {
    const { abrirConfirmacion = false } = options;
    const codigo = String(forcedCode || codigoBarras || "").trim();
    if (!codigo) { setBarcodeMsg("Introduce o escanea un código de barras."); return; }

    setBarcodeLoading(true);
    setBarcodeMsg("");
    try {
      const producto = await actions.getProductoPorCodigoBarras(codigo);
      if (!producto?.id) {
        setBarcodeMsg("No hay producto vinculado a ese código. Usa el buscador por nombre o selección manual.");
        return;
      }
      setProducto(String(producto.id));
      setErrores((prev) => ({ ...prev, producto_id: undefined, cantidad: undefined }));
      setCodigoBarras(codigo);
      setBarcodeMsg(`Producto detectado: ${producto.nombre}.`);
      if (barcodeContainerRef.current) renderBarcodeToElement(codigo, barcodeContainerRef.current);

      if (abrirConfirmacion && !isAdmin) {
        setScanPrompt({
          open: true,
          producto,
          cantidad: "1",
          codigo,
          error: "",
        });
      } else {
        setTimeout(() => {
          cantidadInputRef.current?.focus();
          cantidadInputRef.current?.select?.();
        }, 30);
      }
    } catch {
      setBarcodeMsg("No hay producto vinculado a ese código. Usa el buscador por nombre o selección manual.");
    } finally {
      setBarcodeLoading(false);
    }
  };

  const escanearDesdeArchivo = async (file) => {
    if (!file) return;
    setBarcodeLoading(true);
    setBarcodeMsg("");
    try {
      const codigo = await detectBarcodeFromFile(file);
      setCodigoBarras(codigo);
      await buscarProductoPorCodigo(codigo);
    } catch (err) {
      setBarcodeMsg(err?.message || "No se pudo escanear el código.");
    } finally {
      setBarcodeLoading(false);
    }
  };

  const confirmarSalidaEscaneada = async () => {
    const cantidad = Number(scanPrompt.cantidad);
    if (!scanPrompt.producto?.id) {
      closeScanPrompt();
      return;
    }
    if (!cantidad || cantidad < 1) {
      setScanPrompt((prev) => ({ ...prev, error: "Indica cuántas unidades han cogido." }));
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await registrarSalidaProducto({
        productoId: scanPrompt.producto.id,
        cantidad,
        desdeEscaner: true,
      });
      closeScanPrompt();
    } catch (err) {
      const msg = err?.message || "Error desconocido";
      const texto = msg.includes("Stock insuficiente")
        ? `Stock insuficiente. ${msg}`
        : `No se pudo registrar la salida. ${msg}`;
      setScanPrompt((prev) => ({ ...prev, error: texto }));
      setFeedback({ type: msg.includes("Stock insuficiente") ? "warning" : "danger", msg: `❌ ${texto}` });
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (salidaId) => {
    if (!await confirmar("¿Seguro que deseas eliminar esta salida?")) return;
    try {
      await actions.eliminarSalida(salidaId);
      await actions.getSalidas({}, true);
      await actions.getProductos();
    } catch {
      setFeedback({ type: "danger", msg: "Error al eliminar la salida." });
    }
  };

  const productosDisponibles = store.productos || [];

  const productoSeleccionado = (store.productos || []).find(
    (p) => String(p.id) === String(form.producto_id)
  );
  const barcodeDetectado = barcodeMsg.startsWith("Producto detectado");
  const codigoPendienteAsignar = Boolean(codigoBarras && !barcodeDetectado);
  const productoTieneCodigo = Boolean(
    String(productoSeleccionado?.codigo_barras || "").trim() ||
    (productoSeleccionado?.codigos_barras || []).some((item) =>
      String(item?.codigo_barras || "").trim()
    )
  );
  const stockActual = productoSeleccionado?.stock_actual ?? 0;
  const cantidadSolicitada = Number(form.cantidad) || 0;
  const stockRestante = stockActual - cantidadSolicitada;
  const stockInsuficiente = cantidadSolicitada > 0 && cantidadSolicitada > stockActual;

  return (
    <div className="sw-ent-wrapper">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="sw-veh-hero">
        <div className="sw-veh-hero-inner container">
          <div className="sw-veh-hero-body">
            <div className="sw-veh-hero-icon" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}>
              <span style={{ width: 24, height: 24, display: "flex" }}>{ICONS.salida}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Inventario · Salidas</p>
              <h1 className="sw-veh-hero-title">Registrar Salida de Stock</h1>
              <p className="sw-veh-hero-sub">Baja automática de inventario — escanea o selecciona el producto</p>
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

              {/* ── Bloque escáner de código de barras ─────────── */}
              <div className="sw-ent-ocr-block">
                <div className="sw-ent-ocr-header">
                  <span className="sw-ent-ocr-icon">{ICONS.scan}</span>
                  <div>
                    <p className="sw-ent-ocr-title">Código de barras (opcional)</p>
                    <p className="sw-ent-ocr-sub">Escanea con la cámara o selecciona una foto para identificar el producto automáticamente</p>
                  </div>
                </div>

                <input ref={cameraScanRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                  onChange={(e) => escanearDesdeArchivo(e.target.files?.[0])} />
                <input ref={galleryScanRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => escanearDesdeArchivo(e.target.files?.[0])} />

                <div className="sw-ent-ocr-actions">
                  <input
                    className="form-control sw-pinput sw-ent-ocr-input"
                    value={codigoBarras}
                    onChange={(e) => setCodigoBarras(e.target.value)}
                    placeholder="Escanea o escribe el código"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        buscarProductoPorCodigo("", { abrirConfirmacion: !isAdmin });
                      }
                    }}
                  />
                  <button type="button" className="sw-ent-ocr-btn sw-ent-ocr-btn--outline"
                    onClick={() => buscarProductoPorCodigo()} disabled={barcodeLoading}
                    style={{ opacity: barcodeLoading ? 0.5 : 1 }}>
                    {barcodeLoading ? "Buscando…" : "Buscar"}
                  </button>
                  <label className="sw-ent-ocr-btn sw-ent-ocr-btn--primary"
                    style={{ opacity: barcodeLoading ? 0.5 : 1, pointerEvents: barcodeLoading ? "none" : "auto" }}
                    onClick={() => cameraScanRef.current?.click()}>
                    <span style={{ width: 16, height: 16, display: "flex" }}>{barcodeLoading ? ICONS.spinner : ICONS.camera}</span>
                    {barcodeLoading ? "Escaneando…" : "Cámara"}
                  </label>
                  <label className="sw-ent-ocr-btn sw-ent-ocr-btn--outline"
                    style={{ opacity: barcodeLoading ? 0.5 : 1, pointerEvents: barcodeLoading ? "none" : "auto" }}
                    onClick={() => galleryScanRef.current?.click()}>
                    <span style={{ width: 16, height: 16, display: "flex" }}>{ICONS.upload}</span>
                    Foto
                  </label>
                </div>

                {barcodeMsg && (
                  <p style={{
                    margin: "0.4rem 0 0", fontSize: "0.78rem", fontWeight: 600,
                    color: barcodeMsg.startsWith("Producto detectado") ? "var(--sw-success,#22c55e)" : "var(--sw-warning,#f59e0b)",
                  }}>{barcodeMsg}</p>
                )}
                {codigoBarras && barcodeMsg && !barcodeMsg.startsWith("Producto detectado") && (
                  <div style={{
                    marginTop: "0.6rem",
                    padding: "0.7rem 0.85rem",
                    borderRadius: 10,
                    background: "color-mix(in srgb, var(--sw-accent,#d4af37) 6%, var(--sw-surface))",
                    border: "1px solid color-mix(in srgb, var(--sw-accent,#d4af37) 18%, var(--sw-border))",
                    display: "flex",
                    gap: "0.6rem",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    fontSize: "0.76rem",
                    color: "var(--sw-muted)",
                  }}>
                    <span>
                      Puedes seguir con selección manual. Si quieres, guarda este código del fabricante para futuras salidas; no es obligatorio.
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => openProductoModal(productoSeleccionado || null)}
                        style={{
                          background: "var(--sw-surface-2)",
                          border: "1px solid var(--sw-border)",
                          color: "var(--sw-accent,#d4af37)",
                          borderRadius: "8px",
                          padding: "0.35rem 0.7rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {productoSeleccionado ? "Asignar este código al producto seleccionado" : "Crear producto con este código"}
                      </button>
                    )}
                  </div>
                )}
                {codigoBarras && (
                  <div ref={barcodeContainerRef} style={{
                    marginTop: "0.75rem", padding: "0.75rem", borderRadius: 10,
                    background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
                    minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center",
                  }} />
                )}
                {!isAdmin && (
                  <p style={{ margin: "0.6rem 0 0", fontSize: "0.76rem", color: "var(--sw-muted)" }}>
                    Modo pistola: escanea el producto, indica cuántas unidades han cogido y el sistema la dará de baja automáticamente.
                  </p>
                )}
              </div>

              {/* ── Grid de campos ──────────────────────────────── */}
              <div className="sw-ent-grid">
                <div className="sw-ent-grid-span-2">
                  <Field label="Producto" required>
                    <GoldSelect
                      value={String(form.producto_id || "")}
                      onChange={(v) => { setProducto(v); setErrores((p) => ({ ...p, producto_id: undefined })); }}
                      placeholder={productosDisponibles.length ? "— Seleccione un producto —" : "No hay productos disponibles"}
                      searchable
                      options={productosDisponibles.map((p) => ({
                        value: String(p.id),
                        label: p.nombre + (p.categoria ? ` — ${p.categoria}` : ""),
                      }))}
                    />
                    <div style={{ fontSize: "0.72rem", color: "var(--sw-muted)" }}>
                      Si no tiene código de barras, abre el desplegable y escribe para buscarlo por nombre.
                    </div>
                    {errores.producto_id && <div style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "0.25rem" }}>{errores.producto_id}</div>}
                    {productoSeleccionado && (
                      <div style={{
                        marginTop: "0.45rem",
                        display: "flex",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}>
                        <span style={{ fontSize: "0.72rem", color: "var(--sw-muted)" }}>
                          {productoTieneCodigo
                            ? "Puedes revisar o añadir otro código del fabricante cuando lo necesites."
                            : "Este producto aún no tiene código guardado. Puedes añadirlo si te viene bien, pero no es obligatorio."}
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => openProductoModal(productoSeleccionado)}
                            style={{
                              background: "var(--sw-surface-2)",
                              border: "1px solid var(--sw-border)",
                              color: "var(--sw-accent,#d4af37)",
                              borderRadius: "8px",
                              padding: "0.3rem 0.7rem",
                              fontSize: "0.74rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {codigoPendienteAsignar ? "Asignar código escaneado" : "Editar códigos"}
                          </button>
                        )}
                      </div>
                    )}
                  </Field>
                </div>

                <Field label="Cantidad" required>
                  <input
                    ref={cantidadInputRef}
                    type="number" min="1" inputMode="numeric" className="form-control sw-pinput"
                    name="cantidad" value={form.cantidad}
                    onChange={(e) => { handleChange(e); setErrores((p) => ({ ...p, cantidad: undefined })); }}
                    style={errores.cantidad ? { borderColor: "#ef4444" } : {}}
                    required placeholder="0"
                  />
                  {errores.cantidad && <div style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "0.25rem" }}>{errores.cantidad}</div>}
                </Field>
              </div>

              {/* ── Indicador de stock ──────────────────────────── */}
              {productoSeleccionado && (
                <div style={{
                  padding: "0.85rem 1.1rem", borderRadius: 10, fontSize: "0.82rem",
                  background: stockInsuficiente
                    ? "rgba(239,68,68,0.07)"
                    : stockActual < 10
                      ? "rgba(245,158,11,0.07)"
                      : "rgba(34,197,94,0.07)",
                  border: `1px solid ${stockInsuficiente ? "rgba(239,68,68,0.25)" : stockActual < 10 ? "rgba(245,158,11,0.25)" : "rgba(34,197,94,0.25)"}`,
                  display: "flex", gap: "1.5rem", flexWrap: "wrap",
                }}>
                  <div>
                    <span style={{ color: "var(--sw-muted)", fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.08em" }}>Disponible</span>
                    <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--sw-text)" }}>{stockActual} <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>uds.</span></div>
                  </div>
                  {cantidadSolicitada > 0 && (
                    <div>
                      <span style={{ color: "var(--sw-muted)", fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.08em" }}>Quedará</span>
                      <div style={{ fontWeight: 700, fontSize: "1rem", color: stockInsuficiente ? "var(--sw-danger,#ef4444)" : "var(--sw-text)" }}>
                        {stockRestante} <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>uds.</span>
                        {stockInsuficiente && <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "var(--sw-danger,#ef4444)" }}>⚠ Stock insuficiente</span>}
                        {!stockInsuficiente && stockRestante < 5 && (
                          <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "var(--sw-warning,#f59e0b)" }}>⚡ Considera pedir pronto</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Usuario (solo admin) ────────────────────────── */}
              {isAdmin && (
                <Field label="Usuario que retira" required>
                  <GoldSelect
                    value={form.usuario_id}
                    onChange={(v) => { setForm((f) => ({ ...f, usuario_id: v })); setErrores((p) => ({ ...p, usuario_id: undefined })); }}
                    placeholder="Selecciona…"
                    options={(store.usuarios || []).map((u) => ({ value: u.id, label: u.nombre }))}
                  />
                  {errores.usuario_id && <div style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "0.25rem" }}>{errores.usuario_id}</div>}
                </Field>
              )}

              {/* ── Observaciones ───────────────────────────────── */}
              <Field label="Observaciones">
                <input className="form-control sw-pinput" name="observaciones" value={form.observaciones} onChange={handleChange} placeholder="Opcional…" />
              </Field>
            </div>

            {/* ── Footer ──────────────────────────────────────── */}
            <div className="sw-ent-card-footer" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <button
                type="submit"
                className="sw-ent-submit-btn"
                disabled={saving || !form.producto_id || !form.cantidad}
                style={{ width: "100%", justifyContent: "center", padding: "0.8rem 2rem" }}
              >
                {saving ? (
                  <><span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.spinner}</span> Registrando…</>
                ) : (
                  <><span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.check}</span> Registrar salida</>
                )}
              </button>
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.72rem", color: "var(--sw-muted)", textAlign: "center" }}>
                El stock se actualizará automáticamente
              </p>
            </div>
          </form>
        </div>

        {/* ── Tabla últimas salidas (solo admin) ──────────────── */}
        {isAdmin ? (
          <div className="sw-ent-table-card">
            <div className="sw-ent-table-header">
              <p className="sw-home-eyebrow" style={{ marginBottom: 0 }}>Historial</p>
              <h3 className="sw-ent-table-title">Últimas salidas registradas</h3>
            </div>
            <div className="table-responsive">
              <table className="table mb-0 sw-ent-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th className="text-end">Cantidad</th>
                    <th>Usuario</th>
                    <th style={{ width: 72 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(store.salidas || []).map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontSize: "0.8rem", color: "var(--sw-muted)", whiteSpace: "nowrap" }}>{fmtDateTime(s.fecha)}</td>
                      <td style={{ fontWeight: 600, fontSize: "0.85rem" }}>{s.producto_nombre}</td>
                      <td className="text-end" style={{ fontWeight: 700, color: "var(--sw-danger,#ef4444)" }}>{s.cantidad}</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--sw-muted)" }}>{s.usuario_nombre}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="sw-ent-icon-btn" title="Editar"
                            onClick={() => { setEditando(s); setShowEditModal(true); }}>
                            <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.edit}</span>
                          </button>
                          <button className="sw-ent-icon-btn sw-ent-icon-btn--danger" title="Eliminar"
                            onClick={() => handleEliminar(s.id)}>
                            <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.trash}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!(store.salidas || []).length && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center", color: "var(--sw-muted)", padding: "2rem", fontSize: "0.875rem" }}>
                        No hay salidas registradas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{
            padding: "1.25rem 1.5rem", borderRadius: 14,
            background: "color-mix(in srgb, var(--sw-accent,#d4af37) 5%, var(--sw-surface))",
            border: "1px solid color-mix(in srgb, var(--sw-accent,#d4af37) 18%, var(--sw-border))",
            color: "var(--sw-muted)", fontSize: "0.875rem",
          }}>
            Puedes registrar salidas. El historial completo está disponible para administradores.
          </div>
        )}

      </div>{/* /container sw-ent-content */}

      <ScannerSalidaRapidaModal
        show={scanPrompt.open}
        producto={scanPrompt.producto}
        codigo={scanPrompt.codigo}
        cantidad={scanPrompt.cantidad}
        saving={saving}
        error={scanPrompt.error}
        onChangeCantidad={(value) => setScanPrompt((prev) => ({ ...prev, cantidad: value, error: "" }))}
        onClose={closeScanPrompt}
        onConfirm={confirmarSalidaEscaneada}
      />

      <ProductoFormModal
        show={showProductoModal}
        initial={productoModalInitial}
        suggestedBarcode={codigoBarras}
        onClose={() => {
          setShowProductoModal(false);
          setProductoModalInitial(null);
        }}
        onSaved={async () => {
          setShowProductoModal(false);
          setProductoModalInitial(null);
          await actions.getProductos();
          if (codigoBarras) {
            await buscarProductoPorCodigo(codigoBarras);
          }
        }}
      />

      {isAdmin && showEditModal && editando && (
        <EditarSalidaModal
          show={showEditModal}
          salida={editando}
          productos={store.productos || []}
          onClose={() => { setShowEditModal(false); setEditando(null); }}
          onSaved={async () => {
            await actions.getSalidas({}, true);
            await actions.getProductos();
            setShowEditModal(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
};

/* ─── Modal salida rápida por scanner ───────────────────────────────────── */
const ScannerSalidaRapidaModal = ({ show, producto, codigo, cantidad, saving, error, onChangeCantidad, onClose, onConfirm }) => {
  const cantidadRef = useRef(null);

  useEffect(() => {
    if (!show) return undefined;
    const timer = setTimeout(() => {
      cantidadRef.current?.focus();
      cantidadRef.current?.select?.();
    }, 30);
    return () => clearTimeout(timer);
  }, [show]);

  if (!show || !producto) return null;

  const stockActual = Number(producto?.stock_actual ?? 0);
  const cantidadNum = Number(cantidad) || 0;
  const stockRestante = stockActual - cantidadNum;
  const stockInsuficiente = cantidadNum > stockActual;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sw-overlay-bg, rgba(0,0,0,0.55))", padding: "1rem" }}>
      <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderRadius: 16, width: "100%", maxWidth: 460, boxShadow: "var(--sw-shadow)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", borderBottom: "1px solid var(--sw-border)", background: "var(--sw-surface-2)", borderRadius: "16px 16px 0 0" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--sw-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Salida rápida</p>
            <h5 style={{ margin: "0.2rem 0 0", fontWeight: 700, color: "var(--sw-text)", fontSize: "1rem" }}>Producto escaneado</h5>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div style={{ padding: "0.85rem 1rem", borderRadius: 10, background: "color-mix(in srgb, var(--sw-accent,#d4af37) 6%, var(--sw-surface))", border: "1px solid color-mix(in srgb, var(--sw-accent,#d4af37) 18%, var(--sw-border))" }}>
            <div style={{ fontWeight: 700, color: "var(--sw-text)" }}>{producto?.nombre || "Producto"}</div>
            <div style={{ marginTop: "0.2rem", fontSize: "0.78rem", color: "var(--sw-muted)" }}>
              Código: <span style={{ fontFamily: "monospace" }}>{codigo || "—"}</span>
            </div>
          </div>

          <label className="sw-plbl">¿Cuántas unidades han cogido?</label>
          <input
            ref={cantidadRef}
            type="number"
            min="1"
            inputMode="numeric"
            className="form-control sw-pinput"
            value={cantidad}
            onChange={(e) => onChangeCantidad(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onConfirm();
              }
            }}
            placeholder="1"
          />

          {error && (
            <div style={{ padding: "0.7rem 0.85rem", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: "0.8rem" }}>
              {error}
            </div>
          )}

          <div style={{ padding: "0.8rem 0.95rem", borderRadius: 10, background: stockInsuficiente ? "rgba(239,68,68,0.07)" : "rgba(34,197,94,0.07)", border: `1px solid ${stockInsuficiente ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)"}`, display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.82rem" }}>
            <span>Disponible: <strong>{stockActual}</strong> uds.</span>
            <span style={{ color: stockInsuficiente ? "var(--sw-danger,#ef4444)" : "var(--sw-text)" }}>
              Quedará: <strong>{stockRestante}</strong> uds.
            </span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", padding: "1rem 1.25rem", borderTop: "1px solid var(--sw-border)", background: "var(--sw-surface-2)", borderRadius: "0 0 16px 16px" }}>
          <button type="button" onClick={onClose} style={{ padding: "0.5rem 1.1rem", borderRadius: 8, border: "1px solid var(--sw-border)", background: "transparent", color: "var(--sw-text)", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
            Cancelar
          </button>
          <button type="button" className="sw-ent-submit-btn" onClick={onConfirm} disabled={saving || !cantidadNum || stockInsuficiente} style={{ padding: "0.5rem 1.2rem" }}>
            {saving ? "Registrando…" : "Dar de baja"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Modal editar salida ────────────────────────────────────────────────── */
const EditarSalidaModal = ({ show, salida, productos, onClose, onSaved }) => {
  const { actions } = useContext(Context);
  const [form, setForm] = useState({
    producto_id: salida.producto_id || "",
    cantidad: salida.cantidad || "",
    precio_unitario: salida.precio_unitario || "",
    observaciones: salida.observaciones || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const precioTotal =
    Number(form.cantidad) > 0 && Number(form.precio_unitario) > 0
      ? +(Number(form.cantidad) * Number(form.precio_unitario)).toFixed(2)
      : null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await actions.actualizarSalida(salida.id, {
        producto_id: Number(form.producto_id),
        cantidad: Number(form.cantidad),
        precio_unitario: form.precio_unitario ? Number(form.precio_unitario) : null,
        observaciones: form.observaciones || null,
      });
      onSaved();
    } catch {
      setErr("Error al actualizar la salida.");
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sw-overlay-bg, rgba(0,0,0,0.5))", padding: "1rem" }}>
      <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", animation: "sw-fade-up 0.25s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--sw-border)", background: "var(--sw-surface-2)", borderRadius: "16px 16px 0 0" }}>
          <h5 style={{ margin: 0, fontWeight: 700, color: "var(--sw-text)", fontSize: "1rem" }}>Editar Salida</h5>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {err && (
              <div style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: "0.85rem" }}>{err}</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <label className="sw-plbl">Producto</label>
              <GoldSelect
                value={form.producto_id}
                onChange={(v) => setForm((f) => ({ ...f, producto_id: v }))}
                placeholder="-- Seleccione --"
                options={productos.map((p) => ({ value: p.id, label: p.nombre }))}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <label className="sw-plbl">Cantidad <span style={{ color: "var(--sw-accent,#d4af37)" }}>*</span></label>
              <input type="number" className="form-control sw-pinput" name="cantidad" value={form.cantidad} onChange={handleChange} required min="1" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <label className="sw-plbl">Precio Unitario (€)</label>
              <input type="number" step="0.01" className="form-control sw-pinput" name="precio_unitario" value={form.precio_unitario} onChange={handleChange} />
            </div>
            {precioTotal !== null && (
              <div style={{
                padding: "0.75rem 1rem", borderRadius: 10, fontSize: "0.85rem",
                background: "color-mix(in srgb, var(--sw-accent,#d4af37) 5%, var(--sw-surface-2))",
                border: "1px solid color-mix(in srgb, var(--sw-accent,#d4af37) 18%, var(--sw-border))",
              }}>
                <span style={{ color: "var(--sw-muted)", fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.08em" }}>Precio Total</span>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--sw-accent,#d4af37)" }}>{precioTotal} €</div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <label className="sw-plbl">Observaciones</label>
              <textarea className="form-control sw-pinput" name="observaciones" value={form.observaciones} onChange={handleChange} rows="3" />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", padding: "1rem 1.5rem", borderTop: "1px solid var(--sw-border)", background: "var(--sw-surface-2)", borderRadius: "0 0 16px 16px" }}>
            <button type="button" onClick={onClose} style={{ padding: "0.5rem 1.25rem", borderRadius: 8, border: "1px solid var(--sw-border)", background: "transparent", color: "var(--sw-text)", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
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

export default RegistrarSalidaPage;
