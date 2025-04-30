import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// ① Import your supabase client
import { supabase } from "./supabase";

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    {/* ② Pass it down via props */}
    <App supabase={supabase} />
  </StrictMode>
);
