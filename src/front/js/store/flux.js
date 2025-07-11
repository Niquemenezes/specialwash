const getState = ({ getStore, getActions, setStore }) => {
  return {
    store: {
      token: sessionStorage.getItem("token") || null,
      rol: sessionStorage.getItem("rol") || null,
      user: JSON.parse(sessionStorage.getItem("user") || "null"),
      adminExists: { exists: false, total: 0 },
      productos: [],
      proveedores: [],
      entradasProductos: [],
      salidas_productos: [],
      historial_salidas: [],
      empleados: [],
      productosConStock: [],
    },

    actions: {
      login: async ({ email, password, rol }) => {
        try {
          const resp = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/login`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password, rol }),
            }
          );

          if (!resp.ok) throw new Error(await resp.text());

          const data = await resp.json();
          const rolLower = data.rol.toLowerCase();
          sessionStorage.setItem("token", data.access_token);
          sessionStorage.setItem("rol", rolLower);
          sessionStorage.setItem("user", JSON.stringify(data.user));
          setStore({
            token: data.access_token,
            rol: rolLower,
            user: data.user,
          });
          return true;
        } catch (err) {
          console.error("Error en login:", err);
          return false;
        }
      },

      logout: () => {
        sessionStorage.clear();
        setStore({ token: null, rol: null, user: null });
      },

      handleAuthError: (error) => {
        if (error.message.includes("401") || error.message.includes("token")) {
          alert("Sesión expirada, por favor vuelve a iniciar sesión.");
          sessionStorage.clear();
          setStore({ token: null, rol: null, user: null });
          window.location.href = "/";
        }
      },

      checkAdminExists: async () => {
        try {
          const resp = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/admin-exists`
          );
          if (!resp.ok) throw new Error(await resp.text());
          const data = await resp.json();
          setStore({ adminExists: data });
          return data.exists;
        } catch (err) {
          console.error("Error al verificar admin:", err);
          return false;
        }
      },

      signupAdmin: async (formData) => {
        try {
          const token = sessionStorage.getItem("token");

          const resp = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/usuarios`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}), // 👈 agrega token si hay
              },
              body: JSON.stringify(formData),
            }
          );

          if (!resp.ok) throw new Error((await resp.json()).msg);
          return true;
        } catch (error) {
          console.error("Error al registrar admin:", error);
          return false;
        }
      },

      obtenerFuncionarios: async () => {
        try {
          const token = sessionStorage.getItem("token");
          const res = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/usuarios?rol=funcionario`,
            {
              headers: {
                Authorization: "Bearer " + token,
              },
            }
          );
          if (!res.ok) throw new Error("Error al obtener funcionarios");
          const data = await res.json();
          setStore({ empleados: data });
          return data;
        } catch (err) {
          console.error("Error en obtenerFuncionarios:", err);
          return [];
        }
      },
      getEmpleados: async () => {
        try {
          const resp = await fetch(process.env.REACT_APP_BACKEND_URL + "/api/empleados");
          const data = await resp.json();
          if (resp.ok) {
            setStore({ empleados: data });
            return true;
          } else {
            console.error("Error al obtener empleados");
            return false;
          }
        } catch (error) {
          console.error("Error en getEmpleados:", error);
          return false;
        }
      },

      getUsuariosPorRol: async (rol = "empleado") => {
        try {
          const token = sessionStorage.getItem("token");
          const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/usuarios?rol=${rol}`, {
            headers: {
              Authorization: "Bearer " + token,
            },
          });
          const data = await resp.json();
          if (resp.ok) {
            setStore({ empleados: data }); // Puedes usar otro nombre como `usuarios_filtrados`
            return true;
          } else {
            console.error("Error al obtener usuarios por rol:", data);
            return false;
          }
        } catch (error) {
          console.error("Error en getUsuariosPorRol:", error);
          return false;
        }
      },


      crearFuncionario: async (datos) => {
        try {
          const token = sessionStorage.getItem("token");
          const res = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/usuarios`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(datos),
            }
          );
          if (!res.ok) throw new Error(await res.text());
          return true;
        } catch (err) {
          console.error("Error en crearFuncionario:", err);
          return false;
        }
      },

      editarFuncionario: async (id, datos) => {
        try {
          const token = sessionStorage.getItem("token");
          const res = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/usuarios/${id}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
              },
              body: JSON.stringify(datos),
            }
          );
          if (!res.ok) throw new Error("Error al editar funcionario");
          return true;
        } catch (err) {
          console.error("Error en editarFuncionario:", err);
          return false;
        }
      },

      eliminarFuncionario: async (id) => {
        try {
          const token = sessionStorage.getItem("token");
          const res = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/usuarios/${id}`,
            {
              method: "DELETE",
              headers: {
                Authorization: "Bearer " + token,
              },
            }
          );
          if (!res.ok) throw new Error("Error al eliminar funcionario");
          return true;
        } catch (err) {
          console.error("Error en eliminarFuncionario:", err);
          return false;
        }
      },

      getProductos: async () => {
        try {
          const res = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/productos`,
            {
              headers: {
                Authorization: `Bearer ${sessionStorage.getItem("token")}`,
              },
            }
          );
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          setStore({ productos: data });
        } catch (err) {
          console.error("Error en getProductos:", err);
          getActions().handleAuthError(err);
        }
      },

      crearProducto: async (datos) => {
        try {
          const res = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/productos`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionStorage.getItem("token")}`,
              },
              body: JSON.stringify(datos),
            }
          );
          if (!res.ok) throw new Error("Error al crear producto");
          alert("Producto creado correctamente");
          getActions().getProductos();
        } catch (err) {
          console.error("Error al crear producto:", err);
        }
      },
      editarProducto: async (id, datos) => {
        try {
          const res = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/productos/${id}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionStorage.getItem("token")}`,
              },
              body: JSON.stringify(datos),
            }
          );
          if (!res.ok) throw new Error(await res.text());
          alert("Producto actualizado correctamente");
          getActions().getProductos();
          return true;
        } catch (err) {
          console.error("Error al editar producto:", err);
          return false;
        }
      },

      eliminarProducto: async (id) => {
        try {
          const res = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/productos/${id}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${sessionStorage.getItem("token")}`,
              },
            }
          );
          if (!res.ok) throw new Error(await res.text());
          getActions().getProductos();
          return true;
        } catch (err) {
          console.error("Error al eliminar producto:", err);
          return false;
        }
      },

      getEntradasProductos: async () => {
        try {
          const res = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/registro-entrada`,
            {
              headers: {
                Authorization: `Bearer ${sessionStorage.getItem("token")}`,
              },
            }
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.msg);
          setStore({ entradasProductos: data });
        } catch (err) {
          console.error("Error al obtener las entradas:", err);
        }
      },

      registrarEntradaProducto: async (datos) => {
        try {
          const resp = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/registro-entrada`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionStorage.getItem("token")}`,
              },
              body: JSON.stringify(datos),
            }
          );

          if (!resp.ok) {
            const error = await resp.json();
            console.error("❌ Error al registrar entrada:", error); // muestra todo el objeto
            return false;
          }

          const data = await resp.json();

          // 🔄 Refrescar stock después de registrar
          await getActions().getProductosConStock();
          await getActions().getEntradasProductos();

          return true; // ✅ éxito
        } catch (err) {
          console.error("Error del servidor:", err);
          return false;
        }
      },

      getProductosConStock: async () => {
        try {
          const resp = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/productos-con-stock`,
            {
              headers: {
                Authorization: `Bearer ${sessionStorage.getItem("token")}`,
              },
            }
          );

          if (resp.ok) {
            const data = await resp.json();
            setStore({ productosConStock: data }); // 👈 Esto actualiza correctamente el store
          } else {
            console.error("❌ Error al obtener productos con stock");
          }
        } catch (error) {
          console.error("❌ Error en getProductosConStock", error);
        }
      },

      getProductosBajoStock: async () => {
        try {
          const resp = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/productos/bajo-stock`,
            {
              headers: {
                Authorization: `Bearer ${sessionStorage.getItem("token")}`,
              },
            }
          );
          if (!resp.ok)
            throw new Error("Error al obtener productos bajo stock");

          const data = await resp.json();
          setStore({ productos: data });
        } catch (error) {
          console.error("Error en getProductosBajoStock (backend):", error);
        }
      },

      registrarSalidaProducto: async (data) => {
        const token = sessionStorage.getItem("token");
        const user = JSON.parse(sessionStorage.getItem("user") || "null");
        const payload = { ...data, responsable: user?.nombre };
        try {
          const resp = await fetch(
             `${process.env.REACT_APP_BACKEND_URL}/api/registro-salida`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
              },
              body: JSON.stringify(payload),
            }
          );

          if (!resp.ok) throw new Error("Error al registrar salida");
          const result = await resp.json();
          alert(result.msg);
          getActions().getProductos(); // Actualiza stock
          return true;
        } catch (err) {
          console.error("❌ Error registrar salida:", err);
          alert("Error al registrar salida");
          return false;
        }
      },

      getHistorialSalidas: async () => {
        const token = sessionStorage.getItem("token");
        try {
          const resp = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/registro-salida`,
            {
              headers: {
                Authorization: "Bearer " + token,
              },
            }
          );
          if (!resp.ok) throw new Error("Error al obtener historial");
          const data = await resp.json();
          setStore({ historial_salidas: data });
        } catch (err) {
          console.error("❌ Error historial salidas:", err);
        }
      },

    getSalidasProductos: async () => {
  try {
    const resp = await fetch(process.env.REACT_APP_BACKEND_URL + "/api/salidas");
    const data = await resp.json();

    if (Array.isArray(data)) {
      setStore({ salidas_productos: data });
    } else {
      console.warn("Respuesta inesperada en salidas:", data);
      setStore({ salidas_productos: [] });
    }
  } catch (error) {
    console.error("Error al obtener salidas:", error);
    setStore({ salidas_productos: [] });
  }
},


      getProveedores: async () => {
        try {
          const res = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/proveedores`,
            {
              headers: {
                Authorization: `Bearer ${sessionStorage.getItem("token")}`,
              },
            }
          );
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          setStore({ proveedores: data });
        } catch (err) {
          console.error("Error al obtener proveedores:", err);
          getActions().handleAuthError(err);
        }
      },

      crearProveedor: async (datos) => {
        try {
          const res = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/proveedores`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionStorage.getItem("token")}`,
              },
              body: JSON.stringify(datos),
            }
          );
          if (!res.ok) throw new Error("Error al crear proveedor");
          alert("Proveedor creado correctamente");
          getActions().getProveedores();
        } catch (err) {
          console.error("Error al crear proveedor:", err);
        }
      },
    },
  };
};

export default getState;
