'use client'
import React from 'react'

interface Props {
  title: string
  description: string
  onClick?: () => void
}

export default function DashboardCard({ title, description, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        backgroundColor: '#2d004d', // deep dark purple
        border: '1px solid #5e2a84', // dark border
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 2px 6px rgba(255, 215, 0, 0.1)', // golden glow
        transition: 'all 0.2s ease-in-out',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.35)' // brighter golden on hover
        el.style.transform = 'translateY(-4px)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = '0 2px 6px rgba(255, 215, 0, 0.1)'
        el.style.transform = 'translateY(0px)'
      }}
    >
      <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#FFD700', marginBottom: '8px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '14px', color: '#f5e28c' }}>{description}</p>
    </div>
  )
}
