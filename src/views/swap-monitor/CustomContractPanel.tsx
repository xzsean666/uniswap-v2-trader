import React from "react";
import { ShieldAlert, Terminal } from "lucide-react";
import { CyberSwitch } from "../../components/ui/CyberSwitch";
import { CyberCard } from "../../components/ui/CyberCard";

export interface CustomContractConfig {
  enabled: boolean;
  contractAddress: string;
  methodName: string;
}

export interface CustomContractPanelProps {
  config: CustomContractConfig;
  onChange: (config: CustomContractConfig) => void;
}

export const CustomContractPanel: React.FC<CustomContractPanelProps> = ({
  config,
  onChange,
}) => {
  return (
    <CyberCard className="space-y-3 bg-cyber-cardInner/50 border-slate-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-slate-200">
          <Terminal className="w-4 h-4 text-cyber-cyan" />
          <span className="font-semibold">使用自定义合约代理执行</span>
        </div>
        <CyberSwitch
          size="sm"
          checked={config.enabled}
          onChange={(enabled) => onChange({ ...config, enabled })}
        />
      </div>

      {config.enabled && (
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">
              自定义合约地址 <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={config.contractAddress}
              onChange={(e) =>
                onChange({ ...config, contractAddress: e.target.value })
              }
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-200 outline-none focus:border-cyber-cyan/60 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">
              调用方法名称
            </label>
            <input
              type="text"
              placeholder="swapExactTokensForTokens"
              value={config.methodName}
              onChange={(e) =>
                onChange({ ...config, methodName: e.target.value })
              }
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-200 outline-none focus:border-cyber-cyan/60 font-mono text-xs"
            />
          </div>

          <div className="flex items-start space-x-1.5 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-300">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              重要提示：开启自定义合约后，所有自动策略与反买反卖将通过该代理合约中转执行，请确保已授予流动性授权。
            </span>
          </div>
        </div>
      )}
    </CyberCard>
  );
};
