import React from "react";
import CrudGenerico from "../component/CrudGenerico";

const Proveedores = () => {
  return (
    <CrudGenerico
      titulo="Proveedores"
      endpoint="proveedores"
      campos={[{ nombre: "nombre", label: "Nombre del proveedor" }]}
    />
  );
};

export default Proveedores;
