import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'tmp', 'artifacts', '.chrome-*', '.firebase', '.git-broken', 'backups']),
  {
    files: ['**/*.test.js', 'vite.config.js', 'scripts/**/*.{js,mjs}', 'functions/**/*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/features/bankingImport/parsers/pdfParser.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        __APP_VERSION__: 'readonly',
        __BUILD_DATE__: 'readonly',
        __APP_ENV__: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
