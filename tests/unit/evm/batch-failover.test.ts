import { describe, it, expect, vi, afterEach } from "vitest";
import { requestJsonRpcBatch } from "../../../src/evm/rpc-client";

describe("requestJsonRpcBatch Failover & Ordering Tests", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should return empty array for empty requests", async () => {
    const res = await requestJsonRpcBatch([]);
    expect(res).toEqual([]);
  });

  it("should successfully batch requests and sort results by ID", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { jsonrpc: "2.0", id: 2, result: "0x200" },
        { jsonrpc: "2.0", id: 1, result: "0x100" },
      ],
    } as any);

    const results = await requestJsonRpcBatch([
      { method: "eth_blockNumber", params: [] },
      { method: "eth_gasPrice", params: [] },
    ]);

    expect(results).toEqual(["0x100", "0x200"]);
  });

  it("should failover to next RPC endpoint if first endpoint throws an error", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 504,
        };
      }
      return {
        ok: true,
        json: async () => [{ jsonrpc: "2.0", id: 1, result: "0xabc" }],
      };
    });

    const results = await requestJsonRpcBatch([
      { method: "eth_blockNumber", params: [] },
    ]);

    expect(results).toEqual(["0xabc"]);
    expect(callCount).toBe(2);
  });
});
