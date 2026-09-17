import React, { useState } from "react";
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
} from "lucide-react";
import { CyberCard } from "../ui/CyberCard";
import { CyberButton } from "../ui/CyberButton";
import { CyberSwitch } from "../ui/CyberSwitch";
import { useKeeper } from "../../context/KeeperContext";
import { useWallet } from "../../wallet/WalletContext";
import { useNotification } from "../notification/NotificationContext";
import { waitForTransactionReceipt } from "../../services/trading/trade-dispatcher";

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

  const { isConnected } = useWallet();
  const { showNotification } = useNotification();

  const [copied, setCopied] = useState<"address" | "key" | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importKeyInput, setImportKeyInput] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [isBindingLoading, setIsBindingLoading] = useState(false);
  const [isFundingLoading, setIsFundingLoading] = useState(false);

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

  const handleFundGas = async () => {
    if (!isConnected) {
      showNotification({
        status: "failed",
        title: "请先连接主钱包",
        message: "需要从主钱包转账微量 BNB 作为 Gas 燃料",
      });
      return;
    }
    setIsFundingLoading(true);
    try {
      showNotification({
        status: "broadcasting",
        title: "正在发起 Gas 充值交易...",
        message: "正在向打工小号转账 0.01 BNB",
      });

      const txHash = await fundGas("0.01");

      showNotification({
        status: "pending",
        title: "Gas 充值已广播",
        message: "正在等待区块节点打包确认...",
        txHash,
      });

      const receipt = await waitForTransactionReceipt(txHash);
      if (receipt.status === "success") {
        await refreshBalance();
        showNotification({
          status: "success",
          title: "Gas 充值成功",
          message: "打工小号已获得 0.01 BNB 燃料",
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
        title: "充值失败",
        message: err.message || "用户取消或网络错误",
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
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px] flex items-center space-x-1">
                  <Fuel className="w-3 h-3 text-amber-400" />
                  <span>Gas 燃料余额</span>
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
              {keeperBalance?.isLowGas && (
                <div className="text-[10px] text-amber-400 flex items-center space-x-1">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  <span>燃料过低，请充值</span>
                </div>
              )}
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="text-slate-400 text-[11px]">燃料补给 (主钱包划转)</div>
              <CyberButton
                variant="outline"
                className="text-xs py-1 mt-1 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                loading={isFundingLoading}
                onClick={handleFundGas}
              >
                <Fuel className="w-3 h-3 mr-1" />
                <span>充值 0.01 BNB</span>
              </CyberButton>
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
            <div className="p-2.5 bg-rose-950/20 border border-rose-500/40 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-rose-300 text-[11px]">
                <span className="flex items-center space-x-1">
                  <Lock className="w-3 h-3" />
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
              <div className="font-mono text-[10px] text-slate-300 break-all bg-slate-950/80 p-2 rounded">
                {keeper.privateKey}
              </div>
            </div>
          )}
        </div>
      )}
    </CyberCard>
  );
};
