import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { installMatchMedia, setMediaMatches } from "./media";

if (typeof window !== "undefined") installMatchMedia();

afterEach(() => {
  cleanup();
  setMediaMatches(false);
});
