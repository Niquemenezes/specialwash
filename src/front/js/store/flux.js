const getState = ({ getStore, getActions, setStore }) => {
  return {
    store: {
      token: sessionStorage.getItem("token") || null,
      rol: sessionStorage.getItem("rol") || null,
      user: JSON.parse(sessionStorage.getItem("user") || "null"),
      adminExists: { exists: false, total: 0 },
      productos: [],
      proveedores: [],
      usuarios: [],
      empleados: [],
      entradas: [],
      entradasProductos: [],
      salidasproductos: [],
      productosConStock: [],
    },

    actions: {
      // --- AUTENTICACIÓN ---
      login: async ({ email, password, rol }) => {
        try {
          const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, rol }),
          });
          if (!resp.ok) throw new Error(await resp.text());
          const data = await resp.json();
          const rolLower = data.rol.toLowerCase();

          sessionStorage.setItem("token", data.access_token);
          sessionStorage.setItem("rol", rolLower);
          sessionStorage.setItem("user", JSON.stringify(data.user));
          setStore({ token: data.access_token, rol: rolLower, user: data.user });
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
          const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin-exists`);
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
          const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/usuarios`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(formData),
          });
          if (!resp.ok) throw new Error((await resp.json()).msg);
          return true;
        } catch (error) {
          console.error("Error al registrar admin:", error);
          return false;
        }
      },

      // --- USUARIOS / EMPLEADOS ---
      getUsuariosPorRol: async (rol, storeKey = "usuarios") => {
        try {
          const token = sessionStorage.getItem("token");
          const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/usuarios?rol=${rol}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            }
          });

          if (!resp.ok) throw new Error("Error al obtener usuarios por rol");

          const data = await resp.json();
          setStore({ [storeKey]: data });
        } catch (error) {
          console.error("Error cargando usuarios:", error);
        }
      },

      getTodosLosUsuarios: async () => {
        try {
          const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/usuarios-todos`, {
            headers: {
              Authorization: "Bearer " + sessionStorage.getItem("token"),
            },
          });
          if (!resp.ok) throw new Error("Error al obtener todos los usuarios");
          const data = await resp.json();
          setStore({ empleados: data });
        } catch (error) {
          console.error("Error en getTodosLosUsuarios:", error);
        }
      },

      getEmpleados: async () => {
        try {
          const token = sessionStorage.getItem("token");
          const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/usuarios?rol=empleado`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token
            }
          });
          if (!resp.ok) throw new Error("Error al obtener empleados");

          const data = await resp.json();
          setStore({ empleados: data });
        } catch (error) {
          console.error("Error en getEmpleados:", error);
        }
      },

      crearEmpleado: async (datos) => {
        try {
          const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/usuarios`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + sessionStorage.getItem("token"),
            },
            body: JSON.stringify(datos),
          });

          if (!resp.ok) {
            const errorData = await resp.json();
            alert(errorData.msg || "Error al crear empleado");
            return false;
          }

          return true;
        } catch (error) {
          console.error("Error en crearEmpleado:", error);
          return false;
        }
      },

      editarEmpleado: async (id, datos) => {
        try {
          const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/usuarios/${id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + sessionStorage.getItem("token"),
            },
            body: JSON.stringify(datos),
          });
          return resp.ok;
        } catch (error) {
          console.error("Error al editar empleado:", error);
          return false;
        }
      },

      eliminarEmpleado: async (id) => {
        try {
          const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/usuarios/${id}`, {
            method: "DELETE",
            headers: { Authorization: "Bearer " + sessionStorage.getItem("token") },
          });
          return resp.ok;
        } catch (error) {
          console.error("Error al eliminar empleado:", error);
          return false;
        }
      },

      // --- PRODUCTOS ---
      getProductos: async () => {
        try {
          const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/productos`, {
            headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
          });
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          setStore({ productos: data });
        } catch (err) {
          console.error("Error en getProductos:", err);
          getActions().handleAuthError(err);
        }
      },

      crearProducto: async (nuevoProducto) => {
        try {
          const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/productos`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + sessionStorage.getItem("token"),
            },
            body: JSON.stringify(nuevoProducto),
          });

          if (!resp.ok) {
            const error = await resp.json();
            console.error("Error del servidor:", error);
            return false;
          }

          return true;
        } catch (err) {
          console.error("Error al crear producto:", err);
          return false;
        }
      },

      // --- ENTRADAS ---
      registrarEntradaProducto: async (datos) => {
        try {
          const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/registro-entrada`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + sessionStorage.getItem("token"),
            },
            body: JSON.stringify(datos),
          });

          if (!resp.ok) {
            const error = await resp.json();
            console.error("❌ Error al registrar entrada:", error);
            return false;
          }

          const data = await resp.json();
          await getActions().getProductosConStock();
          await getActions().getEntradasProductos();

          return true;
        } catch (err) {
          console.error("Error del servidor:", err);
          return false;
        }
      },

      getEntradasProductos: async () => {
        try {
          const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/registro-entrada`, {
            headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.msg);
          setStore({ entradasProductos: data });
        } catch (err) {
          console.error("Error al obtener las entradas:", err);
        }
      },

      // --- SALIDAS ---
      registrarSalidaProducto: async (data) => {
        const token = sessionStorage.getItem("token");
        const user = JSON.parse(sessionStorage.getItem("user") || "null");
        const payload = { ...data, responsable: user?.nombre };
        try {
          const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/registro-salida`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify(payload),
          });

          if (!resp.ok) throw new Error("Error al registrar salida");
          const result = await resp.json();
          alert(result.msg);
          await getActions().getProductos();
          await getActions().getSalidasProductos();
          return true;
        } catch (err) {
          console.error("❌ Error registrar salida:", err);
          alert("Error al registrar salida");
          return false;
        }
      },

      getSalidasProductos: async () => {
        try {
          const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/salidas`, {
            method: "GET",
            headers: {
              Authorization: "Bearer " + sessionStorage.getItem("token")
            }
          });
          if (!resp.ok) throw new Error("Error al obtener salidas");
          const data = await resp.json();
          setStore({ salidasproductos: data });
        } catch (error) {
          console.error(error);
        }
      },

      obtenerHistorialSalidas: async (desde, hasta) => {
        const token = sessionStorage.getItem("token");
        let url = `${process.env.REACT_APP_BACKEND_URL}/api/salidas`;

        if (desde && hasta) {
          url += `?desde=${desde}&hasta=${hasta}`;
        }

        try {
          const resp = await fetch(url, {
            headers: {
              Authorization: "Bearer " + token
            }
          });

          if (!resp.ok) throw new Error("Error al obtener historial de salidas");

          const data = await resp.json();
          setStore({ salidasproductos: data });
        } catch (error) {
          console.error("Error en obtenerHistorialSalidas:", error);
        }
      },

      // --- PROVEEDORES ---
      getProveedores: async () => {
        try {
          const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/proveedores`, {
            headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
          });
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
          const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/proveedores`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionStorage.getItem("token")}`,
            },
            body: JSON.stringify(datos),
          });
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
