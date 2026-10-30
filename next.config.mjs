/** @type {import('next').NextConfig} */
const nextConfig = process.env.EMPACOTANDO
  ? {
      // o instalador leva so o servidor pronto, sem o node_modules inteiro
      output: "standalone",
      outputFileTracingRoot: process.cwd(),
      outputFileTracingIncludes: {
        "/**": ["./node_modules/better-sqlite3/prebuilds/win32-x64.node"],
      },
    }
  : {};
export default nextConfig;
