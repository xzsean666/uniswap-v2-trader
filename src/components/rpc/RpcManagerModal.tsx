import React, { useState, useEffect, useCallback } from "react";
import {
  Server,
  Activity,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X,
} from "lucide-react";
import {
  RpcPoolManager,
  type RpcEndpointItem,
} from "../../services/rpc/rpc-pool-manager";
import { CyberButton } from "../ui/CyberButton";
import { useWallet } from "../../wallet/WalletContext";

interface RpcManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RpcManagerModal: React.FC<RpcManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { chainId } = useWallet();
  const activeChainId = chainId ?? 97;

  const [endpoints, setEndpoints] = useState<RpcEndpointItem[]>([]);
  const [filterType, setFilterType] = useState<"all" | "archive" | "standard">("all");
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [testingUrl, setTestingUrl] = useState<string | null>(null);

  // New Custom RPC inputs
  const [newRpcUrl, setNewRpcUrl] = useState("");
  const [newRpcLabel, setNewRpcLabel] = useState("");
  const [newRpcNodeType, setNewRpcNodeType] = useState<"archive" | "standard">("standard");
  const [isAdding, setIsAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const loadEndpoints = useCallback(() => {
    const list = RpcPoolManager.getAllEndpoints(activeChainId);
    setEndpoints(list);
  }, [activeChainId]);

  useEffect(() => {
    if (isOpen) {
      loadEndpoints();
    }
  }, [isOpen, loadEndpoints]);

  // Subscribe to external pool changes
  useEffect(() => {
    const unsubscribe = RpcPoolManager.onPoolChange((changedChainId) => {
      if (changedChainId === activeChainId) {
        loadEndpoints();
      }
    });
    return unsubscribe;
  }, [activeChainId, loadEndpoints]);

  const handleTestSingle = async (url: string) => {
    setTestingUrl(url);
    try {
      await RpcPoolManager.testEndpoint(url, activeChainId);
      loadEndpoints();
    } finally {
      setTestingUrl(null);
    }
  };

  const handleTestAll = async () => {
    setIsTestingAll(true);
    try {
      await RpcPoolManager.testAllEndpoints(activeChainId);
      loadEndpoints();
    } finally {
      setIsTestingAll(false);
    }
  };

  const handleToggle = (url: string, currentEnabled: boolean) => {
    RpcPoolManager.toggleRpc(activeChainId, url, !currentEnabled);
    loadEndpoints();
  };

  const handleRemove = (url: string) => {
    RpcPoolManager.removeCustomRpc(activeChainId, url);
    loadEndpoints();
  };

  const handleResetDefaults = () => {
    if (window.confirm("确定要重置当前网络的 RPC 节点池为官方默认配置吗？所有自定义节点将被清除。")) {
      RpcPoolManager.resetToDefaults(activeChainId);
      loadEndpoints();
    }
  };

  const handleAddCustomRpc = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const trimmedUrl = newRpcUrl.trim();
    if (!trimmedUrl) {
      setFormError("请输入 RPC 节点地址");
      return;
    }

    setIsAdding(true);
    try {
      const res = await RpcPoolManager.addCustomRpc(
        activeChainId,
        trimmedUrl,
        newRpcLabel.trim() || undefined,
        newRpcNodeType
      );

      if (!res.success) {
        setFormError(res.error || "无法连接到该 RPC 节点，请检查地址或网络");
      } else {
        setFormSuccess(`添加成功！节点响应正常 (类型: ${newRpcNodeType === "archive" ? "归档节点" : "常规节点"}, 延迟: ${res.latencyMs}ms, 高度: #${res.blockNumber?.toString()})`);
        setNewRpcUrl("");
        setNewRpcLabel("");
        loadEndpoints();
        setTimeout(() => setFormSuccess(null), 4000);
      }
    } catch (err: any) {
      setFormError(err?.message || "添加节点失败");
    } finally {
      setIsAdding(false);
    }
  };

  if (!isOpen) return null;

  const archiveCount = endpoints.filter((e) => e.nodeType === "archive").length;
  const standardCount = endpoints.filter((e) => e.nodeType !== "archive").length;
  const filteredEndpoints = endpoints.filter((e) => {
    if (filterType === "archive") return e.nodeType === "archive";
    if (filterType === "standard") return e.nodeType !== "archive";
    return true;
  });
  const activeCount = filteredEndpoints.filter((e) => e.enabled).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] bg-cyber-card border border-cyber-border rounded-2xl shadow-2xl shadow-cyan-950/60 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-cyber-cardInner/40">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  EVM 节点池与 RPC 管理
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-cyan-500/10 text-cyber-cyan border border-cyan-500/30">
                  {activeChainId === 56 ? "BSC 主网" : activeChainId === 31337 ? "Hardhat 本地" : "BSC 测试网"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                严格区分归档节点与常规节点，解耦 24h 历史回溯与实时高频交易
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* Node Category Tabs */}
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filterType === "all"
                  ? "bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              全部节点 ({endpoints.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("archive")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center space-x-1 ${
                filterType === "archive"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/50"
                  : "text-slate-400 hover:text-purple-300"
              }`}
              title="归档节点：用于 24 小时历史事件与均价回溯"
            >
              <span>归档节点池</span>
              <span className="text-[10px] px-1 rounded bg-purple-900/40 text-purple-300">
                {archiveCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType("standard")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center space-x-1 ${
                filterType === "standard"
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/50"
                  : "text-slate-400 hover:text-blue-300"
              }`}
              title="常规节点：用于最新区块轮询、Multicall3 读数据与交易广播"
            >
              <span>常规全节点池</span>
              <span className="text-[10px] px-1 rounded bg-blue-900/40 text-blue-300">
                {standardCount}
              </span>
            </button>
          </div>

          {/* Status and Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-cyber-cardInner/70 border border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="text-slate-300">生效节点:</span>
              <span className="text-emerald-400 font-mono font-bold">
                {activeCount} / {filteredEndpoints.length}
              </span>
              <span className="text-[11px] text-slate-500">
                (已按延迟自动故障转移)
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleTestAll}
                disabled={isTestingAll}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/40 hover:bg-cyber-cyan/25 transition-all text-xs font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingAll ? "animate-spin" : ""}`} />
                <span>{isTestingAll ? "测速中..." : "一键全量测速"}</span>
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-xs"
                title="恢复默认官方节点"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>重置默认</span>
              </button>
            </div>
          </div>

          {/* Endpoints List */}
          <div className="space-y-2">
            <div className="text-slate-400 font-medium px-1 flex items-center justify-between">
              <span>
                {filterType === "archive"
                  ? "归档节点列表 (历史数据专用)"
                  : filterType === "standard"
                  ? "常规全节点列表 (实时与交易专用)"
                  : "当前节点池列表"}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {filteredEndpoints.filter((e) => e.isCustom).length} 自定义 / {filteredEndpoints.filter((e) => !e.isCustom).length} 内置
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {filteredEndpoints.map((ep) => {
                const isTestingThis = testingUrl === ep.url;
                return (
                  <div
                    key={ep.url}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      ep.enabled
                        ? "bg-cyber-cardInner/90 border-slate-700/80 hover:border-slate-600"
                        : "bg-cyber-cardInner/30 border-slate-800/60 opacity-60"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
                      <input
                        type="checkbox"
                        checked={ep.enabled}
                        onChange={() => handleToggle(ep.url, ep.enabled)}
                        className="w-4 h-4 rounded border-slate-700 text-cyber-cyan focus:ring-0 focus:ring-offset-0 bg-slate-900 cursor-pointer"
                        title={ep.enabled ? "点击禁用" : "点击启用"}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span className="font-mono text-slate-200 text-xs truncate max-w-[200px] sm:max-w-xs" title={ep.url}>
                            {ep.url}
                          </span>
                          {ep.nodeType === "archive" ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                              归档 Archive
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                              常规 Full
                            </span>
                          )}
                          {ep.isCustom ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              自定义
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              内置
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                          {ep.label && <span>{ep.label}</span>}
                          {ep.blockNumber && (
                            <span className="font-mono text-slate-500">
                              #{ep.blockNumber.toString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Latency badge & controls */}
                    <div className="flex items-center space-x-2 shrink-0">
                      {isTestingThis ? (
                        <span className="text-[11px] text-cyan-400 animate-pulse font-mono">
                          测速中...
                        </span>
                      ) : ep.latencyMs !== undefined ? (
                        <span
                          className={`font-mono text-[11px] px-2 py-0.5 rounded-full border ${
                            ep.error
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : ep.latencyMs < 200
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : ep.latencyMs < 600
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                          title={ep.error || `延迟: ${ep.latencyMs}ms`}
                        >
                          {ep.error ? "异常" : `${ep.latencyMs}ms`}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleTestSingle(ep.url)}
                          className="text-[11px] text-slate-400 hover:text-cyber-cyan"
                        >
                          测速
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleTestSingle(ep.url)}
                        disabled={isTestingThis}
                        className="p-1 text-slate-400 hover:text-cyber-cyan rounded transition-colors"
                        title="测试该节点"
                      >
                        <Activity className="w-3.5 h-3.5" />
                      </button>

                      {ep.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleRemove(ep.url)}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
                          title="删除自定义节点"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Custom RPC Form */}
          <form
            onSubmit={handleAddCustomRpc}
            className="p-3.5 rounded-xl bg-cyber-cardInner/60 border border-slate-800 space-y-3"
          >
            <div className="flex items-center space-x-1.5 text-cyber-cyan font-bold text-xs">
              <Plus className="w-4 h-4" />
              <span>添加用户自定义 RPC 节点并注入 SDK</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="https://bsc-testnet.quiknode.pro/xxx..."
                  value={newRpcUrl}
                  onChange={(e) => setNewRpcUrl(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 text-xs font-mono outline-none focus:border-cyber-cyan"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="备注 (如: 我的归档节点)"
                  value={newRpcLabel}
                  onChange={(e) => setNewRpcLabel(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyber-cyan"
                />
              </div>
            </div>

            {/* Node Type Selector */}
            <div className="flex items-center space-x-4 text-xs pt-1 px-1">
              <span className="text-slate-400 font-medium">节点职责:</span>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="rpcNodeType"
                  checked={newRpcNodeType === "standard"}
                  onChange={() => setNewRpcNodeType("standard")}
                  className="text-cyber-cyan focus:ring-0"
                />
                <span className="text-blue-300">常规全节点 (供实时轮询与交易)</span>
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="rpcNodeType"
                  checked={newRpcNodeType === "archive"}
                  onChange={() => setNewRpcNodeType("archive")}
                  className="text-cyber-cyan focus:ring-0"
                />
                <span className="text-purple-300">归档节点 (供 24h 历史回溯)</span>
              </label>
            </div>

            {formError && (
              <div className="flex items-center space-x-1 text-[11px] text-rose-400 bg-rose-950/40 border border-rose-500/30 px-2.5 py-1.5 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="flex items-center space-x-1 text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                支持任意兼容 BSC 的 HTTP/HTTPS JSON-RPC 节点
              </span>
              <CyberButton
                type="submit"
                variant="cyan"
                size="sm"
                loading={isAdding}
                disabled={isAdding || !newRpcUrl.trim()}
              >
                <span>验证并注入</span>
              </CyberButton>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-cyber-cardInner/40 text-[11px] text-slate-400">
          <div className="flex items-center space-x-1 text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>配置自动保存至本地，无需重复输入</span>
          </div>
          <CyberButton variant="outline" size="sm" onClick={onClose}>
            <span>关闭</span>
          </CyberButton>
        </div>
      </div>
    </div>
  );
};
