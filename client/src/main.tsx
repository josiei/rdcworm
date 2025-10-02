import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  // Remove StrictMode to avoid double-mount + double WebSocket in dev
  <App />
);
