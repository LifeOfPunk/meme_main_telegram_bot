import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-undef': 'error',
      'no-constant-condition': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    ignores: [
      'node_modules/',
      'logs/',
      'tmp/',
      'temp/',
      'media/',
      '**/*.bak*',
      '**/*.save',
    ],
  },
];
