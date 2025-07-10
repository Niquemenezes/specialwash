import React from "react";
import CrudGenerico from "./CrudGenerico";

const Maquinaria = () => (
  <CrudGenerico
    titulo="Maquinaria"
    endpoint="maquinaria"
    campos={[
      { nombre: "nombre", label: "Nombre" },
      { nombre: "marca", label: "Marca" },
      { nombre: "estado", label: "Estado" }
    ]}
  />
);

export default Maquinaria;
