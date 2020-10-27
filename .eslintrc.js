module.exports = {
  'parser': 'babel-eslint',
  'env': {
    'es2021': true,
    'node': true,
  },
  'globals': {
    'config': 'readonly',
    'rootDir': 'readonly',
    'mrequire': 'readonly',
    'emitSync': 'readonly',
    'emitDumpDB': 'readonly',
    'emitRecoveryDB': 'readonly',
    'Atomics': 'readonly',
    'SharedArrayBuffer': 'readonly',
    'tracking': 'readonly',
  },
  'parserOptions': {
    'ecmaVersion': 12,
    'ecmaFeatures': {
      'impliedStrict': true,
    },
  },
  'extends': ['eslint:recommended'],
  'rules': {
    'no-unused-vars': 'warn',
    'no-control-regex': 'off',
    'no-useless-escape': 'error',
    'valid-jsdoc': 'off',
    'indent': ['warn', 2, {'SwitchCase': 1}],
    'comma-spacing': 'warn',
    'no-multi-spaces': 'warn',
    'func-call-spacing': 'warn',
    'space-before-function-paren': 'off',
  },
};
