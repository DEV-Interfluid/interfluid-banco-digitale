import type { NextConfig } from "next";

// Intestazioni di sicurezza su tutte le pagine: niente incorniciamento in altri siti,
// niente invio dell'indirizzo completo ad altri domini, solo HTTPS.
const sicurezza = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: sicurezza }];
  },
};

export default nextConfig;
