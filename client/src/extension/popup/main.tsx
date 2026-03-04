import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import PopupApp from "./PopupApp";
import "../../index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <PopupApp />
  </ThemeProvider>
);
