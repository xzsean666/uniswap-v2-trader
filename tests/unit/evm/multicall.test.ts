import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { encodeFunctionResult, encodeFunctionData } from "viem";
import {
  CONTRACT_ADDRESSES,
  PANCAKE_FACTORY_ABI,
  PANCAKE_PAIR_ABI,
  ERC20_ABI,
  BSC_TESTNET_RPCS,
} from "../../../src/constants/contracts";
import { multicallRead } from "../../../src/evm/multicall";
import { encodeAggregate3 } from "@evm-event-lake/node-sdk/evm-call";

describe("EVM Multicall3 & RPC Client (TASK-004)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("exports correct BSC Testnet contract addresses and RPC endpoints", () => {
    expect(CONTRACT_ADDRESSES.MULTICALL3).toBe(
      "0xca11bde05977b3631167028862be2a173976ca11"
    );
    expect(CONTRACT_ADDRESSES.PANCAKE_FACTORY).toBe(
      "0x6725F303b657a9451d8BA641348b6761A6CC7a17"
    );
    expect(CONTRACT_ADDRESSES.PANCAKE_ROUTER).toBe(
      "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"
    );
    expect(CONTRACT_ADDRESSES.WBNB).toBe(
      "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd"
    );
    expect(BSC_TESTNET_RPCS).toContain("https://bsc-testnet-rpc.publicnode.com");
    expect(BSC_TESTNET_RPCS).toContain("https://bsc-testnet.drpc.org");
  });

  it("encodes aggregate3 calls using evm-call", () => {
    const encoded = encodeAggregate3([
      {
        target: CONTRACT_ADDRESSES.PANCAKE_FACTORY,
        allowFailure: true,
        callData: encodeFunctionData({
          abi: PANCAKE_FACTORY_ABI,
          functionName: "allPairsLength",
        }),
      },
    ]);

    expect(encoded.startsWith("0x82ad56cb")).toBe(true); // aggregate3 selector
  });

  it("executes multicallRead and decodes multiple return types correctly", async () => {
    const { getAddress } = await import("viem");
    const mockToken0 = getAddress("0xae13d989dac2f0debff460ac112a837c89baa7cd");
    const mockToken1 = getAddress("0x8fd3000000000000000000000000000000004a2b");
    const mockReserves = [1000000000000000000n, 2000000000000000000n, 1710000000] as const;

    const token0Hex = encodeFunctionResult({
      abi: PANCAKE_PAIR_ABI,
      functionName: "token0",
      result: mockToken0,
    });
    const token1Hex = encodeFunctionResult({
      abi: PANCAKE_PAIR_ABI,
      functionName: "token1",
      result: mockToken1,
    });
    const reservesHex = encodeFunctionResult({
      abi: PANCAKE_PAIR_ABI,
      functionName: "getReserves",
      result: mockReserves,
    });

    // Mock aggregate3 return data: tuple of Result[] = (bool success, bytes returnData)[]
    // We construct the aggregate3 return bytes or mock fetch response
    // In ABI encoding of `Result[]`:
    // For 3 items:
    // offset to array (0x20), length (3), offsets to tuples, then tuples
    // Or we can mock fetch directly returning valid aggregate3 hex:
    const mockPairAddress = "0x1111111111111111111111111111111111111111" as `0x${string}`;

    // Viem parseAbi result for Result[]
    const { encodeAbiParameters, parseAbiParameters } = await import("viem");
    const aggregate3ReturnHex = encodeAbiParameters(
      parseAbiParameters("(bool success, bytes returnData)[]"),
      [
        [
          { success: true, returnData: token0Hex },
          { success: true, returnData: token1Hex },
          { success: true, returnData: reservesHex },
        ],
      ]
    );

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        result: aggregate3ReturnHex,
      }),
    }) as any;

    const results = await multicallRead([
      {
        target: mockPairAddress,
        abi: PANCAKE_PAIR_ABI,
        functionName: "token0",
      },
      {
        target: mockPairAddress,
        abi: PANCAKE_PAIR_ABI,
        functionName: "token1",
      },
      {
        target: mockPairAddress,
        abi: PANCAKE_PAIR_ABI,
        functionName: "getReserves",
      },
    ]);

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect((results[0].result as string).toLowerCase()).toBe(mockToken0.toLowerCase());
    expect(results[1].success).toBe(true);
    expect((results[1].result as string).toLowerCase()).toBe(mockToken1.toLowerCase());
    expect(results[2].success).toBe(true);
    expect(results[2].result).toEqual(mockReserves);
  });

  it("handles failed sub-calls gracefully when allowFailure is true", async () => {
    const { encodeAbiParameters, parseAbiParameters } = await import("viem");
    const aggregate3ReturnHex = encodeAbiParameters(
      parseAbiParameters("(bool success, bytes returnData)[]"),
      [
        [
          { success: false, returnData: "0x" },
        ],
      ]
    );

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        result: aggregate3ReturnHex,
      }),
    }) as any;

    const results = await multicallRead([
      {
        target: CONTRACT_ADDRESSES.PANCAKE_FACTORY,
        abi: ERC20_ABI,
        functionName: "name",
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBeDefined();
  });
});
