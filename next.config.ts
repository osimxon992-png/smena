import type { NextConfig } from 'next';

// libSQL mijozi native modul ishlatadi: bundler'ga qo'shilmaydi, server uni node_modules'dan yuklaydi
const config: NextConfig = {
  serverExternalPackages: ['@libsql/client', 'libsql'],
};

export default config;
