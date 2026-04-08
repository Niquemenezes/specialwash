import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Context } from "../store/appContext";

const formatFecha = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-ES");
};

const isProfesional = (inspeccion) => {
  if (!inspeccion || typeof inspeccion !== "object") return false;
  if (Boolean(inspeccion.es_concesionario)) return true;
  if (Boolean(inspeccion?.cobro?.es_concesionario)) return true;
  return Boolean((inspeccion?.cliente?.cif || "").trim());
};

const parseActaDesdeTexto = (texto = "") => {
  const lines = texto.split("\n");
  const obsPrefix = "Observaciones de entrega:";
  const obsLine = lines.find((line) => line.trim().startsWith(obsPrefix));
  const observaciones = obsLine ? obsLine.replace(obsPrefix, "").trim() : "";

  const contenido = lines
    .filter((line) => !line.trim().startsWith(obsPrefix))
    .join("\n")
    .trim();

  return { contenido, observaciones };
};

const buildActaTexto = (contenido, observaciones) => {
  const bloques = [];
  if ((contenido || "").trim()) bloques.push((contenido || "").trim());
  if ((observaciones || "").trim()) {
    bloques.push(`Observaciones de entrega: ${(observaciones || "").trim()}`);
  }
  return bloques.join("\n\n").trim();
};

const DEFAULT_SECTION_TITLES = [
  "Estado del vehiculo a la recepcion",
  "Trabajos realizados",
  "Observaciones tecnicas",
  "Posibles efectos derivados",
  "Conclusion",
];

const extractSectionByNumber = (text, number) => {
  const next = number + 1;
  const regex = new RegExp(
    `(?:^|\\n)\\s*${number}[\\)\\.]\\s*[^\\n]*\\n([\\s\\S]*?)(?=\\n\\s*${next}[\\)\\.]\\s|$)`,
    "i"
  );
  const match = String(text || "").match(regex);
  return match ? match[1].trim() : "";
};

const parseCamposInforme = (contenido = "") => {
  const estadoRecepcion = extractSectionByNumber(contenido, 1);
  const trabajosRealizados = extractSectionByNumber(contenido, 2);
  const observacionesTecnicas = extractSectionByNumber(contenido, 3);
  const posiblesEfectos = extractSectionByNumber(contenido, 4);
  const conclusion = extractSectionByNumber(contenido, 5);

  const hasStructured = [
    estadoRecepcion,
    trabajosRealizados,
    observacionesTecnicas,
    posiblesEfectos,
    conclusion,
  ].some((v) => (v || "").trim());

  return {
    estadoRecepcion,
    trabajosRealizados: hasStructured ? trabajosRealizados : String(contenido || "").trim(),
    observacionesTecnicas,
    posiblesEfectos,
    conclusion,
  };
};

const createSectionsFromData = (campos, estadoDesdeInspeccion) => {
  const values = [
    estadoDesdeInspeccion || campos.estadoRecepcion || "",
    campos.trabajosRealizados || "",
    campos.observacionesTecnicas || "",
    campos.posiblesEfectos || "",
    campos.conclusion || "",
  ];

  return DEFAULT_SECTION_TITLES.map((title, idx) => ({
    id: `sec-${idx + 1}`,
    title,
    content: values[idx],
    fromInspection: idx === 0 && Boolean(estadoDesdeInspeccion),
  }));
};

const buildInformeTecnicoFromSections = (sections = []) => {
  const norm = (v) => (String(v || "").trim() ? String(v || "").trim() : "-");
  return sections
    .map((section, idx) => `${idx + 1}) ${section.title || "Punto"}\n${norm(section.content)}`)
    .join("\n\n");
};

