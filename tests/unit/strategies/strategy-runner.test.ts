import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAddress, parseUnits, type Hex } from "viem";
import { evaluateAndExecuteAutoTrade } from "../../../src/strategies/strategy-runner";
import {
  type AutoTradeConfig,
  DEFAULT_TRADE_SIDE_BUY,
  DEFAULT_TRADE_SIDE_SELL,
} from "../../../src/strategies/auto-trade-types";
import * as reverseEngineModule from "../../../src/strategies/reverse-trade-engine";
import * as tokenApprovalModule from "../../../src/services/trading/token-approval";
import * as keeperExecutorModule from "../../../src/services/trading/keeper-executor";
import type { StoredKeeperData } from "../../../src/services/trading/keeper-manager";

describe("Autonomous Strategy Runner (AutoTradeRunner)", () => {
  const mockMasterAddress = getAddress("0x1111111111111111111111111111111111111111");
  const mockProxyAddress = getAddress("0x2222222222222222222222222222222222222222");
  const mockToken0 = getAddress("0x3333333333333333333333333333333333333333");
  const mockToken1 = getAddress("0x4444444444444444444444444444444444444444");

  const mockKeeper: StoredKeeperData = {
    address: getAddress("0x5555555555555555555555555555555555555555"),
    privateKey: "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex,
    createdAt: Date.now(),
  };

  const baseConfig: AutoTradeConfig = {
    pairAddress: "0xPairAddress",
    buy: {
      ...DEFAULT_TRADE_SIDE_BUY,
      active: true,
      auto: true,
      dropActive: true,
      dropThreshold: 5.0, // 5% drop
      minAmount: 50,
      maxAmount: 100,
    },
    sell: {
      ...DEFAULT_TRADE_SIDE_SELL,
      active: true,
      auto: true,
      riseActive: true,
      riseThreshold: 4.0, // 4% rise
      minAmount: 30,
      maxAmount: 60,
    },
    basePrice: 1.0,
    cooldownSeconds: 30,
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks execution when in-flight mutex is locked", async () => {
    const outcome = await evaluateAndExecuteAutoTrade({
      config: baseConfig,
      currentPrice: 0.94, // 6% drop
      token0Address: mockToken0,
      token1Address: mockToken1,
      masterAddress: mockMasterAddress,
      proxyAddress: mockProxyAddress,
      keeper: mockKeeper,
      isSilentEnabled: true,
      isBoundToProxy: true,
      isInFlight: true,
    });

    expect(outcome.executed).toBe(false);
    expect(outcome.reason).toContain("Mutex 互斥锁");
  });

  it("blocks execution when within cooldown period", async () => {
    const recentTime = Date.now() - 10000; // 10s ago, cooldown is 30s
    const outcome = await evaluateAndExecuteAutoTrade({
      config: baseConfig,
      currentPrice: 0.94,
      token0Address: mockToken0,
      token1Address: mockToken1,
      masterAddress: mockMasterAddress,
      proxyAddress: mockProxyAddress,
      keeper: mockKeeper,
      isSilentEnabled: true,
      isBoundToProxy: true,
      lastExecutedAt: recentTime,
    });

    expect(outcome.executed).toBe(false);
    expect(outcome.reason).toContain("冷却中");
  });

  it("returns not executed when price does not breach threshold", async () => {
    const outcome = await evaluateAndExecuteAutoTrade({
      config: baseConfig,
      currentPrice: 0.98, // -2% drop, threshold is 5%
      token0Address: mockToken0,
      token1Address: mockToken1,
      masterAddress: mockMasterAddress,
      proxyAddress: mockProxyAddress,
      keeper: mockKeeper,
      isSilentEnabled: true,
      isBoundToProxy: true,
    });

    expect(outcome.triggered).toBe(false);
    expect(outcome.executed).toBe(false);
    expect(outcome.reason).toContain("未达到买入或卖出触发阈值");
  });

  it("rejects execution if keeper is missing or not bound", async () => {
    const outcome = await evaluateAndExecuteAutoTrade({
      config: baseConfig,
      currentPrice: 0.94, // 6% drop -> triggers Buy
      token0Address: mockToken0,
      token1Address: mockToken1,
      masterAddress: mockMasterAddress,
      proxyAddress: mockProxyAddress,
      keeper: null, // missing keeper
      isSilentEnabled: false,
      isBoundToProxy: false,
    });

    expect(outcome.triggered).toBe(true);
    expect(outcome.executed).toBe(false);
    expect(outcome.reason).toContain("Keeper");
  });

  it("intercepts execution if allowance is insufficient", async () => {
    vi.spyOn(tokenApprovalModule, "checkAllowance").mockResolvedValue(0n); // 0 allowance

    const outcome = await evaluateAndExecuteAutoTrade({
      config: baseConfig,
      currentPrice: 0.94,
      token0Address: mockToken0,
      token1Address: mockToken1,
      masterAddress: mockMasterAddress,
      proxyAddress: mockProxyAddress,
      keeper: mockKeeper,
      isSilentEnabled: true,
      isBoundToProxy: true,
    });

    expect(outcome.triggered).toBe(true);
    expect(outcome.executed).toBe(false);
    expect(outcome.reason).toContain("授权额度不足");
  });

  it("intercepts execution if dry-run simulation fails", async () => {
    vi.spyOn(tokenApprovalModule, "checkAllowance").mockResolvedValue(parseUnits("100000", 18));
    vi.spyOn(reverseEngineModule, "simulateTradeDryRun").mockResolvedValue({
      allowed: false,
      amountIn: 50n,
      reason: "模拟输出价格低于下限",
    });

    const outcome = await evaluateAndExecuteAutoTrade({
      config: baseConfig,
      currentPrice: 0.94,
      token0Address: mockToken0,
      token1Address: mockToken1,
      masterAddress: mockMasterAddress,
      proxyAddress: mockProxyAddress,
      keeper: mockKeeper,
      isSilentEnabled: true,
      isBoundToProxy: true,
    });

    expect(outcome.triggered).toBe(true);
    expect(outcome.executed).toBe(false);
    expect(outcome.reason).toContain("模拟校验拦截");
  });

  it("autonomously triggers and executes Buy trade via Keeper when drop threshold is exceeded", async () => {
    vi.spyOn(tokenApprovalModule, "checkAllowance").mockResolvedValue(parseUnits("100000", 18));
    vi.spyOn(reverseEngineModule, "simulateTradeDryRun").mockResolvedValue({
      allowed: true,
      amountIn: parseUnits("50", 18),
      expectedAmountOut: parseUnits("53", 18),
      effectivePrice: 1.06,
    });

    const mockTxHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;
    vi.spyOn(keeperExecutorModule, "executeKeeperSwap").mockResolvedValue({
      txHash: mockTxHash,
      keeperAddress: mockKeeper.address,
      proxyAddress: mockProxyAddress,
      userAddress: mockMasterAddress,
      amountIn: parseUnits("50", 18),
      amountOutMin: parseUnits("51", 18),
      methodName: "executeSwap",
      timestamp: Date.now(),
    });

    const outcome = await evaluateAndExecuteAutoTrade({
      config: baseConfig,
      currentPrice: 0.94, // 6% drop
      token0Address: mockToken0,
      token1Address: mockToken1,
      masterAddress: mockMasterAddress,
      proxyAddress: mockProxyAddress,
      keeper: mockKeeper,
      isSilentEnabled: true,
      isBoundToProxy: true,
    });

    expect(outcome.triggered).toBe(true);
    expect(outcome.executed).toBe(true);
    expect(outcome.side).toBe("buy");
    expect(outcome.newBasePrice).toBe(0.94);
    expect(outcome.record).toBeDefined();
    expect(outcome.record?.txHash).toBe(mockTxHash);
    expect(outcome.record?.status).toBe("success");
  });

  it("autonomously triggers and executes Sell trade via Keeper when rise threshold is exceeded", async () => {
    vi.spyOn(tokenApprovalModule, "checkAllowance").mockResolvedValue(parseUnits("100000", 18));
    vi.spyOn(reverseEngineModule, "simulateTradeDryRun").mockResolvedValue({
      allowed: true,
      amountIn: parseUnits("35", 18),
      expectedAmountOut: parseUnits("37", 18),
      effectivePrice: 1.05,
    });

    const mockTxHash = "0x9876543210abcdef9876543210abcdef9876543210abcdef9876543210abcdef" as Hex;
    vi.spyOn(keeperExecutorModule, "executeKeeperSwap").mockResolvedValue({
      txHash: mockTxHash,
      keeperAddress: mockKeeper.address,
      proxyAddress: mockProxyAddress,
      userAddress: mockMasterAddress,
      amountIn: parseUnits("35", 18),
      amountOutMin: parseUnits("36", 18),
      methodName: "executeSwap",
      timestamp: Date.now(),
    });

    const outcome = await evaluateAndExecuteAutoTrade({
      config: baseConfig,
      currentPrice: 1.05, // 5% rise (threshold 4%)
      token0Address: mockToken0,
      token1Address: mockToken1,
      masterAddress: mockMasterAddress,
      proxyAddress: mockProxyAddress,
      keeper: mockKeeper,
      isSilentEnabled: true,
      isBoundToProxy: true,
    });

    expect(outcome.triggered).toBe(true);
    expect(outcome.executed).toBe(true);
    expect(outcome.side).toBe("sell");
    expect(outcome.newBasePrice).toBe(1.05);
    expect(outcome.record?.txHash).toBe(mockTxHash);
  });
});
