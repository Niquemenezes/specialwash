import React, { useContext, useEffect, useMemo, useRef, useState } from "react";

import { Context } from "../store/appContext";
import { confirmar } from "../utils/confirmar";
import { toast } from "../utils/toast";
import EmptyState from "../components/EmptyState.jsx";



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

    if (!await confirmar(`¿Eliminar máquina "${m.nombre}"?`)) return;

    try {

      await actions.deleteMaquina(m.id);
      toast.success("Máquina eliminada");
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

    if (!await confirmar("¿Eliminar esta factura de la maquinaria?")) return;



    try {

      const data = await actions.eliminarFacturaMaquinaria(editing.id, facturaIndex);

      if (data?.maquinaria) setEditing(data.maquinaria);

    } catch (err) {

      setFormError(err.message || "No se pudo eliminar la factura.");

    }

  };



  // ---------------- UI ----------------


  // ---------------- UI ----------------
  return (
    <div className="sw-ent-wrapper">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="sw-veh-hero">
        <div className="sw-veh-hero-inner container">
          <div className="sw-veh-hero-body">
            <div className="sw-veh-hero-icon">
              <span style={{ width: 24, height: 24, display: "flex" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Gestión · Activos</p>
              <h1 className="sw-veh-hero-title">Maquinaria</h1>
              <p className="sw-veh-hero-sub">Control de activos, garantías y facturas de compra</p>
            </div>
            <button
              className="sw-ent-submit-btn"
              onClick={startCreate}
              style={{ background: "linear-gradient(135deg, var(--sw-accent,#d4af37), color-mix(in srgb, var(--sw-accent,#d4af37) 75%, #fff))" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nueva máquina
            </button>
          </div>
        </div>
      </div>

      <div className="container sw-ent-content" style={{ maxWidth: 1200 }}>

        {/* ── Tarjetas resumen ────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
          <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderRadius: 14, padding: "1rem 1.25rem", animation: "sw-fade-up 0.4s ease both" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>Total</span>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--sw-accent,#d4af37)", marginTop: 2 }}>{items.length}</div>
          </div>
          <div style={{ background: "var(--sw-surface)", border: "1px solid color-mix(in srgb, #f59e0b 30%, var(--sw-border))", borderRadius: 14, padding: "1rem 1.25rem", animation: "sw-fade-up 0.4s ease 0.05s both" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>Garantía por vencer</span>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f59e0b", marginTop: 2 }}>{proximasGarantia.length}</div>
          </div>
        </div>

        {/* ── Alerta garantías próximas ───────────────────────── */}
        {proximasGarantia.length > 0 && (
          <div style={{
            padding: "1rem 1.25rem", borderRadius: 12, fontSize: "0.875rem",
            background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.3)",
            color: "var(--sw-text)", animation: "sw-fade-up 0.4s ease both",
          }}>
            <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#f59e0b" }}>
              ⚠ {proximasGarantia.length} máquina(s) con garantía próxima a vencer
            </div>
            <details>
              <summary style={{ cursor: "pointer", color: "var(--sw-muted)", fontSize: "0.8rem" }}>Ver detalle</summary>
              <ul style={{ marginTop: "0.5rem", paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {proximasGarantia.slice(0, 8).map((m) => {
                  const info = getWarrantyInfo(m);
                  return (
                    <li key={m.id} style={{ color: "var(--sw-muted)", fontSize: "0.82rem" }}>
                      <strong style={{ color: "var(--sw-text)" }}>{m.nombre}</strong> — vence {fmtDate(info.endDate)} ({info.daysRemaining} días)
                    </li>
                  );
                })}
                {proximasGarantia.length > 8 && <li style={{ color: "var(--sw-muted)", fontSize: "0.82rem" }}>… y {proximasGarantia.length - 8} más</li>}
              </ul>
            </details>
          </div>
        )}

        {/* ── Buscador ────────────────────────────────────────── */}
        <div>
          <input
            className="form-control sw-pinput"
            style={{ maxWidth: 420 }}
            placeholder="Buscar maquinaria…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {/* ── Formulario ──────────────────────────────────────── */}
        {editing !== null && (
          <div className="sw-ent-card">
            <div className="sw-ent-card-header">
              <div className="sw-ent-card-header-icon" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.22)", color: "var(--sw-accent,#d4af37)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
              </div>
              <div>
                <p className="sw-ent-card-eyebrow">{editing?.id ? "Editar registro" : "Nuevo registro"}</p>
                <h2 className="sw-ent-card-title">{editing?.id ? "Editar máquina" : "Nueva máquina"}</h2>
              </div>
            </div>

            <form onSubmit={save}>
              <div className="sw-ent-card-body">

                {/* Nota informativa */}
                <div style={{ padding: "0.75rem 1rem", borderRadius: 10, background: "color-mix(in srgb, var(--sw-accent,#d4af37) 5%, var(--sw-surface-2))", border: "1px solid color-mix(in srgb, var(--sw-accent,#d4af37) 18%, var(--sw-border))", fontSize: "0.82rem", color: "var(--sw-muted)" }}>
                  <strong style={{ color: "var(--sw-text)" }}>Nota:</strong> El bloque OCR solo sugiere datos. La factura se guarda desde "Factura de compra" al pulsar "Guardar".
                </div>

                {/* ── OCR Block ────────────────────────────── */}
                <div className="sw-ent-ocr-block">
                  <div className="sw-ent-ocr-header">
                    <span className="sw-ent-ocr-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 9h.01M7 12h.01M7 15h.01M11 9h6M11 12h6M11 15h6"/></svg>
                    </span>
                    <div>
                      <p className="sw-ent-ocr-title">Escaneo OCR (opcional)</p>
                      <p className="sw-ent-ocr-sub">Sugiere nombre, marca, modelo, serie, fecha, precio e IVA desde la foto de un albarán</p>
                    </div>
                  </div>
                  <div className="sw-ent-ocr-actions">
                    <input
                      type="file"
                      className="form-control sw-pinput"
                      style={{ maxWidth: 320 }}
                      accept="image/*"
                      onChange={(e) => { setOcrFile(e.target.files?.[0] || null); setOcrMsg(""); }}
                    />
                    <button
                      type="button"
                      className="sw-ent-ocr-btn sw-ent-ocr-btn--primary"
                      disabled={ocrLoading}
                      onClick={aplicarSugerenciaOCR}
                      style={{ opacity: ocrLoading ? 0.6 : 1 }}
                    >
                      {ocrLoading ? "Leyendo…" : "Escanear OCR"}
                    </button>
                  </div>
                  {ocrMsg && <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "var(--sw-muted)" }}>{ocrMsg}</p>}
                </div>

                {/* ── Factura de compra ─────────────────────── */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <label className="sw-plbl">Factura de compra (se guarda en el sistema)</label>
                  <input ref={facturaCamaraRef} type="file" accept="image/*,application/pdf" capture="environment" className="d-none"
                    onChange={(e) => setFacturaFile(e.target.files?.[0] || null)} />
                  <input ref={facturaArchivoRef} type="file" accept="image/*,application/pdf" className="d-none"
                    onChange={(e) => setFacturaFile(e.target.files?.[0] || null)} />
                  <div className="sw-ent-ocr-actions">
                    <button type="button" className="sw-ent-ocr-btn sw-ent-ocr-btn--outline" onClick={() => facturaCamaraRef.current?.click()}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      Sacar foto
                    </button>
                    <button type="button" className="sw-ent-ocr-btn sw-ent-ocr-btn--outline" onClick={() => facturaArchivoRef.current?.click()}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      Subir archivo
                    </button>
                    {facturaFile && (
                      <button type="button" className="sw-ent-ocr-btn sw-ent-ocr-btn--outline" onClick={() => setFacturaFile(null)}
                        style={{ color: "var(--sw-danger,#ef4444)", borderColor: "var(--sw-danger,#ef4444)" }}>
                        Quitar
                      </button>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--sw-muted)" }}>Formatos: PDF o imágenes.</p>
                  {facturaFile && <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--sw-success,#22c55e)", fontWeight: 600 }}>Archivo: {facturaFile.name}</p>}
                </div>

                {/* ── Facturas guardadas ───────────────────────── */}
                {editing?.id && facturasDe(editing).length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <label className="sw-plbl">Facturas guardadas</label>
                    {facturasDe(editing).map((factura, index) => {
                      const url = facturaUrl(factura);
                      return (
                        <div key={`${editing.id}-factura-${index}`} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "0.6rem 0.9rem", borderRadius: 8,
                          background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", gap: "0.5rem",
                        }}>
                          <span style={{ fontSize: "0.82rem", color: "var(--sw-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{facturaNombre(factura, index)}</span>
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            {url && <a href={url} target="_blank" rel="noreferrer" className="sw-ent-icon-btn" title="Ver" style={{ textDecoration: "none", padding: 0, width: 30, height: 30 }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            </a>}
                            <button type="button" className="sw-ent-icon-btn sw-ent-icon-btn--danger" onClick={() => eliminarFactura(index)} title="Eliminar">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Grid de campos ───────────────────────────── */}
                <div className="sw-ent-grid">
                  {[
                    { key: "nombre", label: "Nombre", required: true },
                    { key: "marca", label: "Marca" },
                    { key: "modelo", label: "Modelo" },
                    { key: "numero_serie", label: "Nº Serie" },
                    { key: "ubicacion", label: "Ubicación" },
                    { key: "estado", label: "Estado" },
                  ].map(({ key, label, required }) => (
                    <div key={key} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      <label className="sw-plbl">{label}{required && <span style={{ color: "var(--sw-accent,#d4af37)", marginLeft: 2 }}>*</span>}</label>
                      <input className="form-control sw-pinput" name={key} value={form[key]} onChange={onChange} required={required} />
                    </div>
                  ))}

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label className="sw-plbl">Descuento (%)</label>
                    <input type="number" step="0.01" min="0" className="form-control sw-pinput" name="descuento" value={form.descuento} onChange={onChange} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label className="sw-plbl">Fecha compra</label>
                    <input type="date" className="form-control sw-pinput" name="fecha_compra" value={form.fecha_compra} onChange={onChange} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label className="sw-plbl">Precio sin IVA (€)</label>
                    <input type="number" step="0.01" min="0" className="form-control sw-pinput" name="precio_sin_iva" value={form.precio_sin_iva} onChange={onChange} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label className="sw-plbl">IVA (%)</label>
                    <input type="number" step="0.01" min="0" className="form-control sw-pinput" name="iva" value={form.iva} onChange={onChange} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label className="sw-plbl">Precio con IVA (€)</label>
                    <input type="number" step="0.01" min="0" className="form-control sw-pinput" name="precio_con_iva" value={form.precio_con_iva} readOnly
                      style={{ opacity: 0.65, cursor: "not-allowed" }} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label className="sw-plbl">Cantidad</label>
                    <input type="number" step="1" min="1" className="form-control sw-pinput" name="cantidad" value={form.cantidad} onChange={onChange} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", gridColumn: "span 2" }}>
                    <label className="sw-plbl">Notas</label>
                    <textarea className="form-control sw-pinput" rows="3" name="notas" value={form.notas} onChange={onChange} />
                  </div>
                </div>

                {/* Error */}
                {formError && (
                  <div style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--sw-danger,#ef4444)", fontSize: "0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{formError}</span>
                    <button onClick={() => setFormError("")} style={{ background: "none", border: "none", color: "inherit", opacity: 0.6, cursor: "pointer", padding: 0, fontSize: "1rem" }}>✕</button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="sw-ent-card-footer" style={{ gap: "0.75rem" }}>
                <button type="button" onClick={cancel} style={{ padding: "0.5rem 1.25rem", borderRadius: 8, border: "1px solid var(--sw-border)", background: "transparent", color: "var(--sw-text)", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
                  Cancelar
                </button>
                <button type="submit" className="sw-ent-submit-btn" disabled={facturaUploading} style={{ padding: "0.55rem 1.75rem" }}>
                  {facturaUploading
                    ? <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sw-veh-spinner" style={{ width: 15, height: 15 }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Subiendo factura…</>
                    : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}><polyline points="20 6 9 17 4 12"/></svg> Guardar</>
                  }
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Tabla ───────────────────────────────────────────── */}
        <div className="sw-ent-table-card">
          <div className="sw-ent-table-header">
            <p className="sw-home-eyebrow" style={{ marginBottom: 0 }}>Inventario</p>
            <h3 className="sw-ent-table-title">Máquinas registradas</h3>
          </div>
          <div className="table-responsive">
            <table className="table mb-0 sw-ent-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Ubicación</th>
                  <th>Estado</th>
                  <th className="text-end">Sin IVA</th>
                  <th className="text-end">IVA %</th>
                  <th className="text-end">Con IVA</th>
                  <th className="text-center">Cant.</th>
                  <th className="text-center">Facturas</th>
                  <th>Garantía</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan="12" style={{ textAlign: "center", padding: "2rem", color: "var(--sw-muted)", fontSize: "0.875rem" }}>Cargando…</td></tr>
                )}
                {!loading && items.length === 0 && (
                  <EmptyState
                    colSpan={12}
                    title="Sin maquinaria registrada"
                    subtitle="Añade la primera máquina con el botón Nueva máquina."
                  />
                )}
                {!loading && items.map((m) => {
                  const info = getWarrantyInfo(m);
                  const warrantyColor = info.status === "expired" ? "var(--sw-danger,#ef4444)" : info.status === "warning" ? "#f59e0b" : info.status === "ok" ? "var(--sw-success,#22c55e)" : "var(--sw-muted)";
                  const warrantyBg = info.status === "expired" ? "rgba(239,68,68,0.09)" : info.status === "warning" ? "rgba(245,158,11,0.09)" : info.status === "ok" ? "rgba(34,197,94,0.09)" : "transparent";
                  const warrantyText = info.status === "expired" ? `Expirada ${fmtDate(info.endDate)}` : info.status === "warning" ? `Vence en ${info.daysRemaining}d` : info.status === "ok" ? `Vigente hasta ${fmtDate(info.endDate)}` : "No registrada";

                  return (
                    <tr key={m.id} style={info.status === "expired" ? { background: "rgba(239,68,68,0.04)" } : info.status === "warning" ? { background: "rgba(245,158,11,0.04)" } : {}}>
                      <td style={{ fontWeight: 600, fontSize: "0.85rem" }}>{m.nombre}</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--sw-muted)" }}>{m.marca || "-"}</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--sw-muted)" }}>{m.modelo || "-"}</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--sw-muted)" }}>{m.ubicacion || "-"}</td>
                      <td style={{ fontSize: "0.82rem" }}>{m.estado || "-"}</td>
                      <td className="text-end" style={{ fontSize: "0.82rem" }}>{(m.precio_sin_iva ?? 0).toFixed(2)} €</td>
                      <td className="text-end" style={{ fontSize: "0.82rem", color: "var(--sw-muted)" }}>{(m.iva ?? 0).toFixed(2)}%</td>
                      <td className="text-end" style={{ fontWeight: 600, color: "var(--sw-accent,#d4af37)" }}>{(m.precio_con_iva ?? 0).toFixed(2)} €</td>
                      <td className="text-center" style={{ fontWeight: 600 }}>{m.cantidad ?? 1}</td>
                      <td className="text-center">
                        {facturasDe(m).length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                            <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: 999, background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8" }}>{facturasDe(m).length}</span>
                            {facturaUrl(facturasDe(m)[0]) && (
                              <a href={facturaUrl(facturasDe(m)[0])} target="_blank" rel="noreferrer" className="sw-ent-icon-btn" title="Ver" style={{ textDecoration: "none", width: 30, height: 30, padding: 0 }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                              </a>
                            )}
                          </div>
                        ) : <span style={{ color: "var(--sw-muted)", fontSize: "0.8rem" }}>—</span>}
                      </td>
                      <td>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: 999, background: warrantyBg, border: `1px solid ${warrantyColor}40`, color: warrantyColor }}>
                          {warrantyText}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <button className="sw-ent-icon-btn" onClick={() => startEdit(m)} title="Editar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className="sw-ent-icon-btn sw-ent-icon-btn--danger" disabled={facturaUploading} onClick={() => remove(m)} title="Eliminar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
