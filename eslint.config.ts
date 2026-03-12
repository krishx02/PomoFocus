import nxPlugin from "@nx/eslint-plugin";
import tseslint from "typescript-eslint";

export default [
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: { "@nx": nxPlugin },
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            { sourceTag: "type:types", onlyDependOnLibsWithTags: [] },
            {
              sourceTag: "type:domain",
              onlyDependOnLibsWithTags: ["type:domain", "type:types"],
            },
            {
              sourceTag: "type:infra",
              onlyDependOnLibsWithTags: ["type:domain", "type:types"],
            },
            { sourceTag: "type:ble", onlyDependOnLibsWithTags: ["type:types"] },
            {
              sourceTag: "type:state",
              onlyDependOnLibsWithTags: [
                "type:domain",
                "type:infra",
                "type:types",
              ],
            },
            { sourceTag: "type:ui", onlyDependOnLibsWithTags: ["type:types"] },
            {
              sourceTag: "type:app",
              onlyDependOnLibsWithTags: [
                "type:state",
                "type:domain",
                "type:infra",
                "type:ble",
                "type:ui",
                "type:types",
              ],
            },
            {
              sourceTag: "scope:web",
              onlyDependOnLibsWithTags: ["scope:shared"],
            },
            {
              sourceTag: "scope:mobile",
              onlyDependOnLibsWithTags: ["scope:shared"],
            },
            {
              sourceTag: "scope:vscode",
              onlyDependOnLibsWithTags: ["scope:shared"],
            },
            {
              sourceTag: "scope:mcp",
              onlyDependOnLibsWithTags: ["scope:shared"],
            },
            {
              sourceTag: "scope:api",
              onlyDependOnLibsWithTags: ["scope:shared"],
            },
          ],
        },
      ],
    },
  },
];
