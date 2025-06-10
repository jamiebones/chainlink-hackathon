'use client';

import '@rainbow-me/rainbowkit/styles.css';
import {
  RainbowKitProvider,
  ConnectButton,
  getDefaultConfig,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import {arbitrum, arbitrumSepolia} from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ReturnType<typeof getDefaultConfig> | null>(null);
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    const config = getDefaultConfig({
      appName: 'sTSLA Hackathon App',
      projectId: 'e872ba5075a2eb7e208dcaeb0bd70e37',
      chains: [arbitrum, arbitrumSepolia],
      ssr: false,
    });
    setConfig(config);
  }, []);

  if (!config) return null;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <header className="w-full sticky top-0 z-50 bg-[#181A20] border-b border-white/10 shadow-sm">
            <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-4">
              <div className="flex items-center gap-10">
                <h1 className="text-2xl font-bold text-white tracking-tight">sTSLA Dashboard</h1>
                <nav className="flex gap-6">
                  <a href="#" className="text-white/80 hover:text-white px-3 py-2 rounded transition-colors font-medium">Trade</a>
                  <a href="#" className="text-white/80 hover:text-white px-3 py-2 rounded transition-colors font-medium">Portfolio</a>
                </nav>
              </div>
              <ConnectButton />
            </div>
          </header>
          <main className="bg-[#18181B] min-h-screen pt-4">
            {children}
          </main>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
