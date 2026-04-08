import React, { useEffect, useRef, useState, useContext } from "react";
import { Context } from "../store/appContext";
import ProductoFormModal from "../component/ProductoFormModal.jsx";
import GoldSelect from "../component/GoldSelect.jsx";
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
  const [showNuevo, setShowNuevo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const cameraScanRef = useRef(null);
  const galleryScanRef = useRef(null);
  const barcodeContainerRef = useRef(null);

  useEffect(() => {
    actions.getProductos();
    if (isAdmin) { actions.getSalidas(); actions.getUsuarios(); }
    if (!store.user) actions.me();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useBarcodeScanner(
    (codigo) => { if (codigo) { setCodigoBarras(codigo); buscarProductoPorCodigo(codigo); } },
    { debounceTime: 100, enabled: true }
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === "cantidad" ? Number(value) : value }));
  };

  const setProducto = (id) => setForm((f) => ({ ...f, producto_id: id }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.producto_id) { setFeedback({ type: "warning", msg: "Debes seleccionar un producto." }); return; }
    if (!form.cantidad)    { setFeedback({ type: "warning", msg: "La cantidad es obligatoria." }); return; }
    if (isAdmin && !form.usuario_id) { setFeedback({ type: "warning", msg: "Selecciona el usuario que retira el producto." }); return; }

    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        producto_id: Number(form.producto_id),
        cantidad: Number(form.cantidad),
        observaciones: form.observaciones,
      };
      if (isAdmin) payload.usuario_id = Number(form.usuario_id);

      const res = await actions.registrarSalida(payload);
      const p = res?.producto;
      const oper = res?.usuario_nombre || store.user?.nombre || "—";

      setFeedback({
        type: "success",
        msg: `✅ Salida registrada — Operario: ${oper} · Producto: ${p?.nombre || "Producto"} · Cantidad: ${form.cantidad} · Stock restante: ${p?.stock_actual ?? "—"}`,
      });

      setForm((f) => ({ ...f, cantidad: "", observaciones: "", producto_id: "" }));
      setCodigoBarras("");

      if (isAdmin) await actions.getSalidas({}, true);
      await actions.getProductos();
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

  const buscarProductoPorCodigo = async (forcedCode = "") => {
    const codigo = String(forcedCode || codigoBarras || "").trim();
    if (!codigo) { setBarcodeMsg("Introduce o escanea un código de barras."); return; }

    setBarcodeLoading(true);
    setBarcodeMsg("");
    try {
      const producto = await actions.getProductoPorCodigoBarras(codigo);
      if (!producto?.id) {
        setBarcodeMsg("No hay producto vinculado a ese código. Selecciona el producto manualmente.");
        return;
      }
      setProducto(String(producto.id));
      setCodigoBarras(codigo);
      setBarcodeMsg(`Producto detectado: ${producto.nombre}.`);
      if (barcodeContainerRef.current) renderBarcodeToElement(codigo, barcodeContainerRef.current);
    } catch {
      setBarcodeMsg("No hay producto vinculado a ese código. Selecciona el producto manualmente.");
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

  const handleEliminar = async (salidaId) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta salida?")) return;
    try {
      await actions.eliminarSalida(salidaId);
      await actions.getSalidas({}, true);
      await actions.getProductos();
    } catch {
      setFeedback({ type: "danger", msg: "Error al eliminar la salida." });
    }
  };

  const productoSeleccionado = (store.productos || []).find(
    (p) => String(p.id) === String(form.producto_id)
  );
  const stockActual = productoSeleccionado?.stock_actual ?? 0;
  const cantidadSolicitada = Number(form.cantidad) || 0;
  const stockRestante = stockActual - cantidadSolicitada;
  const stockInsuficiente = cantidadSolicitada > 0 && cantidadSolicitada > stockActual;

  const Field = ({ label, required, children }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <label className="sw-plbl">{label}{required && <span style={{ color: "var(--sw-accent,#d4af37)", marginLeft: 2 }}>*</span>}</label>
      {children}
    </div>
  );

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
            {isAdmin && (
              <button
                className="sw-ent-submit-btn"
                style={{ background: "linear-gradient(135deg, var(--sw-accent,#d4af37), color-mix(in srgb, var(--sw-accent,#d4af37) 75%, #fff))" }}
                onClick={() => setShowNuevo(true)}
              >
                <span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.plus}</span>
                Nuevo producto
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="container sw-ent-content">
        <Feedback msg={feedback?.msg} type={feedback?.type} onClose={() => setFeedback(null)} />

        {/* ── Tarjeta formulario ───────────────────────────────── */}
        <div className="sw-ent-card">
          <div className="sw-ent-card-header">
            <div className="sw-ent-card-header-icon" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.22)", color: "#ef4444" }}>
              <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.salida}</span>
            </div>
            <div>
              <p className="sw-ent-card-eyebrow">Nueva salida</p>
              <h2 className="sw-ent-card-title">Registrar salida de producto</h2>
            </div>
          </div>

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

                <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    className="form-control sw-pinput"
                    style={{ maxWidth: "320px" }}
                    value={codigoBarras}
                    onChange={(e) => setCodigoBarras(e.target.value)}
                    placeholder="Escanea o escribe el código"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarProductoPorCodigo(); } }}
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
                {codigoBarras && (
                  <div ref={barcodeContainerRef} style={{
                    marginTop: "0.75rem", padding: "0.75rem", borderRadius: 10,
                    background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
                    minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center",
                  }} />
                )}
              </div>

              {/* ── Grid de campos ──────────────────────────────── */}
              <div className="sw-ent-grid">
                <div style={{ gridColumn: "span 2" }}>
                  <Field label="Producto" required>
                    <GoldSelect
                      value={String(form.producto_id || "")}
                      onChange={setProducto}
                      placeholder="— Seleccione un producto —"
                      options={(store.productos || []).map((p) => ({
                        value: String(p.id),
                        label: p.nombre + (p.categoria ? ` — ${p.categoria}` : ""),
                      }))}
                    />
                    {!form.producto_id && (
                      <span style={{ fontSize: "0.72rem", color: "var(--sw-danger,#ef4444)" }}>
                        Selecciona un producto antes de registrar
                      </span>
                    )}
                  </Field>
                </div>

                <Field label="Cantidad" required>
                  <input
                    type="number" min="1" className="form-control sw-pinput"
                    name="cantidad" value={form.cantidad} onChange={handleChange}
                    required placeholder="0"
                  />
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
                    onChange={(v) => setForm((f) => ({ ...f, usuario_id: v }))}
                    placeholder="Selecciona…"
                    options={(store.usuarios || []).map((u) => ({ value: u.id, label: u.nombre }))}
                  />
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

      {showNuevo && (
        <ProductoFormModal show onClose={() => setShowNuevo(false)}
          onSaved={async () => { setShowNuevo(false); await actions.getProductos(); }} />
      )}

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
