import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 5173 is the origin constroman-api allows in CORS and the S3 bucket's CORS rules.
export default defineConfig({ plugins: [react()], server: { port: 5173, strictPort: true } });
