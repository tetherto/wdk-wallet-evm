import { fixupConfigRules } from '@eslint/compat'
import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import jsdoc from 'eslint-plugin-jsdoc'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended
})

export default [
  // Global Standard configuration with compatibility fixes
  ...fixupConfigRules(compat.extends('standard')),

  // Source files: Strict rules with JSDoc requirements
  {
    files: ['src/**/*.js', 'index.js'],
    plugins: {
      jsdoc
    },
    rules: {
      // JSDoc requirements for source code
      'jsdoc/require-jsdoc': [
        'warn',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false
          }
        }
      ],
      'jsdoc/require-param': 'warn',
      'jsdoc/require-returns': 'warn'
    }
  },

  // Test files: Very relaxed rules to accommodate existing formatting - TODO : Define test rules and adapt accordingly
  {
    files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module'
    },
    rules: {
      // Disable JSDoc requirements for tests
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',

      // Disable formatting rules for test files
      indent: 'off',
      quotes: 'off',
      semi: 'off',
      'one-var': 'off',
      'max-len': 'off',
      'no-trailing-spaces': 'off',
      'padded-blocks': 'off',
      'no-multiple-empty-lines': 'off',
      'eol-last': 'off',

      // Keep basic safety rules but relax others - 
      'no-unused-expressions': 'off', // For assertion libraries
      'no-console': 'off', // Allow console.log in tests for debugging
      'no-unused-vars': 'warn', // Keep as warning instead of error

      // Disable import rules that might conflict
      'import/no-unresolved': 'off',
      'import/extensions': 'off',
      'import/no-absolute-path': 'off'
    }
  }
]
