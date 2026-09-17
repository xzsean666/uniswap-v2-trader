import React, { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Copy,
  Check,
  Fuel,
  Key,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Trash2,
  Lock,
  ArrowRight,
  Coins,
} from "lucide-react";
import type { Address } from "viem";
import { formatEther } from "viem";
import { CyberCard } from "../ui/CyberCard";
import { CyberButton } from "../ui/CyberButton";
import { CyberSwitch } from "../ui/CyberSwitch";
import { useKeeper } from "../../context/KeeperContext";
import { useWallet } from "../../wallet/WalletContext";
import { useActivePair } from "../../context/ActivePairContext";
import { useNotification } from "../notification/NotificationContext";
import { waitForTransactionReceipt } from "../../services/trading/trade-dispatcher";
import { checkAllowance, approveToken } from "../../services/trading/token-approval";

export const KeeperCard: React.FC = () => {
  const {
    keeper,
    keeperBalance,
    isRefreshingBalance,
    isBoundToCurrentProxy,
    isCheckingBinding,
    isSilentEnabled,
    setIsSilentEnabled,
    proxyAddress,
    generateNewKeeper,
    importKeeper,
    removeKeeper,
    refreshBalance,
    refreshBinding,
    bindKeeperToProxy,
    fundGas,
  } = useKeeper();

  const { address, isConnected, provider } = useWallet();
  const { activePair } = useActivePair();
  const { showNotification } = useNotification();

  const [copied, setCopied] = useState<"address" | "key" | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importKeyInput, setImportKeyInput] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [isBindingLoading, setIsBindingLoading] = useState(false);
  const [isFundingLoading, setIsFundingLoading] = useState(false);

  // Gas funding amount state & user balance
  const [fundAmount, setFundAmount] = useState<string>("0.005");
  const [userBnbBalance, setUserBnbBalance] = useState<string | null>(null);

  const fetchUserBnbBalance = useCallback(async () => {
    if (!address || !provider) return;
    try {
      const raw = (await provider.request({
        method: "eth_getBalance",
        params: [address, "latest"],
      })) as string;
      if (raw) {
        setUserBnbBalance(parseFloat(formatEther(BigInt(raw))).toFixed(4));
      }
    } catch {
      // ignore transient rpc failure
    }
  }, [address, provider]);

  useEffect(() => {
    fetchUserBnbBalance();
  }, [fetchUserBnbBalance]);

  // Token allowances to Proxy Trader contract
  const [token0Allowance, setToken0Allowance] = useState<bigint | null>(null);
  const [token1Allowance, setToken1Allowance] = useState<bigint | null>(null);
  const [isApprovingToken, setIsApprovingToken] = useState<"token0" | "token1" | null>(null);

  const fetchAllowances = useCallback(async () => {
    if (!address || !proxyAddress || !activePair) return;
    try {
      const [allow0, allow1] = await Promise.all([
        checkAllowance(address as Address, proxyAddress, activePair.token0.address as Address),
        checkAllowance(address as Address, proxyAddress, activePair.token1.address as Address),
      ]);
      setToken0Allowance(allow0);
      setToken1Allowance(allow1);
    } catch {
      // Ignore background check failure
    }
  }, [address, proxyAddress, activePair]);

  useEffect(() => {
    fetchAllowances();
  }, [fetchAllowances]);

  const handleApprove = async (targetToken: "token0" | "token1") => {
    if (!provider || !address || !activePair) return;
    const token = targetToken === "token0" ? activePair.token0 : activePair.token1;
    setIsApprovingToken(targetToken);
    try {
      showNotification({
        status: "broadcasting",
        title: `正在发起 ${token.symbol} 授权...`,
        message: `请在 MetaMask 中确认授权给代理合约 (${proxyAddress.slice(0, 6)}...${proxyAddress.slice(-4)})`,
      });
      const txHash = await approveToken(
        provider,
        address as Address,
        proxyAddress,
        token.address as Address
      );
      showNotification({
        status: "pending",
        title: `${token.symbol} 授权交易已广播`,
        message: "正在等待区块节点打包确认...",
        txHash,
      });
      await waitForTransactionReceipt(txHash, 30000, 2000);
      showNotification({
        status: "success",
        title: `${token.symbol} 授权成功`,
        message: `代理交易合约已获得 ${token.symbol} 扣款权限，可全自动静默执行交易！`,
        txHash,
      });
      await fetchAllowances();
    } catch (err: any) {
      showNotification({
        status: "failed",
        title: `${token.symbol} 授权失败`,
        message: err?.message || "用户取消或交易回滚",
      });
    } finally {
      setIsApprovingToken(null);
    }
  };

  const handleCopy = (text: string, type: "address" | "key") => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    try {
      importKeeper(importKeyInput);
      setIsImporting(false);
      setImportKeyInput("");
      showNotification({
        status: "success",
        title: "导入成功",
        message: "已成功导入打工小号 (Keeper)",
      });
    } catch (err: any) {
      setImportError(err.message || "私钥格式错误");
    }
  };

  const handleBind = async () => {
    if (!isConnected) {
      showNotification({
        status: "failed",
        title: "请先连接主钱包",
        message: "必须由拥有本金资产的主钱包调用代理合约 setKeeper",
      });
      return;
    }
    setIsBindingLoading(true);
    try {
      showNotification({
        status: "broadcasting",
        title: "正在发起打工小号链上绑定...",
        message: "请在主钱包中确认 setKeeper 交易",
      });

      const txHash = await bindKeeperToProxy();

      showNotification({
        status: "pending",
        title: "绑定交易已广播",
        message: "正在等待区块节点打包确认...",
        txHash,
      });

      const receipt = await waitForTransactionReceipt(txHash);
      if (receipt.status === "success") {
        await refreshBinding();
        showNotification({
          status: "success",
          title: "绑定成功",
          message: "打工小号已成功授权为专属代理交易操作员",
          txHash,
        });
      } else {
        showNotification({
          status: "failed",
          title: "绑定交易失败",
          message: "链上执行已 Revert",
          txHash,
        });
      }
    } catch (err: any) {
      showNotification({
        status: "failed",
        title: "绑定失败",
        message: err.message || "用户取消或网络错误",
      });
    } finally {
      setIsBindingLoading(false);
    }
  };

  const handleFundGas = async (overrideAmount?: string) => {
    if (!isConnected) {
      showNotification({
        status: "failed",
        title: "请先连接主钱包",
        message: "需要从主钱包转账微量 BNB 作为 Gas 燃料",
      });
      return;
    }
    const targetAmount = overrideAmount || fundAmount || "0.005";
    setIsFundingLoading(true);
    try {
      showNotification({
        status: "broadcasting",
        title: "正在发起 Gas 充值交易...",
        message: `正在向打工小号转账 ${targetAmount} BNB`,
      });

      const txHash = await fundGas(targetAmount);

      showNotification({
        status: "pending",
        title: "Gas 充值已广播",
        message: "正在等待区块节点打包确认...",
        txHash,
      });

      const receipt = await waitForTransactionReceipt(txHash);
      if (receipt.status === "success") {
        await Promise.all([refreshBalance(), fetchUserBnbBalance()]);
        showNotification({
          status: "success",
          title: "Gas 充值成功",
          message: `打工小号已获得 ${targetAmount} BNB 燃料`,
          txHash,
        });
      } else {
        showNotification({
          status: "failed",
          title: "Gas 充值失败",
          message: "链上转账失败",
          txHash,
        });
      }
    } catch (err: any) {
      showNotification({
        status: "failed",
        title: "Gas 充值失败",
        message: err?.message || "用户取消或转账失败",
      });
    } finally {
      setIsFundingLoading(false);
    }
  };

  return (
    <CyberCard className="space-y-3.5 bg-cyber-cardInner/60 border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-100 flex items-center space-x-1.5">
              <span>专属打工小号 (Keeper 托管)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30">
                双钱包资产隔离
              </span>
            </div>
            <p className="text-[10px] text-cyber-textMuted">
              私钥驻留浏览器本地，毫秒级代发交易免弹窗，产物 100% 强制回流主钱包
            </p>
          </div>
        </div>

        {keeper && (
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-slate-300">免弹窗静默执行</span>
            <CyberSwitch
              size="sm"
              checked={isSilentEnabled}
              onChange={setIsSilentEnabled}
            />
          </div>
        )}
      </div>

      {/* Body: No Keeper */}
      {!keeper ? (
        <div className="space-y-3 pt-1">
          <p className="text-xs text-slate-300 leading-relaxed">
            当前尚未配置打工小号。一键生成或导入小号后，可实现 24/7
            全自动静默交易，无需每次在 MetaMask 中签名弹窗。
          </p>

          {!isImporting ? (
            <div className="flex items-center space-x-2.5">
              <CyberButton
                variant="cyan"
                className="flex-1 text-xs py-2"
                onClick={() => {
                  generateNewKeeper();
                  showNotification({
                    status: "success",
                    title: "打工小号生成完毕",
                    message: "已在本地安全生成 Keeper EOA 地址",
                  });
                }}
              >
                <Key className="w-3.5 h-3.5 mr-1" />
                <span>一键生成本地专属打工小号</span>
              </CyberButton>

              <CyberButton
                variant="outline"
                className="text-xs py-2"
                onClick={() => setIsImporting(true)}
              >
                <span>导入已有私钥</span>
              </CyberButton>
            </div>
          ) : (
            <form onSubmit={handleImportSubmit} className="space-y-2 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">输入打工小号私钥</span>
                <button
                  type="button"
                  onClick={() => setIsImporting(false)}
                  className="text-slate-400 hover:text-slate-200 text-[11px]"
                >
                  取消
                </button>
              </div>
              <input
                type="password"
                placeholder="0x... (64位十六进制私钥)"
                value={importKeyInput}
                onChange={(e) => setImportKeyInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-cyber-cyan font-mono"
              />
              {importError && (
                <div className="text-[11px] text-rose-400">{importError}</div>
              )}
              <CyberButton variant="cyan" type="submit" className="w-full text-xs py-1.5">
                确认导入
              </CyberButton>
            </form>
          )}
        </div>
      ) : (
        /* Body: Keeper Configured */
        <div className="space-y-3 text-xs">
          {/* Address Bar */}
          <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">打工小号地址 (Keeper EOA):</span>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => handleCopy(keeper.address, "address")}
                  className="flex items-center space-x-1 text-[11px] text-cyber-cyan hover:text-cyber-cyan/80 font-mono"
                >
                  {copied === "address" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>复制地址</span>
                </button>

                <a
                  href={`https://testnet.bscscan.com/address/${keeper.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-slate-200 ml-1"
                  title="在 BscScan 查看"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            <div className="font-mono text-slate-200 text-[11px] break-all">
              {keeper.address}
            </div>
          </div>

          {/* Gas Balance & Funding */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px] flex items-center space-x-1">
                  <Fuel className="w-3 h-3 text-amber-400" />
                  <span>打工小号 Gas 余额</span>
                </span>
                <button
                  type="button"
                  onClick={refreshBalance}
                  className="text-slate-400 hover:text-slate-200"
                  title="刷新余额"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isRefreshingBalance ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-sm font-bold font-mono text-slate-100">
                  {keeperBalance?.formatted ?? "0.0000"}
                </span>
                <span className="text-[10px] text-slate-400">BNB</span>
              </div>
              {keeperBalance?.isLowGas ? (
                <div className="text-[10px] text-amber-400 flex items-center space-x-1">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  <span>燃料偏低，自动交易可能失败</span>
                </div>
              ) : (
                <div className="text-[10px] text-emerald-400 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>燃料充足，就绪静默执行</span>
                </div>
              )}
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">快速补给燃料 (主钱包划转)</span>
                {userBnbBalance && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    主钱包: {userBnbBalance} BNB
                  </span>
                )}
              </div>

              {/* Preset buttons */}
              <div className="flex items-center space-x-1.5">
                {["0.002", "0.005", "0.01", "0.02"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFundAmount(preset)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                      fundAmount === preset
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                        : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Custom amount input + fund button */}
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500/60 pr-10"
                    placeholder="输入金额"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">
                    BNB
                  </span>
                </div>
                <CyberButton
                  variant="outline"
                  className="text-xs py-1 px-3 border-amber-500/40 text-amber-300 hover:bg-amber-500/10 shrink-0"
                  loading={isFundingLoading}
                  onClick={() => handleFundGas()}
                  disabled={!fundAmount || parseFloat(fundAmount) <= 0}
                >
                  <Fuel className="w-3 h-3 mr-1" />
                  <span>划转 {fundAmount || "0.005"}</span>
                </CyberButton>
              </div>
            </div>
          </div>

          {/* Proxy Contract Binding Status */}
          <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">代理合约操作权状态:</span>
              <div className="flex items-center space-x-1">
                {isCheckingBinding ? (
                  <span className="text-[10px] text-slate-400 animate-pulse">
                    正在核验链上绑定...
                  </span>
                ) : isBoundToCurrentProxy ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>已完成链上绑定</span>
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>未绑定至代理合约</span>
                  </span>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
              <span>当前代理合约:</span>
              <span className="text-slate-300 text-[10px]">{`${proxyAddress.slice(0, 8)}...${proxyAddress.slice(-6)}`}</span>
            </div>

            {!isBoundToCurrentProxy && (
              <CyberButton
                variant="cyan"
                className="w-full text-xs py-1.5"
                loading={isBindingLoading}
                onClick={handleBind}
              >
                <ArrowRight className="w-3.5 h-3.5 mr-1" />
                <span>主钱包发起 setKeeper 绑定</span>
              </CyberButton>
            )}
          </div>

          {/* Proxy Contract Token Allowance (Approve) Status */}
          <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px] flex items-center space-x-1">
                <Coins className="w-3.5 h-3.5 text-cyber-cyan" />
                <span>代理合约代币授权 (Approve):</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {`${proxyAddress.slice(0, 6)}...${proxyAddress.slice(-4)}`}
              </span>
            </div>

            {activePair ? (
              <div className="space-y-2 pt-0.5">
                {/* Token 0 */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-slate-800 text-[11px]">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-slate-200">{activePair.token0.symbol}</span>
                    {token0Allowance !== null && token0Allowance > 0n ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center space-x-0.5">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        <span>已授权</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center space-x-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>未授权</span>
                      </span>
                    )}
                  </div>

                  {(!token0Allowance || token0Allowance === 0n) && (
                    <CyberButton
                      variant="cyan"
                      className="text-[10px] py-1 px-2.5"
                      loading={isApprovingToken === "token0"}
                      onClick={() => handleApprove("token0")}
                    >
                      <span>一键授权 {activePair.token0.symbol}</span>
                    </CyberButton>
                  )}
                </div>

                {/* Token 1 */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-slate-800 text-[11px]">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-slate-200">{activePair.token1.symbol}</span>
                    {token1Allowance !== null && token1Allowance > 0n ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center space-x-0.5">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        <span>已授权</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center space-x-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>未授权</span>
                      </span>
                    )}
                  </div>

                  {(!token1Allowance || token1Allowance === 0n) && (
                    <CyberButton
                      variant="cyan"
                      className="text-[10px] py-1 px-2.5"
                      loading={isApprovingToken === "token1"}
                      onClick={() => handleApprove("token1")}
                    >
                      <span>一键授权 {activePair.token1.symbol}</span>
                    </CyberButton>
                  )}
                </div>

                <p className="text-[10px] text-slate-400 leading-tight">
                  💡 提示: 自动量化交易与 Keeper 静默交易需预先向代理合约授予代币额度，打工小号触发兑换时方可成功扣款。
                </p>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500">
                请先在监控面板载入币对以检查代币授权状态。
              </div>
            )}
          </div>

          {/* Private Key Export / Danger Zone */}
          <div className="pt-1 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => setShowPrivateKey(!showPrivateKey)}
              className="text-slate-400 hover:text-slate-200 flex items-center space-x-1"
            >
              <Key className="w-3 h-3" />
              <span>{showPrivateKey ? "隐藏私钥" : "导出私钥"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (confirm("确定要移除当前打工小号吗？请确保已备份私钥。")) {
                  removeKeeper();
                  showNotification({
                    status: "success",
                    title: "已清除",
                    message: "打工小号已从浏览器安全移除",
                  });
                }
              }}
              className="text-rose-400 hover:text-rose-300 flex items-center space-x-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>移除小号</span>
            </button>
          </div>

          {showPrivateKey && (
            <div className="p-2.5 bg-rose-950/20 border border-rose-500/40 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between text-rose-300 text-[11px]">
                <span className="flex items-center space-x-1 font-semibold">
                  <Lock className="w-3 h-3 text-rose-400" />
                  <span>打工小号私钥 (仅供应急备份)</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(keeper.privateKey, "key")}
                  className="text-cyber-cyan hover:underline"
                >
                  {copied === "key" ? "已复制" : "复制私钥"}
                </button>
              </div>
              <div className="font-mono text-[10px] text-slate-300 break-all bg-slate-950/80 p-2 rounded border border-slate-800">
                {keeper.privateKey}
              </div>
              <div className="text-[10px] text-amber-300/90 leading-tight flex items-start space-x-1">
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  安全提示: 该私钥仅存储在您本地浏览器的沙箱环境中，由于智能合约具备绝对资金归属公理 (Zero-Theft)，该小号无权转移主钱包资金，但其内部存放有微量 Gas 燃料 (BNB)，请妥善保管勿泄露给第三方。
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </CyberCard>
  );
};
