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
