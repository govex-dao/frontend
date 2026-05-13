import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import importPlugin from 'eslint-plugin-import'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
      eslintConfigPrettier,
    ],
    plugins: {
      react,
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    settings: {
      'import/resolver': {
        typescript: true,
        node: true,
      },
      react: {
        version: 'detect',
      },
    },
    rules: {
      // Component size limits
      'max-lines': [
        'error',
        {
          max: 500,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'max-lines-per-function': [
        'warn',
        {
          max: 200,
          skipBlankLines: true,
          skipComments: true,
        },
      ],

      // No default exports for components (in src/components)
      'import/no-default-export': 'off', // Will be enabled per-directory below

      // Props should preferably be interfaces, not types
      '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],

      // Destructure props
      'react/destructuring-assignment': ['error', 'always'],

      // Import ordering - simplified and less strict
      'import/order': [
        'warn',
        {
          groups: [
            ['builtin', 'external'], // React and external packages together
            'internal', // Internal/project imports
            ['parent', 'sibling', 'index'],
          ],
        },
      ],

      // Disable react-refresh only-export-components rule
      'react-refresh/only-export-components': 'off',

      // No console.log allowed, but warn and error are ok
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // No default exports in components directory
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'import/no-default-export': 'error',
    },
  },
])
