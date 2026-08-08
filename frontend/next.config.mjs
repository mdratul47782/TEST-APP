import path from 'path';
import { fileURLToPath } from 'url';

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Monorepo-style layout (server/ + frontend/ side by side) with its own
  // lockfile: tell Next where the tracing root really is.
  outputFileTracingRoot: path.join(frontendRoot, '..'),
};

export default nextConfig;
