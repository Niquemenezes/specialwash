import React, { useEffect, useState } from "react";
import { Table, Button, Modal, Form } from "react-bootstrap";

const Empleados = () => {
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [empleadoEditando, setEmpleadoEditando] = useState(null);

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
    try {
      const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/usuarios?rol=empleado`, {
  headers: { Authorization: "Bearer " + sessionStorage.getItem("token") },
});
      if (!resp.ok) throw new Error("Error al obtener empleados");
      const data = await resp.json();
      setEmpleados(data);
    } catch (error) {
      console.error("Error al cargar empleados:", error);
    } finally {
      setCargando(false);
    }
  };

  const handleChange = (e) => {
    setNuevoEmpleado({ ...nuevoEmpleado, [e.target.name]: e.target.value });
  };

  const handleEditar = (empleado) => {
    setEmpleadoEditando(empleado);
    setNuevoEmpleado({
      nombre: empleado.nombre,
      email: empleado.email,
      password: "",
      rol: empleado.rol,
    });
    setModoEdicion(true);
    setShowModal(true);
  };

  const handleGuardarEmpleado = async () => {
    if (!nuevoEmpleado.nombre || !nuevoEmpleado.email || (!modoEdicion && !nuevoEmpleado.password)) {
      alert("Todos los campos son obligatorios");
      return;
    }

    try {
      const metodo = modoEdicion ? "PUT" : "POST";
      const url = modoEdicion
        ? `${process.env.REACT_APP_BACKEND_URL}/api/usuarios/${empleadoEditando.id}`
        : `${process.env.REACT_APP_BACKEND_URL}/api/usuarios`;

      const body = { ...nuevoEmpleado };
      if (modoEdicion && !body.password) delete body.password;

      const resp = await fetch(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + sessionStorage.getItem("token"),
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) throw new Error("Error al guardar el empleado");

      await cargarEmpleados();
      setShowModal(false);
      setNuevoEmpleado({ nombre: "", email: "", password: "", rol: "empleado" });
      setModoEdicion(false);
      setEmpleadoEditando(null);
    } catch (error) {
      console.error("Error al guardar empleado:", error);
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Eliminar este empleado?")) return;

    try {
      const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/usuarios/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + sessionStorage.getItem("token"),
        },
      });

      if (!resp.ok) throw new Error("Error al eliminar empleado");

      await cargarEmpleados();
    } catch (error) {
      console.error("Error al eliminar empleado:", error);
    }
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Gestión de Empleados</h2>

      <Button className="mb-3" onClick={() => setShowModal(true)}>
        + Nuevo Empleado
      </Button>

      {cargando ? (
        <p>Cargando empleados...</p>
      ) : empleados.length === 0 ? (
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
            {empleados.map((emp) => (
              <tr key={emp.id}>
                <td>{emp.nombre}</td>
                <td>{emp.email}</td>
                <td>{emp.rol}</td>
                <td>
                  <Button variant="warning" size="sm" className="me-2" onClick={() => handleEditar(emp)}>
                    ✏️ Editar
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleEliminar(emp.id)}>
                    🗑️ Eliminar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Modal para crear/editar empleado */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{modoEdicion ? "Editar Empleado" : "Nuevo Empleado"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Nombre</Form.Label>
              <Form.Control type="text" name="nombre" value={nuevoEmpleado.nombre} onChange={handleChange} />
            </Form.Group>

            <Form.Group className="mt-2">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" name="email" value={nuevoEmpleado.email} onChange={handleChange} />
            </Form.Group>

            <Form.Group className="mt-2">
              <Form.Label>Contraseña</Form.Label>
              <Form.Control
                type="password"
                name="password"
                value={nuevoEmpleado.password}
                onChange={handleChange}
                placeholder={modoEdicion ? "Dejar en blanco para mantener" : ""}
              />
            </Form.Group>

            <Form.Group className="mt-2">
              <Form.Label>Rol</Form.Label>
              <Form.Select name="rol" value={nuevoEmpleado.rol} onChange={handleChange}>
                <option value="empleado">Empleado</option>
                <option value="pintor">Pintor</option>
                <option value="limpiador">Limpiador</option>
                <option value="almacen">Almacén</option>
                <option value="administrador">Administrador</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleGuardarEmpleado}>
            Guardar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Empleados;
