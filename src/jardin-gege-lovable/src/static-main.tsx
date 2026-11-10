import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Jardin } from "./routes/index";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Jardin root element missing");
createRoot(root).render(<StrictMode><Jardin /></StrictMode>);
