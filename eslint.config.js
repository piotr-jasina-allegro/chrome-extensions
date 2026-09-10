import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
    { ignores: ['dist/**', 'node_modules/**'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    eslintConfigPrettier,
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            globals: {
                chrome: 'readonly',
                document: 'readonly',
                window: 'readonly',
                console: 'readonly',
            },
        },
    },
    {
        files: ['*.config.js', '*.config.ts'],
        languageOptions: {
            globals: {
                module: 'readonly',
                require: 'readonly',
            },
        },
    },
);
