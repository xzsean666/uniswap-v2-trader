import {
  encodeFunctionData,
  decodeFunctionResult,
  type Abi,
} from "viem";
import {
  encodeAggregate3,
  decodeAggregate3Result,
} from "@evm-event-lake/node-sdk/evm-call";
import { CONTRACT_ADDRESSES } from "../constants/contracts";
import { requestJsonRpc } from "./rpc-client";

export interface Multicall3Call {
  target: `0x${string}`;
  allowFailure?: boolean;
  callData: `0x${string}`;
}

export interface Multicall3Result {
  success: boolean;
  returnData: `0x${string}`;
}

export interface ContractReadCall<TAbi extends Abi = Abi> {
  target: `0x${string}`;
  abi: TAbi;
  functionName: string;
  args?: readonly unknown[];
  allowFailure?: boolean;
}

export interface ContractReadResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: Error;
}

/**
 * Low-level Multicall3 aggregate3 execution using BSC Testnet RPC pool
 */
export async function executeAggregate3(
  calls: Multicall3Call[],
  blockTag: string = "latest"
): Promise<Multicall3Result[]> {
  if (calls.length === 0) return [];

  // Encode aggregate3 using evm-call's optimized encoder
  const encodedCalldata = encodeAggregate3(
    calls.map((c) => ({
      target: c.target,
      allowFailure: c.allowFailure ?? true,
      callData: c.callData,
    }))
  );

  // Send eth_call to Multicall3 contract
  const hexResult = await requestJsonRpc<string>("eth_call", [
    {
      to: CONTRACT_ADDRESSES.MULTICALL3,
      data: encodedCalldata,
    },
    blockTag,
  ]);

  // Decode aggregate3 return data
  const decoded = decodeAggregate3Result(hexResult, calls.length);
  return decoded.map((d) => ({
    success: d.success,
    returnData: d.returnData as `0x${string}`,
  }));
}

/**
 * High-level Multicall reader: encodes contract calls, aggregates in a single RPC call, and decodes results.
 */
export async function multicallRead<T = unknown>(
  calls: ContractReadCall[],
  blockTag: string = "latest"
): Promise<ContractReadResult<T>[]> {
  if (calls.length === 0) return [];

  // 1. Encode all calls
  const encodedCalls: Multicall3Call[] = calls.map((c) => ({
    target: c.target,
    allowFailure: c.allowFailure ?? true,
    callData: encodeFunctionData({
      abi: c.abi,
      functionName: c.functionName,
      args: c.args,
    }),
  }));

  // 2. Execute Multicall3 aggregate3
  const rawResults = await executeAggregate3(encodedCalls, blockTag);

  // 3. Decode each call
  return rawResults.map((raw, index) => {
    const callDef = calls[index];
    if (!raw.success || raw.returnData === "0x") {
      return {
        success: false,
        error: new Error(`Multicall failed for ${callDef.functionName} at ${callDef.target}`),
      };
    }

    try {
      const decodedResult = decodeFunctionResult({
        abi: callDef.abi,
        functionName: callDef.functionName,
        data: raw.returnData,
      }) as T;

      return {
        success: true,
        result: decodedResult,
      };
    } catch (decodeErr: any) {
      return {
        success: false,
        error: decodeErr,
      };
    }
  });
}
