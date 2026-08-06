import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Code Deno des Edge Functions : globales, imports par adresse web et
    // runtime différents de ceux du navigateur. Il est versionné ici mais
    // n'appartient pas à la compilation du site.
    'supabase/**',
  ]),
])
