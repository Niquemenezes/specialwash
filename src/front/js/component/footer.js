import React from "react";

export const Footer = () => (
  <footer className="bg-dark text-white text-center py-4 mt-5 shadow-sm">
    <div className="container">
      <p className="mb-1">© {new Date().getFullYear()} SpecialWash</p>
      <p className="mb-0">Especialistas en estética del automóvil</p>
    </div>
  </footer>
);
