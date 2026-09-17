import { describe, it, expect } from "vitest";
import { cn } from "@/utils/cn";
import {
  EVMEventLake,
} from "@evm-event-lake/node-sdk";
import {
  createEvmCallClient,
  MULTICALL3_ADDRESS,
} from "@evm-event-lake/node-sdk/evm-call";

describe("Scaffold and Foundation Verification", () => {
  it("should correctly merge class names using cn utility", () => {
    expect(cn("px-2 py-1", "bg-white", { "text-black": true })).toBe(
      "px-2 py-1 bg-white text-black",
    );
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it("should successfully export EVMEventLake class and evm-call utilities", () => {
    expect(typeof EVMEventLake.create).toBe("function");
    expect(typeof createEvmCallClient).toBe("function");
    expect(MULTICALL3_ADDRESS.toLowerCase()).toBe(
      "0xca11bde05977b3631167028862be2a173976ca11",
    );
  });
});
