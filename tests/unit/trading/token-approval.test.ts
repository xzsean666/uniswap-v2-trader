import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseUnits, type Address } from "viem";
import {
  checkAllowance,
  verifyAllowanceStatus,
  approveToken,
  checkAndApprove,
} from "../../../src/services/trading/token-approval";
import * as multicall from "../../../src/evm/multicall";
import type { EIP1193Provider } from "../../../src/wallet/ethereum";

describe("Token Approval Service (TASK-014)", () => {
  const mockOwner: Address = "0x1111111111111111111111111111111111111111";
  const mockSpender: Address = "0x2222222222222222222222222222222222222222";
  const mockToken: Address = "0x3333333333333333333333333333333333333333";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("checks allowance correctly via multicall", async () => {
    vi.spyOn(multicall, "multicallRead").mockResolvedValueOnce([
      { success: true, result: 1000000000000000000n },
    ]);

    const allowance = await checkAllowance(mockOwner, mockSpender, mockToken);
    expect(allowance).toBe(1000000000000000000n);
  });

  it("throws error when multicall fails", async () => {
    vi.spyOn(multicall, "multicallRead").mockResolvedValueOnce([
      { success: false, result: undefined },
    ]);

    await expect(
      checkAllowance(mockOwner, mockSpender, mockToken)
    ).rejects.toThrow("查询代币");
  });

  it("verifies allowance status - sufficient vs insufficient", async () => {
    vi.spyOn(multicall, "multicallRead").mockResolvedValue([
      { success: true, result: parseUnits("100", 18) },
    ]);

    const status1 = await verifyAllowanceStatus(
      mockOwner,
      mockSpender,
      mockToken,
      parseUnits("50", 18)
    );
    expect(status1.hasSufficientAllowance).toBe(true);

    const status2 = await verifyAllowanceStatus(
      mockOwner,
      mockSpender,
      mockToken,
      parseUnits("200", 18)
    );
    expect(status2.hasSufficientAllowance).toBe(false);
  });

  it("sends approve transaction with maxUint256 by default", async () => {
    const mockRequest = vi.fn().mockResolvedValue("0xapprovetxhash1234");
    const mockProvider: EIP1193Provider = {
      request: mockRequest,
    };

    const txHash = await approveToken(
      mockProvider,
      mockOwner,
      mockSpender,
      mockToken
    );

    expect(txHash).toBe("0xapprovetxhash1234");
    expect(mockRequest).toHaveBeenCalledTimes(1);
    const callArg = mockRequest.mock.calls[0][0];
    expect(callArg.method).toBe("eth_sendTransaction");
    expect(callArg.params[0].from.toLowerCase()).toBe(mockOwner.toLowerCase());
    expect(callArg.params[0].to.toLowerCase()).toBe(mockToken.toLowerCase());
    expect(callArg.params[0].data).toBeDefined();
  });

  it("checkAndApprove bypasses approve when allowance is already sufficient", async () => {
    vi.spyOn(multicall, "multicallRead").mockResolvedValueOnce([
      { success: true, result: parseUnits("500", 18) },
    ]);

    const mockRequest = vi.fn();
    const mockProvider: EIP1193Provider = { request: mockRequest };

    const res = await checkAndApprove(
      mockProvider,
      mockOwner,
      mockSpender,
      mockToken,
      parseUnits("100", 18)
    );

    expect(res.approved).toBe(true);
    expect(res.txHash).toBeUndefined();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("checkAndApprove triggers approve when allowance is insufficient", async () => {
    vi.spyOn(multicall, "multicallRead").mockResolvedValueOnce([
      { success: true, result: 0n },
    ]);

    const mockRequest = vi.fn().mockResolvedValue("0xapprovetx999");
    const mockProvider: EIP1193Provider = { request: mockRequest };

    const res = await checkAndApprove(
      mockProvider,
      mockOwner,
      mockSpender,
      mockToken,
      parseUnits("100", 18)
    );

    expect(res.approved).toBe(false);
    expect(res.txHash).toBe("0xapprovetx999");
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});
