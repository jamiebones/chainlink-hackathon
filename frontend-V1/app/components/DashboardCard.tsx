'use client'
import React from 'react'

interface Props {
  title: string
  description: string
  icon?: React.ReactNode
  colorClass?: string // Tailwind color class for card bg/text
  onClick?: () => void
}

export default function DashboardCard({ title, description, icon, colorClass = '', onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className={`glassy-card p-7 flex flex-col gap-4 border border-white/10 transition-all duration-200 cursor-pointer group shadow-lg hover:shadow-2xl hover:scale-[1.025] focus:outline-none focus:ring-2 focus:ring-pink-400/40 ${colorClass}`}
      style={{
        fontFamily: 'Inter, sans-serif',
        minHeight: 220,
      }}
    >
      <div className="inline-flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full w-fit mb-2">
        {icon}
        <span className="font-semibold text-white group-hover:text-white/90 transition-all text-base">{title}</span>
      </div>
      <div className="text-lg font-medium text-white/80 group-hover:text-white transition-all">{description}</div>
    </div>
  )
}
