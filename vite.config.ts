import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/workshop-lockpicker/", // replace with the repo name
  assetsInclude: ["**/*.gltf"],
});
