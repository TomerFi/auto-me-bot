import globals from "globals"
import js from "@eslint/js"
import mocha from 'eslint-plugin-mocha'

export default [
    {
        name: "default",
        files: ["**/*.js"],
        languageOptions: {
            sourceType: "module",
            globals: {
                ...globals.nodeBuiltin,
                ...globals.mocha,
            }
        },
        rules: {
            ...js.configs.recommended.rules,
            ...mocha.configs.flat.recommended.rules,
            "mocha/no-mocha-arrows": ["off"],
            "mocha/no-setup-in-describe": ["off"]
        },
        plugins: {
            ...mocha.configs.flat.recommended.plugins
        }
    },
]
