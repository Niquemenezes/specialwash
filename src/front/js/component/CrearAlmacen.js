import React, { useState, useContext } from "react";
import { Context } from "../store/appContext";
import { Form, Button } from "react-bootstrap";

const CrearAlmacenPrincipal = () => {
  const { actions } = useContext(Context);
  const [nombre, setNombre] = useState("Almacén Principal");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nombre.trim()) return alert("El nombre es obligatorio");
    actions.crearAlmacen(nombre);
    setNombre("");
  };

  return (
    <div className="container mt-4">
      <h2>Crear Almacén Principal</h2>
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>Nombre del almacén</Form.Label>
          <Form.Control
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Almacén Principal"
          />
        </Form.Group>
        <Button type="submit" variant="primary">
          Crear almacén
        </Button>
      </Form>
    </div>
  );
};

export default CrearAlmacenPrincipal;
