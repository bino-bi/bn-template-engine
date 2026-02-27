import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist/",
      "loader/",
      "www/",
      ".stencil/",
      "node_modules/",
      "storybook-static/",
      "scripts/",
      "src/components.d.ts",
      "**/*.bak",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "off",
      "@typescript-eslint/no-namespace": "off",
      "no-prototype-builtins": "off",
      "no-useless-catch": "off",
      "no-constant-binary-expression": "warn",
      eqeqeq: ["warn", "smart"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "warn",
      "no-var": "warn",
    },
  },
  {
    files: ["**/*.spec.ts", "**/*.spec.tsx", "src/test-runner/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-useless-escape": "off",
    },
  },
);
