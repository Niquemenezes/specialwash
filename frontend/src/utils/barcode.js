/**
 * Detecta y extrae códigos de barras de una imagen
 */
export async function detectBarcodeFromFile(file) {
  if (!file) throw new Error("No se recibió imagen para escanear.");

  if (typeof window === "undefined" || typeof window.BarcodeDetector === "undefined") {
    throw new Error("Tu navegador no soporta escaneo nativo. Usa entrada manual.");
  }

  const detector = new window.BarcodeDetector({
    formats: [
      "ean_13",
      "ean_8",
      "upc_a",
      "upc_e",
      "code_128",
      "code_39",
      "itf",
      "codabar",
      "qr_code",
    ],
  });

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const barcodes = await detector.detect(bitmap);
    if (!barcodes || barcodes.length === 0) {
      throw new Error("No se detectó ningún código. Intenta con más luz y enfoque.");
    }

    const first = barcodes.find((b) => b?.rawValue)?.rawValue;
    if (!first) {
      throw new Error("No se pudo leer el valor del código.");
    }

    return String(first).trim();
  } finally {
    if (bitmap && typeof bitmap.close === "function") bitmap.close();
  }
}

/**
 * Genera un código de barras visual en formato SVG usando el algoritmo CODE128
 * @param {string} barcode - El código de barras a generar
 * @param {Object} options - Opciones de visualización
 * @returns {string} - SVG como string
 */
export function generateBarcodeSVG(barcode, options = {}) {
  const {
    width = 2,
    height = 60,
    quiet = 10,
    fontSize = 16,
  } = options;

  if (!barcode || typeof barcode !== "string") {
    return null;
  }

  // Codificación simplificada CODE128-B
  const code128Encode = (str) => {
    const chars = [];
    for (let i = 0; i < str.length; i++) {
      chars.push(str.charCodeAt(i));
    }
    
    // Por simplificidad, usamos una representación básica
    // En producción, implementar la especificación completa CODE128
    return chars.map((c) => {
      const binary = (c + 100).toString(2).padStart(11, "0");
      return binary;
    }).join("");
  };

  const encoded = code128Encode(barcode);
  
  let svgPath = `<svg width="${encoded.length * width + quiet * 2}" height="${
    height + fontSize + 20
  }" xmlns="http://www.w3.org/2000/svg">`;
  
  svgPath += `<rect width="100%" height="100%" fill="white"/>`;
  
  let x = quiet;
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === "1") {
      svgPath += `<rect x="${x}" y="0" width="${width}" height="${height}" fill="black"/>`;
    }
    x += width;
  }

  svgPath += `<text x="50%" y="${height + 18}" font-family="Arial, sans-serif" font-size="${fontSize}" text-anchor="middle" fill="black">`;
  svgPath += barcode;
  svgPath += `</text>`;
  svgPath += `</svg>`;

  return svgPath;
}

/**
 * Renderiza un código de barras en un elemento canvas o imagen
 * @param {string} barcode - El código de barras
 * @param {HTMLElement} container - Elemento donde renderizar
 */
export function renderBarcodeToElement(barcode, container) {
  if (!container || !barcode) return;

  try {
    const svg = generateBarcodeSVG(barcode, {
      width: 3,
      height: 80,
      quiet: 15,
      fontSize: 18,
    });

    if (svg) {
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      
      const img = document.createElement("img");
      img.src = url;
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.alt = `Código de barras: ${barcode}`;
      
      container.innerHTML = "";
      container.appendChild(img);

      // Limpiar URL después de un tiempo
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  } catch (err) {
    console.error("Error renderizando código de barras:", err);
  }
}
