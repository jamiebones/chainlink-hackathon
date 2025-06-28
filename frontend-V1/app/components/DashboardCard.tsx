import React from 'react'

export default function DashboardCard({ title, description, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full h-full p-8 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/10 shadow-xl hover:shadow-2xl hover:bg-white/15 transition-all duration-200 outline-none focus:ring-2 focus:ring-pink-400/40 flex flex-col gap-4 items-start"
      style={{
        minHeight: 215,
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="font-semibold text-white text-lg">{title}</span>
      </div>
      <div className="text-base font-medium text-white/80">{description}</div>
    </button>
  )
}
