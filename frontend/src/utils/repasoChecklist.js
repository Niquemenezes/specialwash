const TIPO_LABELS = {
  detailing: "Detailing",
  preparacion: "Preparacion",
  pintura: "Pintura",
  tapicero: "Tapiceria",
  calidad: "Calidad",
  otro: "Trabajo",
};

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const slugify = (value) => {
  const slug = normalizeText(value).replace(/\s+/g, "_");
  return slug || "servicio";
};

const cleanParteDetalle = (value, fase, tipoTarea) => {
  const text = String(value || "").trim();
  if (!text) return "";

  const prefixes = [
    fase === "preparacion" ? "preparacion" : null,
    fase === "pintura" ? "pintura" : null,
    tipoTarea || null,
  ].filter(Boolean);

  let cleaned = text;
  prefixes.forEach((prefix) => {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned.replace(new RegExp(`^${escaped}\\s+`, "i"), "");
  });

  return cleaned.trim() || text;
};

const buildParteFallbackItems = (partesFinalizadas) =>
  (Array.isArray(partesFinalizadas) ? partesFinalizadas : []).map((parte, index) => {
    const detalle = cleanParteDetalle(parte?.observaciones, parte?.fase, parte?.tipo_tarea) || "Trabajo realizado";
    const tipo = parte?.fase === "preparacion" ? "preparacion" : (parte?.tipo_tarea || "otro");
    const empleado = String(parte?.empleado_nombre || "").trim();

    return {
      key: `parte_${parte?.id || index}_${slugify(detalle)}`,
      label: detalle,
      tipo,
      observaciones: empleado || null,
    };
  });

const findMatchingPartes = (servicio, partesFinalizadas) => {
  const servicioNombre = normalizeText(servicio?.nombre || servicio?.descripcion);
  const servicioTipo = String(servicio?.tipo_tarea || "").trim().toLowerCase();

  return (Array.isArray(partesFinalizadas) ? partesFinalizadas : []).filter((parte) => {
    const parteTipo = String(parte?.fase === "preparacion" ? "preparacion" : (parte?.tipo_tarea || "")).trim().toLowerCase();
    const parteTexto = normalizeText(parte?.observaciones);

    if (servicioNombre && parteTexto) {
      if (parteTexto.includes(servicioNombre) || servicioNombre.includes(parteTexto)) {
        return true;
      }

      const palabras = servicioNombre.split(" ").filter((word) => word.length >= 4);
      if (palabras.length && palabras.some((word) => parteTexto.includes(word))) {
        return true;
      }
    }

    return Boolean(servicioTipo) && servicioTipo === parteTipo;
  });
};

export const buildRepasoChecklistItems = ({ servicios, partesFinalizadas }) => {
  const serviciosValidos = (Array.isArray(servicios) ? servicios : []).filter((servicio) =>
    String(servicio?.nombre || servicio?.descripcion || "").trim()
  );

  if (!serviciosValidos.length) {
    return buildParteFallbackItems(partesFinalizadas);
  }

  return serviciosValidos.map((servicio, index) => {
    const nombre = String(servicio?.nombre || servicio?.descripcion || "").trim();
    const tipo = String(servicio?.tipo_tarea || "otro").trim().toLowerCase() || "otro";
    const coincidencias = findMatchingPartes(servicio, partesFinalizadas);
    const detalles = coincidencias
      .map((parte) => cleanParteDetalle(parte?.observaciones, parte?.fase, parte?.tipo_tarea))
      .filter(Boolean);
    const empleados = coincidencias
      .map((parte) => String(parte?.empleado_nombre || "").trim())
      .filter(Boolean);

    let observaciones = null;
    if (detalles.length) {
      observaciones = detalles.join(" · ");
    } else if (empleados.length) {
      observaciones = `Realizado por ${Array.from(new Set(empleados)).join(", ")}`;
    } else {
      observaciones = "Servicio contratado";
    }

    return {
      key: `servicio_${servicio?.servicio_catalogo_id || "manual"}_${slugify(nombre)}_${index}`,
      label: nombre,
      tipo,
      observaciones,
      tipoLabel: TIPO_LABELS[tipo] || "Trabajo",
    };
  });
};

export const buildChecklistState = (items, saved = {}) => {
  const next = {};
  (Array.isArray(items) ? items : []).forEach((item) => {
    next[item.key] = Boolean(saved?.[item.key]);
  });
  return next;
};
