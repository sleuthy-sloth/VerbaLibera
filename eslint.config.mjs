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
    ".worktrees/**",
    "out/**",
    "public/study.js",
    "test-results/**",
    "playwright-report/**",
    "build/**",
    "next-env.d.ts",
    "services/voice/.venv/**",
    "services/voice/.pilot-venv/**",
    // Generated desktop/packaging output (vendored third-party code).
    ".desktop-stage/**",
    "desktop-dist/**",
    "dist/**",
  ]),
  {
    // eslint-config-next ships only six jsx-a11y rules, all as warnings, so
    // nothing in the accessibility layer ever failed a lint run. These are the
    // rules that catch the defects this codebase actually shipped: `aria-label`
    // on a role-less div, interactive elements without keyboard handlers, and
    // anchors pointing at nothing.
    files: ["src/**/*.tsx"],
    rules: {
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/label-has-associated-control": [
        "error",
        { assert: "either", depth: 3 },
      ],
      "jsx-a11y/no-autofocus": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "error",
      "jsx-a11y/no-redundant-roles": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/tabindex-no-positive": "error",
    },
  },
  {
    // Offline/portable entry points are plain-HTML bundles outside Next's
    // router, so they legitimately use bare <a href> for internal paths.
    files: [
      "src/features/course-pack/CourseWorkspace.tsx",
      "src/features/course-pack/RuntimeCourseWorkspace.tsx",
      "src/features/course-pack/portable-entry.tsx",
      "src/features/course-pack/offline-entry.tsx",
    ],
    rules: {
      "jsx-a11y/anchor-is-valid": "off",
    },
  },
]);

export default eslintConfig;
