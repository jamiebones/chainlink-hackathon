'use client';

import '@rainbow-me/rainbowkit/styles.css';
import {
  RainbowKitProvider,
  ConnectButton,
  getDefaultConfig,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export default function Providers({ children }) {
  const [config, setConfig] = useState(null);
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    const config = getDefaultConfig({
      appName: 'sTSLA Hackathon App',
      projectId: 'e872ba5075a2eb7e208dcaeb0bd70e37',
      chains: [mainnet, sepolia],
      ssr: false, // 💡 Prevents indexedDB SSR error
    });
    setConfig(config);
  }, []);

  if (!config) return null; // Wait until client-only config is ready

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              padding: '20px 40px',
              backgroundColor: '#1a1a1a',
              borderBottom: '1px solid #333',
              gap: '20px',
            }}
          >
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#FFD700' }}>
              sTSLA Dashboard
            </h1>
            <ConnectButton />
          </div>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
