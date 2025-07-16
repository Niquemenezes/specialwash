import React from "react";
import "../../styles/specialwash-theme.css";

export const Footer = () => (
  <footer className="footer mt-auto py-3 bg-dark text-center text-white specialwash-footer">
    <div className="container small">
      <span className="text-gold mx-2">© {new Date().getFullYear()} SpecialWash</span>
      <span className="text-gold mx-2">|</span>
      <span className="text-gold mx-2">Todos los derechos reservados</span>
    </div>
  </footer>
);
