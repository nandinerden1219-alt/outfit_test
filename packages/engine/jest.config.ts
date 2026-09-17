import type { Config } from "jest";

const config: Config = {
  displayName: "engine",
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: { "^@outfit/shared$": "<rootDir>/../shared/src/index.ts" },
  transform: { "^.+\.tsx?$": ["ts-jest", { useESM: true, tsconfig: "<rootDir>/tsconfig.json" }] },
  testMatch: ["<rootDir>/test/**/*.test.ts"],
};

export default config;
