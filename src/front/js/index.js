// Import React into the bundle
import React from "react";
import ReactDOM from "react-dom";

// ✅ Import Bootstrap CSS primero
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "@fortawesome/fontawesome-free/css/all.min.css";


// Include your styles
import "../styles/index.css";

// Import your own components
import Layout from "./layout";

// Render your React application
ReactDOM.render(<Layout />, document.querySelector("#app"));

