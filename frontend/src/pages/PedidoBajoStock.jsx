// src/front/js/pages/PedidoBajoStock.jsx
import React, { useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";
import { useNavigate } from "react-router-dom";
import logo from "../img/logospecialwash.jpg";

export default function PedidoBajoStock() {
  const { store, actions } = useContext(Context);
  const navigate = useNavigate();
  const fechaImpresion = useMemo(() => new Date(), []);
  const [proveedorFiltroId, setProveedorFiltroId] = useState("");
  const [canalPedido, setCanalPedido] = useState("whatsapp");
  const [nombrePedido, setNombrePedido] = useState(() => {
    const hoy = new Date().toLocaleDateString("es-ES");
    return `Pedido ${hoy}`;
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [cantidadesPedido, setCantidadesPedido] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    actions.getProductos();
    actions.getProveedores?.();
    // Ejecutar una sola vez al montar para evitar re-fetch en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proveedores = useMemo(() => store.proveedores || [], [store.proveedores]);

  // --- Productos con stock inferior al mínimo y sin pedido en curso ---
  const bajosDeStockBase = useMemo(
    () =>
      (store.productos || []).filter((p) => {
        const bajo =
          p?.stock_minimo != null && Number(p.stock_actual ?? 0) < Number(p.stock_minimo ?? 0);
        return bajo && !p?.pedido_en_curso;
      }),
    [store.productos]
  );

  const bajosDeStock = useMemo(() => {
    if (!proveedorFiltroId) return bajosDeStockBase;
    return bajosDeStockBase.filter(
      (p) => String(p.proveedor_habitual_id || "") === String(proveedorFiltroId)
    );
  }, [bajosDeStockBase, proveedorFiltroId]);

  const pedidosEnCurso = useMemo(() => {
    const list = (store.productos || []).filter((p) => {
      const bajo =
        p?.stock_minimo != null && Number(p.stock_actual ?? 0) < Number(p.stock_minimo ?? 0);
      if (!bajo || !p?.pedido_en_curso) return false;
      if (proveedorFiltroId && String(p.pedido_proveedor_id || p.proveedor_habitual_id || "") !== String(proveedorFiltroId)) {
        return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      const da = a?.pedido_fecha ? new Date(a.pedido_fecha).getTime() : 0;
      const db = b?.pedido_fecha ? new Date(b.pedido_fecha).getTime() : 0;
      return db - da;
    });
  }, [store.productos, proveedorFiltroId]);

  useEffect(() => {
    // Por defecto, seleccionamos todo lo visible para agilizar el pedido.
    setSelectedIds(bajosDeStock.map((p) => p.id));
  }, [bajosDeStock]);

  useEffect(() => {
    // Inicializa/actualiza cantidades por producto con sugerencia basada en mínimo.
    setCantidadesPedido((prev) => {
      const next = {};
      bajosDeStock.forEach((p) => {
        const sugerido = Math.max(1, Number(p.stock_minimo ?? 1));
        const actual = Number(prev[p.id]);
        next[p.id] = Number.isFinite(actual) && actual >= 0 ? Math.trunc(actual) : sugerido;
      });
      return next;
    });
  }, [bajosDeStock]);

  const onCantidadChange = (productoId, value, fallback) => {
    const parsed = Number(value);
    const nextVal = Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
    setCantidadesPedido((prev) => ({ ...prev, [productoId]: nextVal }));
  };

  const toggleSelected = (id, checked) => {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(id);
      else set.delete(id);
      return Array.from(set);
    });
  };

  const productosSeleccionados = useMemo(
    () => bajosDeStock.filter((p) => selectedIds.includes(p.id)),
    [bajosDeStock, selectedIds]
  );

  const proveedorSeleccionado = useMemo(
    () => proveedores.find((p) => String(p.id) === String(proveedorFiltroId)) || null,
    [proveedores, proveedorFiltroId]
  );

  const fecha = fechaImpresion.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const hora = fechaImpresion.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const textoPedido = useMemo(() => {
    const lineas = productosSeleccionados.map((p) => {
      const stock = Number(p.stock_actual ?? 0);
      const min = Number(p.stock_minimo ?? 0);
      const sugerido = Math.max(1, min || 1);
      const cantidad = Number(cantidadesPedido[p.id] ?? sugerido);
      return `- ${p.nombre} | stock ${stock} | min ${min} | pedir ${cantidad}`;
    });
    const destino = proveedorSeleccionado?.nombre ? `Proveedor: ${proveedorSeleccionado.nombre}` : "Proveedor: por definir";
    return [
      `${nombrePedido} (${fecha} ${hora})`,
      destino,
      "",
      ...lineas,
    ].join("\n");
  }, [productosSeleccionados, proveedorSeleccionado, fecha, hora, nombrePedido, cantidadesPedido]);

  const marcarSeleccionadosComoPedido = async () => {
    if (!productosSeleccionados.length) return;
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      await Promise.all(
        productosSeleccionados.map((p) => {
          const min = Number(p.stock_minimo ?? 0);
          const sugerido = Math.max(1, min || 1);
          const cantidad = Number(cantidadesPedido[p.id] ?? sugerido);
          return actions.updateProducto(p.id, {
            pedido_en_curso: true,
            pedido_fecha: nowIso,
            pedido_cantidad: cantidad,
            pedido_canal: canalPedido,
            pedido_proveedor_id: proveedorSeleccionado?.id || null,
          });
        })
      );
      await actions.getProductos();
      alert("Productos marcados como pedido en curso.");
    } catch (err) {
      alert(`No se pudo marcar el pedido: ${err?.message || "error"}`);
    } finally {
      setSaving(false);
    }
  };

  const marcarComoRecibido = async (producto) => {
    if (!window.confirm(`Marcar "${producto.nombre}" como recibido?`)) return;
    setSaving(true);
    try {
      await actions.updateProducto(producto.id, {
        pedido_en_curso: false,
      });
      await actions.getProductos();
    } catch (err) {
      alert(`No se pudo actualizar: ${err?.message || "error"}`);
    } finally {
      setSaving(false);
    }
  };

  const abrirWhatsApp = () => {
    if (!proveedorSeleccionado?.telefono) {
      alert("Selecciona un proveedor con teléfono para abrir WhatsApp.");
      return;
    }
    const telefono = String(proveedorSeleccionado.telefono).replace(/[^\d]/g, "");
    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(textoPedido)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const abrirEmail = () => {
    if (!proveedorSeleccionado?.email) {
      alert("Selecciona un proveedor con email para enviar correo.");
      return;
    }
    const subject = encodeURIComponent(nombrePedido || "Pedido de reposicion - SpecialWash");
    const body = encodeURIComponent(textoPedido);
    window.location.href = `mailto:${proveedorSeleccionado.email}?subject=${subject}&body=${body}`;
  };

  const abrirVistaImpresion = (auto = false) => {
    const params = new URLSearchParams();
    if (proveedorFiltroId) params.set("proveedor_id", String(proveedorFiltroId));
    // Si hay seleccionados usar esos; si no, usar los ya pedidos (en curso)
    const idsParaImprimir = selectedIds.length
      ? selectedIds
      : pedidosEnCurso.map((p) => p.id);
    if (idsParaImprimir.length) params.set("ids", idsParaImprimir.join(","));
    if (auto) params.set("auto", "1");

    // Respaldo para evitar pantalla en blanco si el store tarda en cargar.
    try {
      const idsSet = new Set(idsParaImprimir.map((id) => String(id)));
      const payloadItems = (store.productos || []).filter((p) => idsSet.has(String(p.id)));
      const payload = {
        createdAt: Date.now(),
        proveedorId: proveedorFiltroId ? String(proveedorFiltroId) : "",
        items: payloadItems,
      };
      sessionStorage.setItem("pedido_bajo_stock_print_payload", JSON.stringify(payload));
    } catch (_) {
      // no-op
    }

    const url = `/pedido-bajo-stock/imprimir?${params.toString()}`;
    navigate(url);
  };

  const imprimir = () => abrirVistaImpresion(true);

  return (
    <div className="container py-4">
      {/* ------------------------ ESTILOS ------------------------ */}
      <style>{`
        :root {
          --sw-black: #111111;
          --sw-gold: #d4af37;
          --sw-gray: #f6f6f6;
        }

        .pedido-sheet {
          background: #fff;
          padding: 24px;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,.08);
        }

        /* --------- CABECERA --------- */
        .pedido-header {
          border: 2px solid var(--sw-black);
          border-radius: 14px;
          padding: 18px;
          display: grid;
          grid-template-columns: 120px 1fr;
          gap: 16px;
          align-items: center;
          margin-bottom: 24px;
        }

        .pedido-brand {
          padding: 8px;
          border: 2px solid var(--sw-gold);
          border-radius: 12px;
          background: #fff;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .pedido-brand img {
          max-height: 90px;
          object-fit: contain;
        }

        .pedido-meta h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: .4px;
          color: var(--sw-black);
        }

        .badge-gold {
          background: var(--sw-gold);
          color: #000;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 12px;
          margin-left: 8px;
        }

        /* --------- TABLA --------- */
        .pedido-table-wrapper {
          border: 2px solid var(--sw-black);
          border-radius: 14px;
          overflow: hidden;
        }

        .pedido-table thead th {
          background: var(--sw-black);
          color: #fff;
          border-bottom: 2px solid var(--sw-gold);
          font-weight: 800;
        }

        .pedido-table tbody tr:nth-child(even) {
          background: #fafafa;
        }

        tfoot td {
          font-weight: 700;
          border-top: 2px solid var(--sw-black);
        }

        /* --------- ACCIONES --------- */
        .title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }

        /* --------- PRINT --------- */
        @media print {
          @page { margin: 12mm; }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #fff !important;
          }

          header, footer,
          nav, .navbar, .sidebar,
          .actions-no-print,
          .col-sel-print {
            display: none !important;
            visibility: hidden !important;
          }

          .pedido-sheet {
            box-shadow: none !important;
            padding: 0 !important;
          }

          .pedido-header { margin-bottom: 12px; }
          .container { max-width: 100% !important; }
        }
      `}</style>

      {/* ------------------ CONTENIDO ------------------ */}
      <div className="pedido-sheet">

        {/* Barra acciones (NO se imprime) */}
        <div className="title-row actions-no-print">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() =>
              window.history.length > 1 ? navigate(-1) : navigate("/productos")
            }
          >
            ← Volver
          </button>
          <button type="button" className="btn btn-dark" onClick={imprimir}>
            🖨️ Imprimir
          </button>
          <button type="button" className="btn btn-outline-dark" onClick={abrirVistaImpresion}>
            📄 Vista impresión
          </button>
        </div>

        <div className="row g-2 mb-3 actions-no-print">
          <div className="col-md-4">
            <label className="form-label fw-semibold">Proveedor</label>
            <select
              className="form-select"
              value={proveedorFiltroId}
              onChange={(e) => setProveedorFiltroId(e.target.value)}
            >
              <option value="">Todos (sin filtro)</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label fw-semibold">Canal</label>
            <select
              className="form-select"
              value={canalPedido}
              onChange={(e) => setCanalPedido(e.target.value)}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="impresion">Impresion</option>
            </select>
          </div>
          <div className="col-md-5">
            <label className="form-label fw-semibold">Nombre del pedido</label>
            <input
              type="text"
              className="form-control"
              value={nombrePedido}
              onChange={(e) => setNombrePedido(e.target.value)}
              placeholder="Ej: Pedido semanal proveedor"
            />
          </div>
          <div className="col-12 d-flex align-items-end gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-warning"
              onClick={marcarSeleccionadosComoPedido}
              disabled={saving || !productosSeleccionados.length}
            >
              {saving ? "Guardando..." : `Marcar pedido (${productosSeleccionados.length})`}
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={abrirWhatsApp}
              disabled={!productosSeleccionados.length}
            >
              WhatsApp
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={abrirEmail}
              disabled={!productosSeleccionados.length}
            >
              Email
            </button>
          </div>
        </div>

        {/* -------- CABECERA -------- */}
        <div className="pedido-header">
          <div className="pedido-brand">
            <img src={logo} alt="SpecialWash" />
          </div>

          <div className="pedido-meta">
            <h1>
              Pedido de Reposición
              <span className="badge-gold">SpecialWash</span>
            </h1>

            <small><strong>Fecha:</strong> {fecha}</small><br />
            <small><strong>Hora:</strong> {hora}</small><br />
            <small>
              <strong>Documento:</strong> PR-{fechaImpresion.getFullYear()}-
              {String(bajosDeStock.length).padStart(3, "0")}
            </small>
          </div>
        </div>

        {/* -------- TABLA -------- */}
        <div className="pedido-table-wrapper">
          <div className="table-responsive">
            <table className="table pedido-table mb-0">
              <thead>
                <tr>
                  <th style={{ width: 60 }} className="text-center col-sel-print">
                    Sel.
                  </th>
                  <th style={{ width: 80 }}>ID</th>
                  <th>Producto</th>
                  <th style={{ width: 200 }}>Proveedor</th>
                  <th style={{ width: 160 }}>Categoría</th>
                  <th className="text-end" style={{ width: 120 }}>Stock</th>
                  <th className="text-end" style={{ width: 120 }}>Mínimo</th>
                  <th className="text-end" style={{ width: 190 }}>Cant. a pedir</th>
                </tr>
              </thead>

              <tbody>
                {bajosDeStock.map((p) => {
                  const stock = Number(p.stock_actual ?? 0);
                  const min = Number(p.stock_minimo ?? 0);
                  const sugerido = Math.max(1, min || 1);
                  const cantidad = Number(cantidadesPedido[p.id] ?? sugerido);

                  return (
                    <tr key={p.id}>
                      <td className="text-center col-sel-print">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(p.id)}
                          onChange={(e) => toggleSelected(p.id, e.target.checked)}
                        />
                      </td>
                      <td>#{p.id}</td>
                      <td>
                        <strong>{p.nombre}</strong><br />
                        <small className="text-muted">{p.detalle || ""}</small>
                      </td>
                      <td>{p.proveedor_habitual_nombre || "—"}</td>
                      <td>{p.categoria || "—"}</td>
                      <td className="text-end">{stock}</td>
                      <td className="text-end">{min}</td>
                      <td className="text-end fw-bold">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="form-control form-control-sm text-end"
                          value={cantidad}
                          onChange={(e) => onCantidadChange(p.id, e.target.value, sugerido)}
                        />
                        <small className="text-muted">Sugerido: {sugerido}</small>
                      </td>
                    </tr>
                  );
                })}

                {bajosDeStock.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-4">
                      ✅ No hay productos pendientes de pedido para este filtro
                    </td>
                  </tr>
                )}
              </tbody>

              {bajosDeStock.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={8}>
                      Total de productos a revisar: {bajosDeStock.length}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="mt-4 actions-no-print">
          <h5 className="mb-2">Productos ya pedidos (en curso): {pedidosEnCurso.length}</h5>
          <div className="table-responsive border rounded">
            <table className="table table-sm align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 70 }}>ID</th>
                  <th>Producto</th>
                  <th style={{ width: 170 }}>Proveedor</th>
                  <th style={{ width: 120 }} className="text-end">Cant. pedida</th>
                  <th style={{ width: 120 }}>Canal</th>
                  <th style={{ width: 170 }}>Fecha pedido</th>
                  <th style={{ width: 140 }} className="text-end">Acción</th>
                </tr>
              </thead>
              <tbody>
                {pedidosEnCurso.map((p) => (
                  <tr key={`pedido-${p.id}`}>
                    <td>#{p.id}</td>
                    <td>{p.nombre}</td>
                    <td>{p.proveedor_habitual_nombre || "—"}</td>
                    <td className="text-end">{p.pedido_cantidad ?? "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{p.pedido_canal || "—"}</td>
                    <td>
                      {p.pedido_fecha
                        ? new Date(p.pedido_fecha).toLocaleString("es-ES")
                        : "—"}
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success"
                        onClick={() => marcarComoRecibido(p)}
                        disabled={saving}
                      >
                        Marcar recibido
                      </button>
                    </td>
                  </tr>
                ))}
                {!pedidosEnCurso.length && (
                  <tr>
                    <td colSpan={7} className="text-center py-3 text-muted">
                      No hay productos en pedido para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}