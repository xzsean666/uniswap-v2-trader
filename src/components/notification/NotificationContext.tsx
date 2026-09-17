import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { TransactionToast, type ToastStatus } from "./TransactionToast";

export interface NotificationItem {
  status: ToastStatus;
  title: string;
  message?: string;
  txHash?: string;
}

export interface NotificationContextType {
  showNotification: (item: NotificationItem) => void;
  updateNotification: (item: Partial<NotificationItem>) => void;
  clearNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<NotificationItem | null>(null);

  const showNotification = useCallback((item: NotificationItem) => {
    setNotification(item);
  }, []);

  const updateNotification = useCallback((item: Partial<NotificationItem>) => {
    setNotification((prev) => (prev ? { ...prev, ...item } : null));
  }, []);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return (
    <NotificationContext.Provider
      value={{ showNotification, updateNotification, clearNotification }}
    >
      {children}
      {notification && (
        <TransactionToast
          status={notification.status}
          title={notification.title}
          message={notification.message}
          txHash={notification.txHash}
          onClose={clearNotification}
        />
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
};
