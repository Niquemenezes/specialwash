import React from "react";

const Footer = () => {
  return (
    <footer className="sw-footer">
      <div className="container d-flex justify-content-between align-items-center">
        <div className="sw-footer-left">
          <span className="sw-footer-brand">SPECIAL WASH STUDIO</span>
          <span className="sw-footer-copy">
            Internal Management System </span>
        </div>

        <div className="sw-footer-right">
          <span className="sw-footer-muted">
             Monique Menezes          
            © {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
