import ts from "typescript-eslint";
export default ts.config(
  {
    ignores: [
      "dist/**",
      "**/.next/**",
      "**/node_modules/**",
      ".flow/**",
      "**/next-env.d.ts",
    ],
  },
  ...ts.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);
