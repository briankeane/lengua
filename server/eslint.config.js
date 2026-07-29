const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
module.exports = tseslint.config({
  files: ['**/*.ts'],
  extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
  rules: {
    '@typescript-eslint/no-unused-vars': 'warn',
  },
});
