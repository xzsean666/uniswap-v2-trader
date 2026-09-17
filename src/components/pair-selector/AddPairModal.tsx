import React, { useState, useCallback } from "react";
import { X, Search, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { CyberButton } from "../ui/CyberButton";
import {
  resolvePairFromTokens,
  getCommonTokens,
  type ResolvePairResult,
} from "../../services/pair/pair-resolver";
import { fetchPairOverview, validatePairAddress, type PairOverview } from "../../services/pair/pair-reader";
import { useWallet } from "../../wallet/WalletContext";
import { useActivePair } from "../../context/ActivePairContext";

interface AddPairModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddPairModal: React.FC<AddPairModalProps> = ({ isOpen, onClose }) => {
  const { chainId } = useWallet();
  const { addSubscription, selectPair } = useActivePair();

  const [activeTab, setActiveTab] = useState<"tokens" | "direct">("tokens");

  // Tab 1: Tokens state
  const [tokenAInput, setTokenAInput] = useState("");
  const [tokenBInput, setTokenBInput] = useState("");
  const [tokenQueryLoading, setTokenQueryLoading] = useState(false);
  const [tokenQueryResult, setTokenQueryResult] = useState<ResolvePairResult | null>(null);

  // Tab 2: Direct LP state
  const [lpAddressInput, setLpAddressInput] = useState("");
  const [lpQueryLoading, setLpQueryLoading] = useState(false);
  const [lpQueryResult, setLpQueryResult] = useState<{
    overview?: PairOverview;
    error?: string;
  } | null>(null);

  const commonTokens = getCommonTokens(chainId ?? undefined);

  const handleQueryFromTokens = useCallback(async () => {
    if (!tokenAInput || !tokenBInput) return;
    setTokenQueryLoading(true);
    setTokenQueryResult(null);
    try {
      const result = await resolvePairFromTokens(
        tokenAInput.trim(),
        tokenBInput.trim(),
        chainId ?? undefined
      );
      setTokenQueryResult(result);
    } catch (err: any) {
      setTokenQueryResult({ exists: false, error: err?.message || "查询失败" });
    } finally {
      setTokenQueryLoading(false);
    }
  }, [tokenAInput, tokenBInput, chainId]);

  const handleQueryDirectLp = useCallback(async () => {
    if (!lpAddressInput) return;
    const valid = validatePairAddress(lpAddressInput.trim());
    if (!valid.valid || !valid.checksummed) {
      setLpQueryResult({ error: valid.error || "无效的合约地址" });
      return;
    }
    setLpQueryLoading(true);
    setLpQueryResult(null);
    try {
      const overview = await fetchPairOverview(valid.checksummed);
      setLpQueryResult({ overview });
    } catch (err: any) {
      setLpQueryResult({
        error: err?.message || "无法从该地址读取 PancakeSwap V2 LP 数据",
      });
    } finally {
      setLpQueryLoading(false);
    }
  }, [lpAddressInput]);

  const handleConfirmAddTokenPair = useCallback(async () => {
    if (!tokenQueryResult?.exists || !tokenQueryResult.pairAddress || !tokenQueryResult.overview) {
      return;
    }
    const overview = tokenQueryResult.overview;
    await addSubscription({
      pairAddress: tokenQueryResult.pairAddress,
      token0Address: overview.token0.address,
      token0Symbol: overview.token0.symbol,
      token1Address: overview.token1.address,
      token1Symbol: overview.token1.symbol,
      status: "inactive",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await selectPair(tokenQueryResult.pairAddress);
    onClose();
  }, [tokenQueryResult, addSubscription, selectPair, onClose]);

  const handleConfirmAddDirectLp = useCallback(async () => {
    if (!lpQueryResult?.overview) return;
    const overview = lpQueryResult.overview;
    await addSubscription({
      pairAddress: overview.pairAddress,
      token0Address: overview.token0.address,
      token0Symbol: overview.token0.symbol,
      token1Address: overview.token1.address,
      token1Symbol: overview.token1.symbol,
      status: "inactive",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await selectPair(overview.pairAddress);
    onClose();
  }, [lpQueryResult, addSubscription, selectPair, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-cyber-card border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-cyber-cardInner/60">
          <div className="flex items-center space-x-2 text-cyber-cyan font-bold text-sm">
            <Sparkles className="w-4 h-4" />
            <span>添加交易对 (PancakeSwap V2)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1.5 mx-5 mt-4 bg-cyber-cardInner rounded-xl border border-slate-800/80 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("tokens")}
            className={`py-2 rounded-lg font-medium transition-all ${
              activeTab === "tokens"
                ? "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            代币双选查询 (Factory)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("direct")}
            className={`py-2 rounded-lg font-medium transition-all ${
              activeTab === "direct"
                ? "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            LP 地址直填
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {activeTab === "tokens" ? (
            <div className="space-y-4">
              {/* Quick Preset Tokens */}
              {commonTokens.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-slate-400 text-[11px]">快捷代币填充:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {commonTokens.map((t) => (
                      <button
                        key={t.address}
                        type="button"
                        onClick={() => {
                          if (!tokenAInput) {
                            setTokenAInput(t.address);
                          } else if (!tokenBInput && tokenAInput.toLowerCase() !== t.address.toLowerCase()) {
                            setTokenBInput(t.address);
                          } else {
                            setTokenAInput(t.address);
                          }
                        }}
                        className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-cyber-cyan text-[11px] font-mono transition-colors"
                      >
                        {t.symbol}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Token A */}
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">代币 A 合约地址</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={tokenAInput}
                  onChange={(e) => setTokenAInput(e.target.value)}
                  className="w-full bg-cyber-cardInner border border-slate-700/80 rounded-xl px-3.5 py-2 text-slate-200 outline-none focus:border-cyber-cyan/60 font-mono text-xs"
                />
              </div>

              {/* Token B */}
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">代币 B 合约地址</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={tokenBInput}
                  onChange={(e) => setTokenBInput(e.target.value)}
                  className="w-full bg-cyber-cardInner border border-slate-700/80 rounded-xl px-3.5 py-2 text-slate-200 outline-none focus:border-cyber-cyan/60 font-mono text-xs"
                />
              </div>

              <CyberButton
                variant="cyan"
                loading={tokenQueryLoading}
                disabled={!tokenAInput || !tokenBInput || tokenQueryLoading}
                onClick={handleQueryFromTokens}
                className="w-full"
              >
                <Search className="w-4 h-4" />
                <span>查询 PancakeSwap 流动性池</span>
              </CyberButton>

              {/* Token Query Result */}
              {tokenQueryResult && (
                <div className="pt-2">
                  {tokenQueryResult.exists && tokenQueryResult.overview ? (
                    <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2.5">
                      <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>已找到 PancakeSwap V2 流动性池!</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-black/40 p-2.5 rounded-lg font-mono">
                        <div>
                          <span className="text-slate-400">代币对: </span>
                          <span className="text-white font-bold">
                            {tokenQueryResult.overview.token0.symbol} / {tokenQueryResult.overview.token1.symbol}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">当前汇率: </span>
                          <span className="text-cyber-cyan">
                            1 {tokenQueryResult.overview.token0.symbol} ≈ {tokenQueryResult.overview.price1Per0Formatted} {tokenQueryResult.overview.token1.symbol}
                          </span>
                        </div>
                        <div className="col-span-2 truncate">
                          <span className="text-slate-400">LP 地址: </span>
                          <span className="text-slate-200">{tokenQueryResult.pairAddress}</span>
                        </div>
                      </div>
                      <CyberButton
                        variant="cyan"
                        onClick={handleConfirmAddTokenPair}
                        className="w-full"
                      >
                        <span>✓ 加入我的自选并载入监控</span>
                      </CyberButton>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{tokenQueryResult.error || "未在 PancakeSwap 上找到流动性池"}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">PancakeSwap V2 LP 合约地址</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={lpAddressInput}
                  onChange={(e) => setLpAddressInput(e.target.value)}
                  className="w-full bg-cyber-cardInner border border-slate-700/80 rounded-xl px-3.5 py-2 text-slate-200 outline-none focus:border-cyber-cyan/60 font-mono text-xs"
                />
              </div>

              <CyberButton
                variant="cyan"
                loading={lpQueryLoading}
                disabled={!lpAddressInput || lpQueryLoading}
                onClick={handleQueryDirectLp}
                className="w-full"
              >
                <Search className="w-4 h-4" />
                <span>解析 LP 合约数据</span>
              </CyberButton>

              {/* Direct LP Result */}
              {lpQueryResult && (
                <div className="pt-2">
                  {lpQueryResult.overview ? (
                    <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2.5">
                      <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>LP 合约解析成功!</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-black/40 p-2.5 rounded-lg font-mono">
                        <div>
                          <span className="text-slate-400">代币对: </span>
                          <span className="text-white font-bold">
                            {lpQueryResult.overview.token0.symbol} / {lpQueryResult.overview.token1.symbol}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">当前价格: </span>
                          <span className="text-cyber-cyan">
                            1 {lpQueryResult.overview.token0.symbol} ≈ {lpQueryResult.overview.price1Per0Formatted} {lpQueryResult.overview.token1.symbol}
                          </span>
                        </div>
                      </div>
                      <CyberButton
                        variant="cyan"
                        onClick={handleConfirmAddDirectLp}
                        className="w-full"
                      >
                        <span>✓ 加入我的自选并载入监控</span>
                      </CyberButton>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{lpQueryResult.error || "无法解析该 LP 地址"}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
