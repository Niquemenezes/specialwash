import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const useAuthRedirect = (requiredRole = null) => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    const rol = sessionStorage.getItem("rol");

    if (!token) {
      alert("Tu sesión ha caducado. Por favor inicia sesión nuevamente.");
      navigate("/");
      return;
    }

    if (requiredRole && rol !== requiredRole) {
      alert("No tienes permiso para acceder a esta sección.");
      navigate("/");
    }
  }, []);
};

export default useAuthRedirect;
