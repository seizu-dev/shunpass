import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Design から受け取ったデザインリファレンス。プロトタイプを開くための
    // ランタイムが同梱されており実装対象外なので、Lint の対象から外す。
    "design_handoff_shunpass_mobile/**",
  ]),
]);

export default eslintConfig;