const clipText = (value = "", maxChars = 260) => {
  const text = String(value || "").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trim()}...`;
};

const buildCompactContext = (sections = [], preferredIndex = -1) => {
  const withContent = sections
    .map((section, idx) => ({ section, idx }))
    .filter(({ section }) => String(section.content || "").trim());

  const ordered = preferredIndex >= 0
    ? withContent.sort((a, b) => (a.idx === preferredIndex ? -1 : b.idx === preferredIndex ? 1 : a.idx - b.idx))
    : withContent;

  return ordered
    .slice(0, 4)
    .map(({ section, idx }) => `${idx + 1}) ${section.title || "Punto"}\n${clipText(section.content, 260)}`)
    .join("\n\n");
};

const detectActaTemplate = (inspeccion) => {
  const base = [
    inspeccion?.averias_notas,
    inspeccion?.trabajos_realizados,
    inspeccion?.coche_descripcion,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(pintura|laca|paragolpes|aleta|capo|panel|repint|restaur)/.test(base)) {
    return "restauracion_pintura";
  }
  if (/(pulido|correccion|microara|holograma|swirl|detailing|coating)/.test(base)) {
    return "detailing_correccion";
  }
  if (/(interior|tapicer|cuero|textil|ozono|desinfeccion)/.test(base)) {
    return "detailing_interior";
  }
  return "general";
};

const buildAutoDraft = (inspeccion) => {
  const template = detectActaTemplate(inspeccion);
  const vehiculo = inspeccion?.coche_descripcion || "vehiculo";
  const matricula = inspeccion?.matricula || "-";
  const km = Number(inspeccion?.kilometros || 0).toLocaleString("es-ES");
  const observacionesRecepcion = clipText(inspeccion?.averias_notas || "Sin observaciones registradas en recepcion.", 380);

  const common = {
    estado: `Recepcion tecnica de ${vehiculo} (matricula ${matricula}, ${km} km). Como referencia inicial se documentaron las siguientes observaciones: ${observacionesRecepcion}`,
    observaciones: "Entrega efectuada tras verificación de acabado, revisión visual de superficies y control final de conformidad. Se recomienda mantenimiento preventivo para preservar el resultado obtenido.",
    efectos: "La evolución del acabado puede variar según condiciones de uso, exposición ambiental y hábitos de mantenimiento. Se aconseja revisión periódica para conservar el estándar técnico alcanzado.",
  };

  if (template === "restauracion_pintura") {
    return {
      templateLabel: "Restauracion y pintura",
      sectionTexts: [
        common.estado,
        "Se ejecutaron tareas de preparación de superficie, corrección localizada y acabado conforme al alcance definido en la orden de trabajo.",
        "Tras la intervención se verificaron uniformidad visual, continuidad de superficie y coherencia de terminación en las zonas tratadas.",
        common.efectos,
        "El vehículo queda listo para entrega dentro del alcance intervenido, con trazabilidad de proceso y cierre técnico documentado.",
      ],
      observaciones: common.observaciones,
    };
  }

  if (template === "detailing_correccion") {
    return {
      templateLabel: "Detailing y correccion",
      sectionTexts: [
        common.estado,
        "Se realizaron tareas de limpieza técnica, descontaminación y corrección de acabado dentro de los límites definidos para el servicio.",
        "Se comprobó mejora de definición visual y reducción de defectos superficiales apreciables en las áreas tratadas.",
        common.efectos,
        "El resultado queda validado para entrega, con recomendación de mantenimiento preventivo para prolongar la condición del acabado.",
      ],
      observaciones: common.observaciones,
    };
  }

  if (template === "detailing_interior") {
    return {
      templateLabel: "Detailing interior",
      sectionTexts: [
        common.estado,
        "Se realizaron tareas de acondicionamiento interior, limpieza técnica de superficies y tratamiento de materiales según alcance contratado.",
        "Se verificó estado final de habitáculo, terminación visual homogénea y ausencia de residuos de proceso en zonas intervenidas.",
        common.efectos,
        "El vehículo queda listo para entrega con interior estabilizado en limpieza y presentación, dentro del alcance ejecutado.",
      ],
      observaciones: common.observaciones,
    };
  }

  return {
    templateLabel: "Plantilla general",
    sectionTexts: [
      common.estado,
      "Se ejecutaron los trabajos solicitados conforme al alcance definido y a la revisión técnica inicial del vehículo.",
      "Se realizó control técnico final sobre las zonas intervenidas para validar consistencia y estado de entrega.",
      common.efectos,
      "Servicio finalizado y documentado para entrega al cliente, con recomendaciones de mantenimiento posterior.",
    ],
    observaciones: common.observaciones,
  };
};

const buildServiciosAplicadosTexto = (servicios = []) => {
  const lista = Array.isArray(servicios) ? servicios : [];
  const items = lista
    .map((s) => {
      if (!s || typeof s !== "object") return "";
      const nombre = String(s.nombre || "").trim();
      if (!nombre) return "";

      const origen = String(s.origen || "manual").toLowerCase();
      const mins = Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0;
      const precio = Number.parseFloat(s.precio || 0) || 0;

      const parts = [nombre];
      if (origen === "manual") parts.push("manual");
      if (mins > 0) parts.push(`${mins} min`);
      if (precio > 0) parts.push(`${precio.toFixed(2)} EUR`);

      return `- ${parts.join(" · ")}`;
    })
    .filter(Boolean);

  if (!items.length) return "";
  return `Servicios aplicados registrados:\n${items.join("\n")}`;
};

const mergeTrabajosConServicios = (trabajosActuales, serviciosAplicadosTexto) => {
  const base = String(trabajosActuales || "").trim();
  const servicios = String(serviciosAplicadosTexto || "").trim();
  if (!servicios) return base;

  if (!base) return servicios;
  if (base.toLowerCase().includes("servicios aplicados registrados:")) return base;

  return `${base}\n\n${servicios}`;
};

const cleanSectionDraft = (text = "", title = "") => {
  const raw = String(text || "").trim();
  if (!raw) return "";

  const noNumeric = raw.replace(/^\s*\d+[).]\s*[\s\S]*?\n/, "").trim();
  const titleRegex = new RegExp(`^${String(title || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:.-]?\\s*`, "i");
  return noNumeric.replace(titleRegex, "").trim() || raw;
};

const PREMIUM_TONE_RULES = [
  "Usa un tono profesional, tecnico y objetivo.",
  "Escribe frases cortas, directas y verificables.",
  "Evita lenguaje comercial o adjetivos grandilocuentes.",
  "Sin exageraciones, sin promesas y sin florituras.",
].join(" ");

const AI_OPT_IN_STORAGE_KEY = "sw_acta_ai_opt_in";

const getFriendlyAiError = (error) => {
  const raw = String(error?.message || error || "");
  const lower = raw.toLowerCase();
  const isQuota = lower.includes("insufficient_quota") || lower.includes("exceeded your current quota");

  if (isQuota) {
    return {
      isQuota: true,
      message:
        "No hay creditos disponibles en OpenAI para usar IA ahora mismo. " +
        "Puedes continuar con 'Generar borrador automatico' (sin coste) y guardar el acta normalmente.",
    };
  }

  return {
    isQuota: false,
    message: `No se pudo completar la solicitud con IA: ${raw || "error desconocido"}`,
  };
};

const CochesPendientesEntrega = () => {
  const { actions } = useContext(Context);
  const navigate = useNavigate();
  const [inspecciones, setInspecciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showActaModal, setShowActaModal] = useState(false);
  const [inspeccionActa, setInspeccionActa] = useState(null);
  const [observacionesActa, setObservacionesActa] = useState("");
  const [guardandoActa, setGuardandoActa] = useState(false);
  const [aiObservacionesLoading, setAiObservacionesLoading] = useState(false);
  const [ultimaPlantilla, setUltimaPlantilla] = useState("");
  const [usarIA, setUsarIA] = useState(() => {
    try {
      return localStorage.getItem(AI_OPT_IN_STORAGE_KEY) === "1";
    } catch (_) {
      return false;
    }
  });
  const [sections, setSections] = useState(() =>
    DEFAULT_SECTION_TITLES.map((title, idx) => ({ id: `sec-${idx + 1}`, title, content: "", fromInspection: false }))
  );
  const [aiBySection, setAiBySection] = useState({});

  useEffect(() => {
    try {
      localStorage.setItem(AI_OPT_IN_STORAGE_KEY, usarIA ? "1" : "0");
    } catch (_) {
      // no-op
    }
  }, [usarIA]);

  const cargarPendientes = useCallback(async () => {
    setLoading(true);
    const data = await actions.getPendientesEntrega();
    setInspecciones(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [actions]);

  useEffect(() => {
    cargarPendientes();
  }, [cargarPendientes]);

  const pendientes = useMemo(() => {
    return inspecciones
      .filter((inspeccion) => !inspeccion.entregado)
      .sort((a, b) => new Date(b.fecha_inspeccion || 0) - new Date(a.fecha_inspeccion || 0));
  }, [inspecciones]);

  const abrirPrepararActa = async (inspeccionId) => {
    try {
      const detalle = await actions.getInspeccion(inspeccionId);
      const parsed = parseActaDesdeTexto(detalle?.trabajos_realizados || "");
      const campos = parseCamposInforme(parsed.contenido || "");
      const estadoDesdeInspeccion = (detalle?.averias_notas || "").trim();
      const serviciosAplicadosTexto = buildServiciosAplicadosTexto(detalle?.servicios_aplicados || []);
      const seccionesBase = createSectionsFromData(campos, estadoDesdeInspeccion);
      const seccionesConServicios = seccionesBase.map((section, idx) => {
        // Sección 2 = "Trabajos realizados"
        if (idx !== 1) return section;
        return {
          ...section,
          content: mergeTrabajosConServicios(section.content, serviciosAplicadosTexto),
        };
      });

      setInspeccionActa(detalle);
      setObservacionesActa(detalle?.entrega_observaciones || parsed.observaciones || "");
      setSections(seccionesConServicios);
      setUltimaPlantilla("");
      setAiBySection({});
      setShowActaModal(true);
    } catch (err) {
      alert(`No se pudo abrir el acta: ${err.message}`);
    }
  };

  const cerrarPrepararActa = () => {
    setShowActaModal(false);
    setInspeccionActa(null);
    setObservacionesActa("");
    setGuardandoActa(false);
    setAiObservacionesLoading(false);
    setUltimaPlantilla("");
    setSections(DEFAULT_SECTION_TITLES.map((title, idx) => ({ id: `sec-${idx + 1}`, title, content: "", fromInspection: false })));
    setAiBySection({});
  };

  const generarBorradorAutomatico = () => {
    if (!inspeccionActa) return;
    const draft = buildAutoDraft(inspeccionActa);

    setSections((prev) => prev.map((section, idx) => {
      const hasContent = String(section.content || "").trim().length > 0;
      if (hasContent) return section;
      return {
        ...section,
        content: draft.sectionTexts[idx] || section.content,
      };
    }));

    if (!String(observacionesActa || "").trim()) {
      setObservacionesActa(draft.observaciones);
    }
    setUltimaPlantilla(draft.templateLabel);
  };

  const actualizarSeccion = (id, patch) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const agregarSeccion = () => {
    setSections((prev) => [
      ...prev,
      {
        id: `sec-${Date.now()}`,
        title: "Nuevo punto",
        content: "",
        fromInspection: false,
      },
    ]);
  };

  const eliminarSeccion = (id) => {
    setSections((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
  };

  const redactarSeccionConAI = async (section, index) => {
    if (!usarIA) {
      alert("La IA esta desactivada para evitar gasto de creditos. Activa la opcion 'Usar IA (gasta creditos)' si la necesitas.");
      return;
    }
    if (!inspeccionActa) return;
    setAiBySection((prev) => ({ ...prev, [section.id]: true }));
    try {
      const contextoActual = buildCompactContext(sections, index);
      const promptSeccion = [
        `Redacta solo el punto ${index + 1}: ${section.title}.`,
        PREMIUM_TONE_RULES,
        "Maximo 70 palabras. Solo hechos tecnicos y resultados observables.",
        "No repitas todo el informe, responde solo con el texto del punto.",
        `Texto base del punto: ${clipText(section.content || "(vacio)", 260)}`,
        "",
        "Contexto breve del informe:",
        contextoActual,
      ].join("\n");

      const data = await actions.sugerirActaInspeccion(inspeccionActa.id, {
        borrador: promptSeccion,
        averias_notas: inspeccionActa?.averias_notas || "",
      });

      const texto = (data?.texto || "").trim();
      if (!texto) {
        alert("La AI no devolvio texto para esta seccion.");
        return;
      }

      const maybeByNumber = extractSectionByNumber(texto, index + 1);
      const finalText = cleanSectionDraft(maybeByNumber || texto, section.title);
      actualizarSeccion(section.id, { content: finalText || section.content });
    } catch (err) {
      const aiErr = getFriendlyAiError(err);
      if (aiErr.isQuota) setUsarIA(false);
      alert(aiErr.message);
    } finally {
      setAiBySection((prev) => ({ ...prev, [section.id]: false }));
    }
  };

  const redactarObservacionesConAI = async () => {
    if (!usarIA) {
      alert("La IA esta desactivada para evitar gasto de creditos. Activa la opcion 'Usar IA (gasta creditos)' si la necesitas.");
      return;
    }
    if (!inspeccionActa) return;
    setAiObservacionesLoading(true);
    try {
      const contextoActual = buildCompactContext(sections);
      const promptObservaciones = [
        "Redacta solo el bloque 'Observaciones de entrega'.",
        PREMIUM_TONE_RULES,
        "Maximo 45 palabras. Cierre sobrio, tecnico y sin promocion.",
        "No repitas todo el informe tecnico, responde unicamente con las observaciones finales.",
        `Texto base actual: ${clipText(observacionesActa || "(vacio)", 200)}`,
        "",
        "Contexto breve del informe tecnico:",
        contextoActual,
      ].join("\n");

      const data = await actions.sugerirActaInspeccion(inspeccionActa.id, {
        borrador: promptObservaciones,
        averias_notas: inspeccionActa?.averias_notas || "",
      });

      const texto = String(data?.texto || "").trim();
      if (!texto) {
        alert("La AI no devolvio texto para las observaciones finales.");
        return;
      }

      // Si el modelo devuelve prefijos o titulo, los limpiamos para guardar solo el contenido.
      const cleaned = texto
        .replace(/^\s*observaciones\s*(de\s*entrega)?\s*[:.-]?\s*/i, "")
        .trim();

      setObservacionesActa(cleaned || texto);
    } catch (err) {
      const aiErr = getFriendlyAiError(err);
      if (aiErr.isQuota) setUsarIA(false);
      alert(aiErr.message);
    } finally {
      setAiObservacionesLoading(false);
    }
  };

  const guardarActa = async () => {
    if (!inspeccionActa) return;

    const informeTecnico = buildInformeTecnicoFromSections(sections);

    const hayContenido = sections.some((s) => String(s.content || "").trim());
    if (!hayContenido) {
      alert("Debes rellenar al menos un punto del informe tecnico antes de guardar.");
      return;
    }

    const texto = buildActaTexto(informeTecnico, observacionesActa);
    if (!texto.trim()) {
      alert("Debes rellenar el contenido del acta antes de guardar.");
      return;
    }

    setGuardandoActa(true);
    try {
      await actions.guardarActaInspeccion(inspeccionActa.id, {
        trabajos_realizados: texto,
        entrega_observaciones: observacionesActa,
      });
      await cargarPendientes();
      alert("Acta guardada correctamente.");
      cerrarPrepararActa();
    } catch (err) {
      alert(`Error al guardar acta: ${err.message}`);
      setGuardandoActa(false);
    }
  };

  const volver = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: true });
  };

  /* ── SVG icons ── */
  const ICONS = {
    car:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>),
    refresh: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115.454-3.454M20 15a9 9 0 01-15.454 3.454"/></svg>),
    sign:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>),
    list:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>),
    pdf:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>),
    prep:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>),
    close:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
    save:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>),
    plus:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
    ai:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>),
    trash:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>),
  };

  return (
    <div>
      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Pendientes",    value: pendientes.length,                                            color: "var(--sw-accent,#d4af37)" },
          { label: "Con acta",      value: pendientes.filter(i => (i.trabajos_realizados||"").trim()).length, color: "#22c55e" },
          { label: "Sin acta",      value: pendientes.filter(i => !(i.trabajos_realizados||"").trim() && !isProfesional(i)).length, color: "#f87171" },
          { label: "Profesionales", value: pendientes.filter(isProfesional).length,                      color: "#38bdf8" },
        ].map((item) => (
          <div key={item.label} style={{
            background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
            borderRadius: 14, padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem",
          }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>{item.label}</span>
            <span style={{ fontSize: "1.5rem", fontWeight: 800, color: item.color, lineHeight: 1.2 }}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Acciones rápidas */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <Link
            to="/repaso-entrega?tab=firma"
            style={{
              background: "color-mix(in srgb,#22c55e 12%,transparent)",
              border: "1px solid color-mix(in srgb,#22c55e 30%,transparent)",
              color: "#22c55e", borderRadius: 10, padding: "0.5rem 1rem",
              fontWeight: 700, fontSize: "0.82rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.4rem",
            }}
          >
            <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.sign}</span>
            Firma de entrega
          </Link>
          <Link
            to="/entregados"
            style={{
              background: "color-mix(in srgb,#38bdf8 12%,transparent)",
              border: "1px solid color-mix(in srgb,#38bdf8 30%,transparent)",
              color: "#38bdf8", borderRadius: 10, padding: "0.5rem 1rem",
              fontWeight: 700, fontSize: "0.82rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.4rem",
            }}
          >
            <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.car}</span>
            Ver entregados
          </Link>
        </div>
        <button
          onClick={cargarPendientes}
          style={{
            background: "color-mix(in srgb,var(--sw-accent,#d4af37) 12%,transparent)",
            border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 30%,transparent)",
            color: "var(--sw-accent,#d4af37)", borderRadius: 10, padding: "0.5rem 1rem",
            cursor: "pointer", fontWeight: 600, fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.4rem",
          }}
        >
          <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.refresh}</span>
          Actualizar
        </button>
      </div>

      {/* Tabla */}
      <div style={{
        background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
        borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
      }}>
        <div className="table-responsive">
          <table className="table align-middle mb-0" style={{ color: "var(--sw-text)" }}>
            <thead>
              <tr style={{ background: "var(--sw-surface-2)", borderBottom: "2px solid var(--sw-border)" }}>
                {["#", "Cliente", "Coche", "Matrícula", "Fecha inspección", "Estado operativo", "Acta", ""].map((h) => (
                  <th key={h} style={{
                    padding: "0.85rem 1rem", fontSize: "0.65rem", fontWeight: 700,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: "var(--sw-muted)", border: "none",
                    textAlign: h === "" ? "right" : "left",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "3.5rem", color: "var(--sw-muted)" }}>
                    <div className="spinner-border spinner-border-sm me-2" style={{ color: "var(--sw-accent,#d4af37)" }} />
                    Cargando pendientes…
                  </td>
                </tr>
              )}
              {!loading && pendientes.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "3.5rem", color: "var(--sw-muted)", fontSize: "0.9rem" }}>
                    No hay coches pendientes de entrega.
                  </td>
                </tr>
              )}
              {!loading && pendientes.map((inspeccion) => (
                <tr
                  key={inspeccion.id}
                  style={{ borderBottom: "1px solid var(--sw-border)", transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "color-mix(in srgb,var(--sw-accent,#d4af37) 5%,transparent)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "0.85rem 1rem", color: "var(--sw-muted)", fontSize: "0.78rem", fontWeight: 600 }}>
                    #{inspeccion.id}
                  </td>
                  <td style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--sw-text)" }}>
                    {inspeccion.cliente_nombre || "—"}
                  </td>
                  <td style={{ padding: "0.85rem 1rem", color: "var(--sw-muted)", fontSize: "0.85rem" }}>
                    {inspeccion.coche_descripcion || "—"}
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    {inspeccion.matricula ? (
                      <span style={{
                        background: "color-mix(in srgb,var(--sw-accent,#d4af37) 12%,transparent)",
                        border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 30%,transparent)",
                        color: "var(--sw-accent,#d4af37)", borderRadius: 6,
                        padding: "0.15rem 0.6rem", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.05em",
                      }}>{inspeccion.matricula}</span>
                    ) : <span style={{ color: "var(--sw-muted)", fontStyle: "italic" }}>—</span>}
                  </td>
                  <td style={{ padding: "0.85rem 1rem", color: "var(--sw-muted)", fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                    {formatFecha(inspeccion.fecha_inspeccion)}
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    {inspeccion.estado_coche ? (
                      <div>
                        <span style={{
                          background: `${inspeccion.estado_coche.color}22`,
                          border: `1px solid ${inspeccion.estado_coche.color}55`,
                          color: inspeccion.estado_coche.color,
                          borderRadius: 6, padding: "0.15rem 0.55rem",
                          fontWeight: 700, fontSize: "0.72rem",
                        }}>{inspeccion.estado_coche.label}</span>
                        {inspeccion.estado_coche.parte_empleado_nombre && (
                          <div style={{ fontSize: "0.72rem", color: "var(--sw-muted)", marginTop: "0.2rem" }}>
                            Con: {inspeccion.estado_coche.parte_empleado_nombre}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "var(--sw-muted)", fontStyle: "italic", fontSize: "0.82rem" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    {isProfesional(inspeccion) ? (
                      <span style={{
                        background: "color-mix(in srgb,#38bdf8 12%,transparent)",
                        border: "1px solid color-mix(in srgb,#38bdf8 30%,transparent)",
                        color: "#38bdf8", borderRadius: 6, padding: "0.15rem 0.55rem",
                        fontWeight: 700, fontSize: "0.72rem",
                      }}>No requerida</span>
                    ) : (inspeccion.trabajos_realizados || "").trim() ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        <span style={{
                          background: "color-mix(in srgb,#22c55e 12%,transparent)",
                          border: "1px solid color-mix(in srgb,#22c55e 30%,transparent)",
                          color: "#22c55e", borderRadius: 6, padding: "0.15rem 0.55rem",
                          fontWeight: 700, fontSize: "0.72rem", alignSelf: "flex-start",
                        }}>Guardada</span>
                        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                          <a
                            href={`/acta-entrega-doc/${inspeccion.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Imprimir borrador"
                            style={{
                              background: "color-mix(in srgb,var(--sw-muted) 10%,transparent)",
                              border: "1px solid color-mix(in srgb,var(--sw-muted) 22%,transparent)",
                              color: "var(--sw-muted)", borderRadius: 7,
                              padding: "0.25rem 0.45rem", display: "flex", alignItems: "center", textDecoration: "none",
                            }}
                          >
                            <span style={{ width: 13, height: 13, display: "flex" }}>{ICONS.list}</span>
                          </a>
                          <a
                            href={`/acta-entrega-doc/${inspeccion.id}?print=1`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Descargar PDF"
                            style={{
                              background: "color-mix(in srgb,#f87171 10%,transparent)",
                              border: "1px solid color-mix(in srgb,#f87171 25%,transparent)",
                              color: "#f87171", borderRadius: 7,
                              padding: "0.25rem 0.45rem", display: "flex", alignItems: "center", textDecoration: "none",
                            }}
                          >
                            <span style={{ width: 13, height: 13, display: "flex" }}>{ICONS.pdf}</span>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <span style={{
                        background: "color-mix(in srgb,#f59e0b 10%,transparent)",
                        border: "1px solid color-mix(in srgb,#f59e0b 25%,transparent)",
                        color: "#f59e0b", borderRadius: 6, padding: "0.15rem 0.55rem",
                        fontWeight: 700, fontSize: "0.72rem",
                      }}>Sin hoja</span>
                    )}
                  </td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "right" }}>
                    {!isProfesional(inspeccion) && (
                      <button
                        onClick={() => abrirPrepararActa(inspeccion.id)}
                        title="Preparar hoja de intervención"
                        style={{
                          background: "color-mix(in srgb,var(--sw-accent,#d4af37) 12%,transparent)",
                          border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 30%,transparent)",
                          color: "var(--sw-accent,#d4af37)", borderRadius: 8,
                          padding: "0.35rem 0.6rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem",
                          fontWeight: 700, fontSize: "0.78rem",
                        }}
                      >
                        <span style={{ width: 13, height: 13, display: "flex" }}>{ICONS.prep}</span>
                        Hoja
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showActaModal && inspeccionActa && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1050,
            background: "var(--sw-overlay-bg,rgba(0,0,0,0.65))",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem", backdropFilter: "blur(4px)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) cerrarPrepararActa(); }}
        >
          <div style={{
            background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
            borderRadius: 20, width: "100%", maxWidth: 680, maxHeight: "92vh",
            display: "flex", flexDirection: "column",
            boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
            animation: "sw-fade-up 0.22s ease both",
          }}>
            {/* Header */}
            <div style={{
              padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--sw-border)",
              display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "color-mix(in srgb,var(--sw-accent,#d4af37) 14%,transparent)",
                  border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 28%,transparent)",
                  color: "var(--sw-accent,#d4af37)",
                }}>
                  <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.prep}</span>
                </span>
                <div>
                  <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>
                    Hoja de intervención
                  </p>
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--sw-text)" }}>
                    #{inspeccionActa.id} — {inspeccionActa.matricula || "Sin matrícula"}
                  </h3>
                </div>
              </div>
              <button onClick={cerrarPrepararActa} style={{ background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer", padding: "0.25rem", borderRadius: 6, display: "flex" }}>
                <span style={{ width: 20, height: 20, display: "flex" }}>{ICONS.close}</span>
              </button>
            </div>

            {/* Body scrollable */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

              {/* Toggle IA */}
              <div style={{
                background: "color-mix(in srgb,#f59e0b 10%,transparent)",
                border: "1px solid color-mix(in srgb,#f59e0b 28%,transparent)",
                borderRadius: 12, padding: "0.75rem 1rem",
                display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem",
              }}>
                <span style={{ fontSize: "0.82rem", color: "var(--sw-text)" }}>
                  Modo ahorro: IA desactivada por defecto para no consumir créditos.
                </span>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", userSelect: "none" }}>
                  <div style={{
                    width: 38, height: 22, borderRadius: 11, transition: "background 0.2s",
                    background: usarIA ? "var(--sw-accent,#d4af37)" : "var(--sw-border)", position: "relative", flexShrink: 0,
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 3, left: usarIA ? 19 : 3, transition: "left 0.2s",
                    }} />
                    <input type="checkbox" checked={usarIA} onChange={(e) => setUsarIA(e.target.checked)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                  </div>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: usarIA ? "var(--sw-accent,#d4af37)" : "var(--sw-muted)" }}>
                    Usar IA (gasta créditos)
                  </span>
                </label>
              </div>

              {/* Datos del vehículo */}
              <div style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: 12, padding: "1rem 1.25rem" }}>
                <p style={{ margin: "0 0 0.6rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)" }}>
                  Datos del vehículo
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "0.5rem" }}>
                  {[
                    { label: "Cliente",    value: inspeccionActa.cliente_nombre },
                    { label: "Teléfono",   value: inspeccionActa.cliente_telefono },
                    { label: "Vehículo",   value: inspeccionActa.coche_descripcion },
                    { label: "Matrícula",  value: inspeccionActa.matricula },
                    { label: "Kilometraje", value: `${Number(inspeccionActa.kilometros || 0).toLocaleString("es-ES")} km` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--sw-muted)" }}>{label}</span>
                      <p style={{ margin: "0.1rem 0 0", fontWeight: 600, color: "var(--sw-text)", fontSize: "0.88rem" }}>{value || "—"}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Informe técnico */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)" }}>
                    Informe técnico de intervención
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      onClick={generarBorradorAutomatico}
                      style={{
                        background: "color-mix(in srgb,#38bdf8 12%,transparent)",
                        border: "1px solid color-mix(in srgb,#38bdf8 30%,transparent)",
                        color: "#38bdf8", borderRadius: 8, padding: "0.35rem 0.75rem",
                        cursor: "pointer", fontWeight: 600, fontSize: "0.78rem",
                        display: "flex", alignItems: "center", gap: "0.35rem",
                      }}
                    >
                      <span style={{ width: 13, height: 13, display: "flex" }}>{ICONS.ai}</span>
                      Borrador auto
                    </button>
                    <button
                      onClick={agregarSeccion}
                      style={{
                        background: "color-mix(in srgb,var(--sw-accent,#d4af37) 12%,transparent)",
                        border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 30%,transparent)",
                        color: "var(--sw-accent,#d4af37)", borderRadius: 8, padding: "0.35rem 0.75rem",
                        cursor: "pointer", fontWeight: 600, fontSize: "0.78rem",
                        display: "flex", alignItems: "center", gap: "0.35rem",
                      }}
                    >
                      <span style={{ width: 13, height: 13, display: "flex" }}>{ICONS.plus}</span>
                      Agregar punto
                    </button>
                  </div>
                </div>

                {ultimaPlantilla && (
                  <p style={{ fontSize: "0.75rem", color: "var(--sw-muted)", marginBottom: "0.6rem" }}>
                    Plantilla aplicada: <strong>{ultimaPlantilla}</strong>. Solo rellena campos vacíos.
                  </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {sections.map((section, idx) => (
                    <div key={section.id} style={{
                      background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)",
                      borderRadius: 12, padding: "1rem",
                    }}>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.6rem", flexWrap: "wrap" }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                          background: "color-mix(in srgb,var(--sw-accent,#d4af37) 14%,transparent)",
                          border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 28%,transparent)",
                          color: "var(--sw-accent,#d4af37)", fontWeight: 800, fontSize: "0.72rem", flexShrink: 0,
                        }}>{idx + 1}</span>
                        <input
                          className="form-control sw-pinput"
                          style={{ flex: 1, minWidth: 120, fontSize: "0.85rem", fontWeight: 600 }}
                          value={section.title}
                          onChange={(e) => actualizarSeccion(section.id, { title: e.target.value })}
                          placeholder="Título del punto"
                        />
                        <button
                          onClick={() => redactarSeccionConAI(section, idx)}
                          disabled={!usarIA || Boolean(aiBySection[section.id]) || guardandoActa}
                          title="Redactar con IA"
                          style={{
                            background: usarIA ? "color-mix(in srgb,#a78bfa 12%,transparent)" : "var(--sw-surface)",
                            border: `1px solid ${usarIA ? "color-mix(in srgb,#a78bfa 30%,transparent)" : "var(--sw-border)"}`,
                            color: usarIA ? "#a78bfa" : "var(--sw-muted)", borderRadius: 8,
                            padding: "0.3rem 0.5rem", cursor: usarIA ? "pointer" : "not-allowed",
                            display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.72rem", fontWeight: 600,
                            opacity: (!usarIA || guardandoActa) ? 0.5 : 1,
                          }}
                        >
                          <span style={{ width: 12, height: 12, display: "flex" }}>{ICONS.ai}</span>
                          {aiBySection[section.id] ? "IA…" : "IA"}
                        </button>
                        <button
                          onClick={() => eliminarSeccion(section.id)}
                          disabled={sections.length === 1}
                          title="Eliminar punto"
                          style={{
                            background: "color-mix(in srgb,#ef4444 10%,transparent)",
                            border: "1px solid color-mix(in srgb,#ef4444 25%,transparent)",
                            color: "#ef4444", borderRadius: 8,
                            padding: "0.3rem 0.5rem", cursor: sections.length === 1 ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", opacity: sections.length === 1 ? 0.4 : 1,
                          }}
                        >
                          <span style={{ width: 12, height: 12, display: "flex" }}>{ICONS.trash}</span>
                        </button>
                      </div>
                      <textarea
                        className="form-control sw-pinput"
                        rows={3}
                        value={section.content}
                        onChange={(e) => actualizarSeccion(section.id, { content: e.target.value })}
                        placeholder="Describe este punto en lenguaje técnico…"
                        style={section.fromInspection ? { opacity: 0.8 } : undefined}
                      />
                      {section.fromInspection && (
                        <p style={{ margin: "0.3rem 0 0", fontSize: "0.72rem", color: "var(--sw-muted)" }}>Texto precargado desde la inspección de recepción.</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Observaciones de entrega */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)" }}>
                    Observaciones de entrega
                  </p>
                  <button
                    onClick={redactarObservacionesConAI}
                    disabled={!usarIA || aiObservacionesLoading || guardandoActa}
                    style={{
                      background: usarIA ? "color-mix(in srgb,#a78bfa 12%,transparent)" : "var(--sw-surface)",
                      border: `1px solid ${usarIA ? "color-mix(in srgb,#a78bfa 30%,transparent)" : "var(--sw-border)"}`,
                      color: usarIA ? "#a78bfa" : "var(--sw-muted)", borderRadius: 8,
                      padding: "0.35rem 0.75rem", cursor: usarIA ? "pointer" : "not-allowed",
                      display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", fontWeight: 600,
                      opacity: (!usarIA || guardandoActa) ? 0.5 : 1,
                    }}
                  >
                    <span style={{ width: 13, height: 13, display: "flex" }}>{ICONS.ai}</span>
                    {aiObservacionesLoading ? "IA…" : "IA observaciones"}
                  </button>
                </div>
                <textarea
                  className="form-control sw-pinput"
                  rows={3}
                  value={observacionesActa}
                  onChange={(e) => setObservacionesActa(e.target.value)}
                  placeholder="Cierre profesional: valor entregado, nivel de detalle y confianza al cliente…"
                />
              </div>

            </div>

            {/* Footer */}
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--sw-border)", display: "flex", justifyContent: "flex-end", gap: "0.75rem", flexShrink: 0 }}>
              <button
                onClick={cerrarPrepararActa}
                style={{
                  background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)",
                  color: "var(--sw-muted)", borderRadius: 10, padding: "0.6rem 1.2rem",
                  fontWeight: 600, fontSize: "0.85rem", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={guardarActa}
                disabled={guardandoActa}
                style={{
                  background: "var(--sw-accent,#d4af37)", border: "none",
                  color: "#000", borderRadius: 10, padding: "0.6rem 1.4rem",
                  fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "0.4rem",
                  opacity: guardandoActa ? 0.6 : 1,
                }}
              >
                <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.save}</span>
                {guardandoActa ? "Guardando…" : "Guardar hoja"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CochesPendientesEntrega;
