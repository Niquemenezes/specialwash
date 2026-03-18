import React from "react";
import { createRoot } from "react-dom/client";

// Framework CSS
import "@fortawesome/fontawesome-free/css/all.min.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

// Estilos globales (después de Bootstrap para que puedan sobreescribirlo)
import "./styles/index.css";

// Punto de entrada principal
import App from "./App.js"; // ✅ usa .js en lugar de .jsx

const root = createRoot(document.getElementById("root"));
root.render(<App />);
