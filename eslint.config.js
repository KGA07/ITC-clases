'use strict';
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'public/html/interactivos/**',
      'coverage/**',
      'db.json',
      'scripts/**',
      'data/materiales.json',
      'data/temarios.json'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.browser }
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'off'
    }
  },
  {
    // common.js es un modulo compartido por varias paginas via <script>: sus
    // funciones se usan "globalmente" en los otros archivos del frontend.
    files: ['public/js/common.js'],
    rules: { 'no-unused-vars': 'off' }
  }
];