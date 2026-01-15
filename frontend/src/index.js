import React from "react";
import { createRoot } from "react-dom/client";

// Estilos globales
import "./styles/index.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

// Punto de entrada principal
import App from "./App.js"; // ✅ usa .js en lugar de .jsx

const root = createRoot(document.getElementById("root"));
root.render(<App />);
