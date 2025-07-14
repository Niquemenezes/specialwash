import React, { useEffect, useContext, useState } from "react";
import { Context } from "../store/appContext";
import { Table, Button, Modal, Form } from "react-bootstrap";

const Empleados = () => {
  const { store, actions } = useContext(Context);
  const [cargando, setCargando] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [nuevoEmpleado, setNuevoEmpleado] = useState({
    nombre: "",
    email: "",
    password: "",
    rol: "empleado",
  });

  useEffect(() => {
    cargarEmpleados();
  }, []);

  const cargarEmpleados = async () => {
    const success = await actions.getUsuariosPorRol("empleado");
    if (success) setCargando(false);
  };

  const handleChange = (e) => {
    setNuevoEmpleado({ ...nuevoEmpleado, [e.target.name]: e.target.value });
  };

  const handleCrearEmpleado = async () => {
    if (!nuevoEmpleado.nombre || !nuevoEmpleado.email || !nuevoEmpleado.password) {
      alert("Todos los campos son obligatorios");
      return;
    }

    const creado = await actions.crearEmpleado(nuevoEmpleado);
    if (creado) {
      await cargarEmpleados();
      setShowModal(false);
      setNuevoEmpleado({ nombre: "", email: "", password: "", rol: "empleado" });
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Eliminar este empleado?")) return;
    const eliminado = await actions.eliminarEmpleado(id);
    if (eliminado) await cargarEmpleados();
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Gestión de Empleados</h2>

      <Button className="mb-3" onClick={() => setShowModal(true)}>
        + Nuevo Empleado
      </Button>

      {cargando ? (
        <p>Cargando empleados...</p>
      ) : store.empleados.length === 0 ? (
        <p>No hay empleados registrados.</p>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {store.empleados.map((emp) => (
              <tr key={emp.id}>
                <td>{emp.nombre}</td>
                <td>{emp.email}</td>
                <td>{emp.rol}</td>
                <td>
                  {/* Aquí puedes agregar edición luego */}
                  <Button variant="danger" size="sm" onClick={() => handleEliminar(emp.id)}>
                    🗑️ Eliminar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Modal para nuevo empleado */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Nuevo Empleado</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Nombre</Form.Label>
              <Form.Control
                type="text"
                name="nombre"
                value={nuevoEmpleado.nombre}
                onChange={handleChange}
              />
            </Form.Group>

            <Form.Group className="mt-2">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={nuevoEmpleado.email}
                onChange={handleChange}
              />
            </Form.Group>

            <Form.Group className="mt-2">
              <Form.Label>Contraseña</Form.Label>
              <Form.Control
                type="password"
                name="password"
                value={nuevoEmpleado.password}
                onChange={handleChange}
              />
            </Form.Group>

            <Form.Group className="mt-2">
              <Form.Label>Rol</Form.Label>
              <Form.Select name="rol" value={nuevoEmpleado.rol} onChange={handleChange}>
                <option value="empleado">Empleado</option>
                <option value="pintor">Pintor</option>
                <option value="limpiador">Limpiador</option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="almacen">Almacén</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleCrearEmpleado}>
            Guardar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Empleados;
