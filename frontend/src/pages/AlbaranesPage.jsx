import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const fmtEur = (n) =>
  n != null ? `${parseFloat(n).toFixed(2).replace(".", ",")} €` : "—";

export default function AlbaranesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("pendientes");
  const [q, setQ] = useState("");
  const [pendientes, setPendientes] = useState([]);
  const [emitidos, setEmitidos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Modal crear albarán
  const [modalInspeccion, setModalInspeccion] = useState(null);
  const [lineas, setLineas] = useState([]);
  const [loadingLineas, setLoadingLineas] = useState(false);
  const [creando, setCreando] = useState(false);
  const [modalError, setModalError] = useState("");

  const token = () => localStorage.getItem("token");

  const fetchPendientes = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/albaranes/pendientes?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      setPendientes(await res.json());
    } catch { setError("Error al cargar pendientes"); }
    finally { setLoading(false); }
  }, [q]);

  const fetchEmitidos = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/albaranes/emitidos?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      setEmitidos(await res.json());
    } catch { setError("Error al cargar emitidos"); }
    finally { setLoading(false); }
  }, [q]);

  useEffect(() => {
    if (tab === "pendientes") fetchPendientes();
    else fetchEmitidos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, q]);

  const abrirModal = async (inspeccion) => {
    setModalInspeccion(inspeccion);
    setModalError("");
    setLoadingLineas(true);
    try {
      const res = await fetch(`/api/albaranes/precios/${inspeccion.id}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      setLineas(data.map((l) => ({ ...l, precio_base: l.precio_base || 0 })));
    } catch { setLineas([]); }
    finally { setLoadingLineas(false); }
  };

  const cerrarModal = () => { setModalInspeccion(null); setLineas([]); setModalError(""); };

  const crearAlbaran = async () => {
    if (!lineas.length) { setModalError("Añade al menos una línea de servicio"); return; }
    for (const l of lineas) {
      if (!l.nombre.trim()) { setModalError("Todos los servicios deben tener nombre"); return; }
    }
    setCreando(true); setModalError("");
    try {
      const res = await fetch(`/api/albaranes/${modalInspeccion.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ lineas }),
      });
      const data = await res.json();
      if (!res.ok) { setModalError(data.msg || "Error al crear albarán"); return; }
      cerrarModal();
      navigate(`/albaranes/${modalInspeccion.id}`);
    } catch { setModalError("Error de conexión"); }
    finally { setCreando(false); }
  };

  const anularAlbaran = async (id) => {
    if (!window.confirm("¿Seguro que quieres anular este albarán? No se puede deshacer.")) return;
    await fetch(`/api/albaranes/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token()}` },
    });
    fetchEmitidos();
  };

  const totalLineas = lineas.reduce((s, l) => s + parseFloat(l.precio_base || 0), 0);

  const th = { padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: "13px", borderBottom: "2px solid #ddd", background: "#f9f9f9" };
  const td = { padding: "8px 12px", fontSize: "13px", borderBottom: "1px solid #eee" };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", maxWidth: "1100px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <h4 style={{ margin: 0, fontWeight: 700 }}>Albaranes</h4>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por cliente, matrícula o nº albarán..."
          style={{ padding: "6px 12px", border: "1px solid #ccc", borderRadius: 6, fontSize: 13, minWidth: 260 }}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid #eee" }}>
        {[["pendientes", "Pendientes de emitir"], ["emitidos", "Albaranes emitidos"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: "8px 20px", border: "none", background: "none", cursor: "pointer",
            fontWeight: tab === key ? 700 : 400, fontSize: 14,
            borderBottom: tab === key ? "2px solid #f5a623" : "2px solid transparent",
            color: tab === key ? "#f5a623" : "inherit", marginBottom: "-2px",
          }}>{label}</button>
        ))}
      </div>

      {error && <div style={{ background: "#ffeeba", padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {loading && <div style={{ textAlign: "center", padding: 40, color: "#888" }}>Cargando...</div>}

      {/* PENDIENTES */}
      {!loading && tab === "pendientes" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Fecha</th>
              <th style={th}>Cliente</th>
              <th style={th}>Matrícula / Modelo</th>
              <th style={th}>Estado</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {pendientes.length === 0 && (
              <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#999", padding: 30 }}>No hay inspecciones pendientes de albarán</td></tr>
            )}
            {pendientes.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.fecha}</td>
                <td style={{ ...td, fontWeight: 500 }}>{r.cliente_nombre}</td>
                <td style={td}><strong>{r.matricula}</strong><span style={{ color: "#888", marginLeft: 6, fontSize: 12 }}>{r.modelo}</span></td>
                <td style={td}>
                  {r.entregado
                    ? <span style={{ color: "#1a8a1a", fontSize: 12 }}>● Entregado</span>
                    : <span style={{ color: "#888", fontSize: 12 }}>● En taller</span>}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  <button onClick={() => abrirModal(r)} style={{
                    padding: "5px 14px", background: "#f5a623", border: "none", borderRadius: 6,
                    color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer",
                  }}>Crear albarán</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* EMITIDOS */}
      {!loading && tab === "emitidos" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Nº Albarán</th>
              <th style={th}>Fecha</th>
              <th style={th}>Cliente</th>
              <th style={th}>Matrícula</th>
              <th style={{ ...th, textAlign: "right" }}>Base</th>
              <th style={{ ...th, textAlign: "right" }}>IVA 21%</th>
              <th style={{ ...th, textAlign: "right" }}>Total</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {emitidos.length === 0 && (
              <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#999", padding: 30 }}>No hay albaranes emitidos</td></tr>
            )}
            {emitidos.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, fontWeight: 700, color: "#f5a623" }}>{r.albaran_numero}</td>
                <td style={td}>{r.albaran_fecha}</td>
                <td style={td}>{r.cliente_nombre}</td>
                <td style={td}>{r.matricula}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtEur(r.base_imponible)}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtEur(r.iva)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmtEur(r.total)}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => navigate(`/albaranes/${r.id}`)} style={{
                      padding: "4px 12px", background: "#1a65b5", border: "none", borderRadius: 6,
                      color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600,
                    }}>Ver / Imprimir</button>
                    <button onClick={() => anularAlbaran(r.id)} style={{
                      padding: "4px 10px", background: "transparent", border: "1px solid #ef4444",
                      borderRadius: 6, color: "#ef4444", fontSize: 11, cursor: "pointer",
                    }}>Anular</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* MODAL CREAR ALBARÁN */}
      {modalInspeccion && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1060,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }} onClick={(e) => e.target === e.currentTarget && cerrarModal()}>
          <div style={{
            background: "#fff", borderRadius: 12, width: "min(95vw, 640px)",
            maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
          }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h5 style={{ margin: 0, fontWeight: 700 }}>Crear Albarán</h5>
                <small style={{ color: "#888" }}>{modalInspeccion.cliente_nombre} · {modalInspeccion.matricula} · {modalInspeccion.fecha}</small>
              </div>
              <button onClick={cerrarModal} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#888" }}>✕</button>
            </div>

            <div style={{ padding: "16px 20px" }}>
              {loadingLineas ? (
                <div style={{ textAlign: "center", padding: 20, color: "#888" }}>Cargando precios del catálogo...</div>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>
                    Revisa y ajusta los precios antes de generar el albarán. El IVA (21%) se calcula automáticamente.
                  </p>

                  {/* Tabla de líneas */}
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, background: "#f5f5f5" }}>Servicio</th>
                        <th style={{ ...th, background: "#f5f5f5", textAlign: "right", width: 130 }}>Precio (sin IVA)</th>
                        <th style={{ ...th, background: "#f5f5f5", textAlign: "right", width: 100 }}>Total c/IVA</th>
                        <th style={{ ...th, background: "#f5f5f5", width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map((l, idx) => (
                        <tr key={idx}>
                          <td style={td}>
                            <input value={l.nombre} onChange={(e) => {
                              const n = [...lineas]; n[idx] = { ...n[idx], nombre: e.target.value }; setLineas(n);
                            }} style={{ width: "100%", border: "1px solid #ddd", borderRadius: 4, padding: "4px 8px", fontSize: 13 }} />
                            <small style={{ color: "#888", display: "block", marginTop: 2 }}>{l.subtitulo}</small>
                          </td>
                          <td style={{ ...td, textAlign: "right" }}>
                            <input type="number" min="0" step="0.01" value={l.precio_base}
                              onChange={(e) => {
                                const n = [...lineas]; n[idx] = { ...n[idx], precio_base: parseFloat(e.target.value) || 0 }; setLineas(n);
                              }}
                              style={{ width: 110, border: "1px solid #ddd", borderRadius: 4, padding: "4px 8px", fontSize: 13, textAlign: "right" }}
                            /> €
                          </td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>
                            {fmtEur((parseFloat(l.precio_base) || 0) * 1.21)}
                          </td>
                          <td style={td}>
                            <button onClick={() => setLineas(lineas.filter((_, i) => i !== idx))}
                              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <button onClick={() => setLineas([...lineas, { nombre: "", subtitulo: `${modalInspeccion.modelo} - ${modalInspeccion.matricula}`, precio_base: 0 }])}
                    style={{ fontSize: 12, color: "#1a65b5", background: "none", border: "none", cursor: "pointer", marginBottom: 12 }}>
                    + Añadir línea
                  </button>

                  {/* Totales */}
                  <div style={{ background: "#f9f9f9", borderRadius: 8, padding: "12px 16px", fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>Base imponible:</span><strong>{fmtEur(totalLineas)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>IVA 21%:</span><strong>{fmtEur(totalLineas * 0.21)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, borderTop: "1px solid #ddd", paddingTop: 8, marginTop: 4 }}>
                      <span style={{ fontWeight: 700 }}>Total:</span><strong>{fmtEur(totalLineas * 1.21)}</strong>
                    </div>
                  </div>

                  {modalError && <div style={{ color: "#ef4444", fontSize: 13, marginTop: 10 }}>{modalError}</div>}
                </>
              )}
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={cerrarModal} style={{ padding: "8px 18px", border: "1px solid #ccc", background: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              <button onClick={crearAlbaran} disabled={creando || loadingLineas} style={{
                padding: "8px 20px", background: "#f5a623", border: "none", borderRadius: 8,
                color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: creando ? 0.7 : 1,
              }}>{creando ? "Generando..." : "Generar albarán"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
