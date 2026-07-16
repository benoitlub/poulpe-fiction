import React from "react";
import { createRoot } from "react-dom/client";
import { PoulpeFictionApp } from "./PoulpeFictionApp";

const root = document.getElementById("poulpe-fiction-mobile-v2-root");

if (!root) {
  throw new Error("Point de montage Poulpe-Fiction Mobile V2 introuvable.");
}

createRoot(root).render(
  <React.StrictMode>
    <PoulpeFictionApp />
  </React.StrictMode>,
);
