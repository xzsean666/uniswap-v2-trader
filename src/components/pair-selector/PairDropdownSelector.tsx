import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Search,
  ChevronDown,
  Sliders,
  Check,
  Plus,
  X,
} from "lucide-react";
import type { PairSubscription } from "../../storage/subscription-store";
import { getPairStrategySummary } from "../../strategies/strategy-store";
import { validatePairAddress } from "../../services/pair/pair-reader";
import { getPresetPairs } from "../../services/pair/pair-resolver";

export interface PairDropdownSelectorProps {
  subscriptions: PairSubscription[];
  activePairAddress?: string;
  onSelectPair: (pairAddress: string) => void;
  onAddNewPair?: (pairAddress: string) => Promise<void> | void;
  chainId?: number;
  className?: string;
}

export const PairDropdownSelector: React.FC<PairDropdownSelectorProps> = ({
  subscriptions,
  activePairAddress,
  onSelectPair,
  onAddNewPair,
  chainId = 97,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const activeSubscription = useMemo(() => {
    if (!activePairAddress) return null;
    return subscriptions.find(
      (s) => s.pairAddress.toLowerCase() === activePairAddress.toLowerCase()
    );
  }, [subscriptions, activePairAddress]);

  const activeStrategySummary = useMemo(() => {
    if (!activePairAddress) return null;
    return getPairStrategySummary(activePairAddress);
  }, [activePairAddress]);

  // Filter subscriptions based on search query
  const filteredSubscriptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return subscriptions;
    return subscriptions.filter((sub) => {
      const s0 = sub.token0Symbol.toLowerCase();
      const s1 = sub.token1Symbol.toLowerCase();
      const combined = `${s0}/${s1}`;
      const addr = sub.pairAddress.toLowerCase();
      return (
        s0.includes(q) ||
        s1.includes(q) ||
        combined.includes(q) ||
        addr.includes(q)
      );
    });
  }, [subscriptions, searchQuery]);

  // Preset pairs recommendation for search
  const matchingPresets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const presets = getPresetPairs(chainId);
    return presets.filter((p) => {
      const alreadyInSubs = subscriptions.some(
        (s) => s.pairAddress.toLowerCase() === p.pairAddress.toLowerCase()
      );
      if (alreadyInSubs) return false;
      const s0 = p.token0Symbol.toLowerCase();
      const s1 = p.token1Symbol.toLowerCase();
      const label = p.label.toLowerCase();
      const addr = p.pairAddress.toLowerCase();
      return (
        s0.includes(q) ||
        s1.includes(q) ||
        label.includes(q) ||
        addr.includes(q)
      );
    });
  }, [searchQuery, chainId, subscriptions]);

  // Check if search query is a valid new pair address
  const customAddressValid = useMemo(() => {
    const q = searchQuery.trim();
    if (!q.startsWith("0x") || q.length !== 42) return null;
    const validated = validatePairAddress(q);
    if (!validated.valid || !validated.checksummed) return null;
    const exists = subscriptions.some(
      (s) => s.pairAddress.toLowerCase() === validated.checksummed?.toLowerCase()
    );
    return exists ? null : validated.checksummed;
  }, [searchQuery, subscriptions]);

  const handleSelect = (pairAddress: string) => {
    onSelectPair(pairAddress);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleAddNewAddress = async (addr: string) => {
    if (onAddNewPair) {
      await onAddNewPair(addr);
    }
    handleSelect(addr);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        data-testid="pair-dropdown-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between p-3 rounded-xl bg-cyber-cardInner/95 border border-slate-700/80 hover:border-cyber-cyan transition-all text-left group shadow-sm"
      >
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <div className="p-1.5 rounded-lg bg-cyber-cyan/15 text-cyber-cyan shrink-0">
            <Sliders className="w-4 h-4" />
          </div>

          <div className="truncate">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400 font-medium">
                目标交易对:
              </span>
              <span className="font-mono font-bold text-sm text-white group-hover:text-cyber-cyan transition-colors">
                {activeSubscription
                  ? `${activeSubscription.token0Symbol} / ${activeSubscription.token1Symbol}`
                  : "选择目标 LP 交易对"}
              </span>
            </div>

            <div className="flex items-center space-x-2 pt-0.5">
              <span className="font-mono text-[10px] text-slate-500 truncate max-w-[130px] sm:max-w-[200px]">
                {activePairAddress || "点击下拉选择或搜索币对"}
              </span>

              {activeStrategySummary && (
                activeStrategySummary.hasActive ? (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>策略已开启 ({activeStrategySummary.details})</span>
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                    策略已关闭
                  </span>
                )
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0 pl-2">
          <span className="text-xs text-cyber-cyan font-medium hidden sm:inline">
            切换LP
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 group-hover:text-cyber-cyan transition-transform ${
              isOpen ? "rotate-180 text-cyber-cyan" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div
          data-testid="pair-dropdown-menu"
          className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-cyber-card border border-cyber-cyan/50 rounded-xl shadow-2xl shadow-cyan-950/60 backdrop-blur-md overflow-hidden animate-fadeIn"
        >
          {/* Search Box Input */}
          <div className="p-2.5 border-b border-slate-800 bg-slate-900/90">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5" />
              <input
                ref={inputRef}
                type="text"
                data-testid="pair-dropdown-search-input"
                placeholder="搜索代币符号 (如 USDT) 或输入 LP 地址 (0x...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 outline-none focus:border-cyber-cyan font-mono"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List of Pairs */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60">
            {/* Custom Address Match Option */}
            {customAddressValid && (
              <div
                onClick={() => handleAddNewAddress(customAddressValid)}
                className="p-2.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 cursor-pointer flex items-center justify-between text-xs transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Plus className="w-3.5 h-3.5 text-cyber-cyan" />
                  <div>
                    <div className="font-bold text-cyber-cyan">
                      添加并选择此新 LP 地址
                    </div>
                    <div className="font-mono text-[10px] text-slate-400">
                      {customAddressValid}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40">
                  一键导入
                </span>
              </div>
            )}

            {/* Subscribed pairs */}
            {filteredSubscriptions.map((sub) => {
              const isSelected =
                activePairAddress?.toLowerCase() === sub.pairAddress.toLowerCase();
              const summary = getPairStrategySummary(sub.pairAddress);

              return (
                <div
                  key={sub.pairAddress}
                  data-testid={`pair-option-${sub.pairAddress}`}
                  onClick={() => handleSelect(sub.pairAddress)}
                  className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-cyber-cyan/20 text-white"
                      : "hover:bg-slate-800/70 text-slate-300"
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    {isSelected ? (
                      <Check className="w-4 h-4 text-cyber-cyan shrink-0" />
                    ) : (
                      <div className="w-4 shrink-0" />
                    )}
                    <div className="truncate">
                      <div className="font-mono font-bold text-xs flex items-center space-x-1.5">
                        <span className="text-white">
                          {sub.token0Symbol} / {sub.token1Symbol}
                        </span>
                        <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          Pancake
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 truncate">
                        {sub.pairAddress}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 pl-2">
                    {summary.hasActive ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>已开启</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-500 border border-slate-700">
                        已关闭
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Matching Preset Pairs */}
            {matchingPresets.length > 0 && (
              <div className="p-2 bg-slate-950/80">
                <div className="text-[10px] text-amber-400 font-medium px-1 pb-1">
                  热门推荐币对 (未订阅):
                </div>
                {matchingPresets.map((preset) => (
                  <div
                    key={preset.pairAddress}
                    onClick={() => handleAddNewAddress(preset.pairAddress)}
                    className="p-1.5 rounded-lg hover:bg-slate-800/80 flex items-center justify-between cursor-pointer text-xs"
                  >
                    <div className="font-mono font-bold text-slate-200">
                      {preset.label}
                    </div>
                    <span className="text-[10px] text-cyber-cyan hover:underline flex items-center space-x-0.5">
                      <Plus className="w-3 h-3" />
                      <span>订阅并切换</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {filteredSubscriptions.length === 0 && !customAddressValid && matchingPresets.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-500">
                未找到匹配的交易对。可输入完整 LP 合约地址直接导入。
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
