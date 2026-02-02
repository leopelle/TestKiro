module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
  ],
  rules: {
    // Basic TypeScript rules
    '@typescript-eslint/no-unused-vars': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
  },
  env: {
    node: true,
    jest: true,
    browser: true, // Add browser environment for DOM types
  },
  globals: {
    // Add Web Crypto API globals
    crypto: 'readonly',
    BufferSource: 'readonly',
    CryptoKey: 'readonly',
  },
};