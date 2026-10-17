import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin usa módulos nativos do Node; não deve ser empacotado.
  serverExternalPackages: ["firebase-admin"],
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    // Defaults mínimos na aplicação. Headers de borda (HSTS, CSP completa)
    // ficam no Cloudflare, sob responsabilidade do Tom Brown.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
