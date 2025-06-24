'use client'
import { usePrivateTradeHpke } from "../hooks/usePrivateTradeHpke"
export default function PrivatePage() {
    const sendTrade = usePrivateTradeHpke();

  async function handleClick() {
    await sendTrade(0, 5n * 10n ** 18n, 1_000_000n);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111112] relative overflow-hidden">
      {/* Blurred colored balls for Uniswap-style background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-pink-500 opacity-30 blur-3xl rounded-full" />
        <div className="absolute top-2/3 left-2/3 w-40 h-40 bg-yellow-400 opacity-20 blur-3xl rounded-full" />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-blue-400 opacity-20 blur-3xl rounded-full" />
        <div className="absolute top-1/3 left-2/3 w-36 h-36 bg-green-400 opacity-20 blur-3xl rounded-full" />
      </div>
       <button
        onClick={handleClick}
        style={{ backgroundColor: '#FF007A', color: 'white', padding: '8px 16px', border: 'none', borderRadius: 4 }}
      >
        Send Private Order
      </button>
      
    </div>
  )
}