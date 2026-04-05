import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "*.config.ts",
      "*.config.js",
      "*.config.mjs",
    ],
  },
  {
    rules: {
      // SECURITY: Prevent console.log in production code
      // Allowed in: logger implementations, scripts, test files
      "no-console": ["error", {
        allow: ["warn", "error", "info"]
      }],

      // SECURITY: Prevent debugger statements
      "no-debugger": "error",

      // SECURITY: Prevent alert, confirm, prompt
      "no-alert": "error",

      // SECURITY: Prevent eval() usage
      "no-eval": "error",
      "no-implied-eval": "error",

      // TypeScript: Relax some rules for flexibility
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",

      // TypeScript: Type imports - make it warning not error
      "@typescript-eslint/consistent-type-imports": "off",

      // Best practices
      "no-var": "error",
      "prefer-const": "warn",
      "prefer-arrow-callback": "warn",
    }
  },
  {
    // Allow console in logger files and scripts
    files: [
      "**/logger.ts",
      "**/client-logger.ts", 
      "**/secure-logger.ts",
      "scripts/**/*.ts",
      "scripts/**/*.js",
      "**/*.test.ts",
      "**/*.spec.ts"
    ],
    rules: {
      "no-console": "off"
    }
  }
];

export default eslintConfig;
