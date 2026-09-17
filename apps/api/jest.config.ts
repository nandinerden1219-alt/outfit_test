import type { Config } from "jest";

const config: Config = {
  displayName: "api",
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^@outfit/shared$": "<rootDir>/../../packages/shared/src/index.ts",
    "^@outfit/engine$": "<rootDir>/../../packages/engine/src/index.ts",
  },
  transform: { "^.+\.tsx?$": ["ts-jest", { useESM: true, tsconfig: "<rootDir>/tsconfig.json" }] },
  testMatch: ["<rootDir>/test/**/*.test.ts"],
};

export default config;
