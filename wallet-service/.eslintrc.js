module.exports = {
    parser: '@typescript-eslint/parser',
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    plugins: ['@typescript-eslint'],
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
    },
    env: {
        node: true,
        es2022: true,
        jest: true,
    },
    rules: {
        '@typescript-eslint/explicit-function-return-type': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'error',
        'no-console': ['warn', { allow: ['error', 'warn'] }],
        'prefer-const': 'error',
        'no-var': 'error',
    },
    ignorePatterns: ['dist/', 'node_modules/', '*.js'],
};
