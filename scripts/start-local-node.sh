#!/usr/bin/env bash
set -e

# ==============================================================================
# 本地 Hardhat 交互开发节点一键启动脚本
# 用途: 启动本地链节点、自动完成代理合约部署并输出调试账号与合约信息
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACT_DIR="${CONTRACT_DIR:-/ssd0/git/uniswap-v2-trader-contract}"
PORT=8545
RPC_URL="http://127.0.0.1:${PORT}"

echo "========================================================"
echo "    Uniswap V2 Trader - 本地开发节点一键启动器          "
echo "========================================================"

if [ ! -d "${CONTRACT_DIR}" ]; then
  echo "❌ 错误: 未找到合约仓库目录: ${CONTRACT_DIR}"
  exit 1
fi

check_node_ready() {
  curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    "${RPC_URL}" 2>/dev/null | grep -q "result"
}

if check_node_ready; then
  echo "ℹ️  端口 ${PORT} 已有运行中的本地节点"
else
  echo "🚀 正在启动 Hardhat 本地节点 (Chain ID: 31337)..."
  (cd "${CONTRACT_DIR}" && pnpm hardhat node) &
  NODE_PID=$!

  cleanup() {
    echo ""
    echo "🧹 正在关闭 Hardhat 本地节点 (PID: ${NODE_PID})..."
    kill "$NODE_PID" 2>/dev/null || true
    wait "$NODE_PID" 2>/dev/null || true
    echo "✅ 节点已安全退出"
  }
  trap cleanup EXIT INT TERM

  WAIT_COUNT=0
  until check_node_ready; do
    sleep 0.5
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ "$WAIT_COUNT" -ge 30 ]; then
      echo "❌ 错误: 节点启动超时"
      exit 1
    fi
  done
fi

echo ""
echo "📦 正在自动向 localhost 网络部署代理合约与 Mock 路由..."
(cd "${CONTRACT_DIR}" && pnpm hardhat run scripts/deploy.ts --network localhost)

echo ""
echo "========================================================"
echo "🎯 本地联调环境已就绪！"
echo "========================================================"
echo "  RPC URL:             ${RPC_URL}"
echo "  Chain ID:            31337"
echo "  ProxyTrader 合约:    0xe7f1725e7734ce288f8367e1bb143e90bb3f0512"
echo "  Mock Router 路由:    0x5fbdb2315678afecb367f032d93f642f64180aa3"
echo "--------------------------------------------------------"
echo "  MetaMask 测试主钱包 (Account #1, 拥有 10000 ETH):"
echo "  地址:  0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
echo "  私钥:  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
echo "========================================================"
echo "按 Ctrl + C 可随时安全退出并停止本地节点。"
echo ""

if [ -n "$NODE_PID" ]; then
  wait "$NODE_PID"
fi
