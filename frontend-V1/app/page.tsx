// app/page.tsx or app/home/page.tsx
'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import React from 'react'
import DashboardCard from '@/components/DashboardCard'
import { useRouter } from 'next/navigation'
import StockTable from '@/components/StockTable'

export default function Home() {
  const router = useRouter()

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 20px' }}>
      <h2 style={{ fontSize: '24px', color: '#FFD700', marginBottom: '16px' }}>
        Start your journey with us ....
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px',
        }}
      >
        <DashboardCard
          title="Mint"
          description="Deposit USDC to mint sTSLA"
          onClick={() => router.push('/mint')}
        />
        <DashboardCard
          title="Trade"
          description="Open long/short positions on sTSLA"
          onClick={() => router.push('/trade')}
        />
        <DashboardCard
          title="Provide Liquidity"
          description="Stake to Perp Engine to earn fees"
          onClick={() => router.push('/liquidity')}
        />
        <DashboardCard
          title="Sweep Vault Slot"
          description="Withdraw buffer + PnL from closed positions"
          onClick={() => router.push('/sweep')}
        />
      </div>
      <StockTable/>
    </div>
  )
}