import nextJest from "next/jest.js";
import type { Config } from "jest";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  displayName: "web",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@outfit/shared$": "<rootDir>/../../packages/shared/src/index.ts",
    // npm hoists Testing Library (and one React) to the monorepo root while this app keeps
    // its own React. Tests must run on a single React instance: use the hoisted copy.
    "^react$": "<rootDir>/../../node_modules/react",
    "^react/(.*)$": "<rootDir>/../../node_modules/react/$1",
    "^react-dom$": "<rootDir>/../../node_modules/react-dom",
    "^react-dom/(.*)$": "<rootDir>/../../node_modules/react-dom/$1",
  },
  testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}"],
};

export default createJestConfig(config);
