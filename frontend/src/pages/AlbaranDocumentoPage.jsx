import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const fmtEur = (n) =>
  `${parseFloat(n || 0).toFixed(2).replace(".", ",")} €`;

export default function AlbaranDocumentoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`/api/albaranes/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d.msg) throw new Error(d.msg); setData(d); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ textAlign: "center", padding: 60, fontFamily: "Arial" }}>Cargando...</div>;
  if (error) return <div style={{ textAlign: "center", padding: 60, color: "#ef4444", fontFamily: "Arial" }}>{error}</div>;
  if (!data) return null;

  const { albaran_numero, albaran_fecha, cliente, empresa, vehiculo, lineas } = data;
  const baseTotal = lineas.reduce((s, l) => s + parseFloat(l.precio_base || 0), 0);
  const ivaTotal = baseTotal * 0.21;
  const total = baseTotal + ivaTotal;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .albaran-doc { box-shadow: none !important; margin: 0 !important; border: none !important; }
        }
        body { background: #f0f0f0; font-family: Arial, sans-serif; }
      `}</style>

      {/* Barra de acciones - no se imprime */}
      <div className="no-print" style={{
        background: "#fff", padding: "12px 24px", display: "flex", gap: 10, alignItems: "center",
        borderBottom: "1px solid #ddd", position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={() => navigate(-1)} style={{
          padding: "6px 14px", border: "1px solid #ccc", background: "#fff",
          borderRadius: 6, cursor: "pointer", fontSize: 13,
        }}>← Volver</button>
        <button onClick={() => window.print()} style={{
          padding: "6px 18px", background: "#1a65b5", border: "none",
          borderRadius: 6, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13,
        }}>🖨 Imprimir / Descargar PDF</button>
        <span style={{ color: "#888", fontSize: 13 }}>{albaran_numero}</span>
      </div>

      {/* Documento */}
      <div style={{ display: "flex", justifyContent: "center", padding: "30px 16px" }}>
        <div className="albaran-doc" style={{
          background: "#fff", width: "210mm", minHeight: "297mm",
          padding: "20mm 18mm", boxShadow: "0 2px 20px rgba(0,0,0,0.15)",
          fontSize: "11pt", color: "#222", boxSizing: "border-box",
        }}>

          {/* CABECERA */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: "16pt", fontWeight: 700 }}>Albarán {albaran_numero}</h2>
              <div style={{ color: "#555" }}>Fecha {albaran_fecha}</div>
            </div>
            {empresa.logo_url ? (
              <img src={empresa.logo_url} alt="Logo" style={{ height: 60, objectFit: "contain" }} />
            ) : (
              <div style={{
                width: 120, height: 60, border: "2px solid #ddd", borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "9pt", color: "#bbb", textAlign: "center", lineHeight: 1.3,
              }}>Special Wash<br />Studio</div>
            )}
          </div>

          {/* DATOS CLIENTE / EMPRESA */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
            {/* Cliente */}
            <div style={{ borderLeft: "3px solid #1a65b5", paddingLeft: 12 }}>
              <div style={{ fontWeight: 700, fontSize: "11pt", marginBottom: 6 }}>{cliente.nombre}</div>
              {cliente.cif && <div style={{ color: "#555" }}>{cliente.cif}</div>}
              {cliente.direccion && <div style={{ color: "#555" }}>{cliente.direccion}</div>}
              {cliente.email && <div style={{ color: "#555" }}>{cliente.email}</div>}
              {cliente.telefono && <div style={{ color: "#555" }}>{cliente.telefono}</div>}
            </div>
            {/* Empresa */}
            <div style={{ borderLeft: "3px solid #f5a623", paddingLeft: 12 }}>
              <div style={{ fontWeight: 700, fontSize: "11pt", marginBottom: 6 }}>{empresa.nombre}</div>
              <div style={{ color: "#555" }}>{empresa.cif}</div>
              <div style={{ color: "#555" }}>{empresa.nombre_comercial}</div>
              <div style={{ color: "#555" }}>{empresa.direccion}</div>
              <div style={{ color: "#555" }}>{empresa.email}</div>
              <div style={{ color: "#555" }}>{empresa.telefono}</div>
            </div>
          </div>

          {/* TABLA DE SERVICIOS */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
            <thead>
              <tr style={{ background: "#1a65b5", color: "#fff" }}>
                <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: "10pt" }}>Concepto</th>
                <th style={{ padding: "8px 10px", textAlign: "center", width: 50, fontWeight: 600, fontSize: "10pt" }}>Cant.</th>
                <th style={{ padding: "8px 10px", textAlign: "right", width: 100, fontWeight: 600, fontSize: "10pt" }}>Precio</th>
                <th style={{ padding: "8px 10px", textAlign: "center", width: 70, fontWeight: 600, fontSize: "10pt" }}>Imp.</th>
                <th style={{ padding: "8px 10px", textAlign: "right", width: 100, fontWeight: 600, fontSize: "10pt" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #eee", background: i % 2 === 0 ? "#fafafa" : "#fff" }}>
                  <td style={{ padding: "10px 10px 4px" }}>
                    <div style={{ fontWeight: 500 }}>{l.nombre}</div>
                    {l.subtitulo && <div style={{ fontSize: "9pt", color: "#1a65b5", marginTop: 2 }}>{l.subtitulo}</div>}
                  </td>
                  <td style={{ padding: "10px", textAlign: "center" }}>1</td>
                  <td style={{ padding: "10px", textAlign: "right" }}>{fmtEur(l.precio_base)}</td>
                  <td style={{ padding: "10px", textAlign: "center", fontSize: "9pt", color: "#555" }}>IVA 21%</td>
                  <td style={{ padding: "10px", textAlign: "right", fontWeight: 500 }}>{fmtEur(l.precio_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* TOTALES */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 260 }}>
              <tbody>
                <tr>
                  <td style={{ padding: "5px 12px", color: "#555", fontSize: "10pt" }}>Base imponible</td>
                  <td style={{ padding: "5px 12px", textAlign: "right", fontSize: "10pt" }}>{fmtEur(baseTotal)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "5px 12px", color: "#555", fontSize: "10pt" }}>IVA 21%</td>
                  <td style={{ padding: "5px 12px", textAlign: "right", fontSize: "10pt" }}>{fmtEur(ivaTotal)}</td>
                </tr>
                <tr style={{ borderTop: "2px solid #222" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 700, fontSize: "12pt" }}>Total</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, fontSize: "12pt" }}>{fmtEur(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Total grande al pie (como en Taclia) */}
          <div style={{
            marginTop: 24, borderTop: "1px solid #eee", paddingTop: 16,
            display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: "13pt", color: "#555" }}>Total</span>
            <span style={{ fontSize: "18pt", fontWeight: 700 }}>{fmtEur(total)}</span>
          </div>

        </div>
      </div>
    </>
  );
}
