import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Requests to /api are forwarded to the backend. xfwd passes the visitor's IP along
    // (the backend only ever stores IPs for admin audit logs).
    proxy: { "/api": { target: "http://127.0.0.1:5000", xfwd: true } },
  },
});
