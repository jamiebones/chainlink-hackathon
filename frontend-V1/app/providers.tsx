'use client';

import '@rainbow-me/rainbowkit/styles.css';
import {
  RainbowKitProvider,
  ConnectButton,
  getDefaultConfig,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import {arbitrum, arbitrumSepolia, avalanche, avalancheFuji} from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ReactNode } from 'react';
import { ApolloProvider } from '@apollo/client';
import client from './lib/apolloClient'; 

// ✅ Define custom Fuji (Avalanche C-Chain Testnet)
export const fuji: Chain = {
  id: 43113,
  name: 'Avalanche Fuji',
  nativeCurrency: {
    name: 'Avalanche',
    symbol: 'AVAX',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://api.avax-test.network/ext/bc/C/rpc'],
    },
    public: {
      http: ['https://api.avax-test.network/ext/bc/C/rpc'],
    },
  },
  blockExplorers: {
    default: {
      name: 'SnowTrace',
      url: 'https://testnet.snowtrace.io/',
    },
  },
};

export default function Providers({ children }: { children: ReactNode }) {
  //const [config, setConfig] = useState<ReturnType<typeof getDefaultConfig> | null>(null);
  const [queryClient] = useState(() => new QueryClient());

 
    const config = getDefaultConfig({
      appName: 'sTSLA Hackathon App',
      projectId: 'e872ba5075a2eb7e208dcaeb0bd70e37',
      chains: [avalanche, avalancheFuji,arbitrum, arbitrumSepolia],
      ssr: false,
    });
   
 

  return (
    <ApolloProvider client={client}>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <header className="w-full sticky top-0 z-50 bg-[#111112] border-b border-white/10 shadow-sm">
            <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-4">
              <div className="flex items-center gap-10">
                <h1 className="text-2xl font-bold text-white tracking-tight">Synthetic Tokens Dashboard</h1>
                <nav className="flex gap-6">
                  <a href="#" className="text-white/80 hover:text-white px-3 py-2 rounded transition-colors font-medium">Trade</a>
                  <a href="#" className="text-white/80 hover:text-white px-3 py-2 rounded transition-colors font-medium">Portfolio</a>
                </nav>
              </div>
              <ConnectButton />
            </div>
          </header>
          <main className="bg-[#111112] min-h-screen pt-4">
            {children}
          </main>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
    </ApolloProvider>
  );
}
