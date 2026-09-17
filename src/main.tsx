import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { WalletProvider } from "./wallet/WalletContext";
import { NotificationProvider } from "./components/notification/NotificationContext";
import { ActivePairProvider } from "./context/ActivePairContext";
import { KeeperProvider } from "./context/KeeperContext";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <WalletProvider>
      <NotificationProvider>
        <ActivePairProvider>
          <KeeperProvider>
            <App />
          </KeeperProvider>
        </ActivePairProvider>
      </NotificationProvider>
    </WalletProvider>
  </React.StrictMode>,
);

