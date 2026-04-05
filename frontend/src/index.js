import React from "react";
import { createRoot } from "react-dom/client";

// Framework CSS
import "@fortawesome/fontawesome-free/css/all.min.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

// Estilos globales (después de Bootstrap para que puedan sobreescribirlo)
import "./styles/index.css";
import "./styles/theme-premium.css";

// Punto de entrada principal
import App from "./App.js"; // ✅ usa .js en lugar de .jsx

// Tema: respeta preferencia guardada, si no usa preferencia del sistema
const savedTheme = localStorage.getItem("sw-theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.setAttribute("data-theme", savedTheme || (prefersDark ? "dark" : "light"));

const root = createRoot(document.getElementById("root"));
root.render(<App />);
