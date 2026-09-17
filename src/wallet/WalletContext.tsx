import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  BSC_TESTNET_CHAIN_ID,
  formatAddress,
  getInjectedProvider,
  getProviderChainId,
  parseChainId,
  requestAccounts,
  switchToBscTestnet,
  type EIP1193Provider,
} from "./ethereum";
import {
  buildSignInMessage,
  clearAuthSession,
  generateNonce,
  loadAuthSession,
  saveAuthSession,
  signLoginMessage,
  verifySignature,
  validateSessionTamperProof,
  type AuthSession,
} from "./auth";

export interface WalletContextState {
  address: string | null;
  formattedAddress: string;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  isBscTestnet: boolean;
  isAuthenticated: boolean;
  authSession: AuthSession | null;
  error: string | null;
  provider: EIP1193Provider | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToBsc: () => Promise<void>;
  signIn: () => Promise<boolean>;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextState | null>(null);

export interface WalletProviderProps {
  children: ReactNode;
  initialProvider?: EIP1193Provider | null;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({
  children,
  initialProvider,
}) => {
  const [provider, setProvider] = useState<EIP1193Provider | null>(
    initialProvider ?? null
  );
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize provider & cryptographically verify stored auth session
  useEffect(() => {
    let cancelled = false;

    async function initSessionAndAccounts() {
      const injected = initialProvider || getInjectedProvider();
      if (injected) {
        setProvider(injected);
        try {
          const currentChain = await getProviderChainId(injected);
          if (!cancelled) setChainId(currentChain);
        } catch {
          // ignore transient failure
        }
      }

      const saved = loadAuthSession();
      if (saved) {
        // Verify signature to prevent localStorage tampering
        const isValid = await validateSessionTamperProof(saved);
        if (!isValid) {
          clearAuthSession();
          if (!cancelled) {
            setAuthSession(null);
          }
          return;
        }

        // If provider is available, check if active account matches
        if (injected) {
          try {
            const accounts = (await injected.request({ method: "eth_accounts" })) as string[];
            if (accounts && accounts.length > 0) {
              const activeAddr = accounts[0].toLowerCase();
              if (activeAddr === saved.address.toLowerCase()) {
                if (!cancelled) {
                  setAuthSession(saved);
                  setAddress(saved.address);
                }
              } else {
                // User switched account in wallet extension
                clearAuthSession();
                if (!cancelled) {
                  setAddress(activeAddr);
                  setAuthSession(null);
                }
              }
              return;
            }
          } catch {
            // ignore
          }
        }

        if (!cancelled) {
          setAuthSession(saved);
          setAddress(saved.address);
        }
      }
    }

    initSessionAndAccounts();

    return () => {
      cancelled = true;
    };
  }, [initialProvider]);

  // Listen for accountsChanged and chainChanged
  useEffect(() => {
    if (!provider || !provider.on) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accList = accounts as string[];
      if (!accList || accList.length === 0) {
        setAddress(null);
        setAuthSession(null);
        clearAuthSession();
      } else {
        const nextAddr = accList[0].toLowerCase();
        setAddress(nextAddr);
        if (authSession && authSession.address.toLowerCase() !== nextAddr) {
          setAuthSession(null);
          clearAuthSession();
        }
      }
    };

    const handleChainChanged = (newChainIdHex: unknown) => {
      const parsed = parseChainId(newChainIdHex as string | number);
      setChainId(parsed);
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    return () => {
      if (provider.removeListener) {
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [provider, authSession]);

  const clearError = useCallback(() => setError(null), []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const currentProvider = provider || getInjectedProvider();
      if (!currentProvider) {
        throw new Error("未检测到 Web3 钱包插件，请安装 MetaMask / OKX / Rabby 钱包。");
      }
      setProvider(currentProvider);

      const accounts = await requestAccounts(currentProvider);
      if (accounts.length === 0) {
        throw new Error("用户未授权任何钱包账户。");
      }
      const userAddr = accounts[0];
      setAddress(userAddr);

      const currentChain = await getProviderChainId(currentProvider);
      setChainId(currentChain);
    } catch (err: any) {
      const msg = err?.message || "连接钱包失败";
      setError(msg);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [provider]);

  const switchToBsc = useCallback(async () => {
    if (!provider) {
      setError("未检测到有效钱包提供者");
      return;
    }
    setError(null);
    try {
      await switchToBscTestnet(provider);
      const nextChain = await getProviderChainId(provider);
      setChainId(nextChain);
    } catch (err: any) {
      const msg = err?.message || "切换至 BSC 测试网失败";
      setError(msg);
      throw err;
    }
  }, [provider]);

  const signIn = useCallback(async (): Promise<boolean> => {
    if (!provider || !address) {
      setError("请先连接钱包后再执行签名登录。");
      return false;
    }
    setError(null);
    try {
      const currentChainId = chainId ?? (await getProviderChainId(provider));
      const nonce = generateNonce();
      const timestamp = Date.now();
      const message = buildSignInMessage({
        address,
        chainId: currentChainId,
        nonce,
        timestamp,
      });

      const signature = await signLoginMessage(provider, address, message);
      const valid = await verifySignature({
        address: address as `0x${string}`,
        message,
        signature,
      });

      if (!valid) {
        throw new Error("EIP-191 签名校验失败！");
      }

      const session: AuthSession = {
        address: address as `0x${string}`,
        signature,
        message,
        timestamp,
        nonce,
      };

      setAuthSession(session);
      saveAuthSession(session);
      return true;
    } catch (err: any) {
      const msg = err?.message || "签名登录失败";
      setError(msg);
      return false;
    }
  }, [provider, address, chainId]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setAuthSession(null);
    clearAuthSession();
    setError(null);
  }, []);

  const isBscTestnet = chainId === BSC_TESTNET_CHAIN_ID;
  const isConnected = !!address;
  const isAuthenticated = !!authSession && authSession.address.toLowerCase() === address?.toLowerCase();
  const formattedAddress = formatAddress(address);

  return (
    <WalletContext.Provider
      value={{
        address,
        formattedAddress,
        chainId,
        isConnected,
        isConnecting,
        isBscTestnet,
        isAuthenticated,
        authSession,
        error,
        provider,
        connect,
        disconnect,
        switchToBsc,
        signIn,
        clearError,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextState => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
