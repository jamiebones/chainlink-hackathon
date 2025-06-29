import { useEffect, useState } from 'react'
import { gql, request } from 'graphql-request'
import { useAccount } from 'wagmi'

const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/9399/vault/version/latest'

const QUERY = gql`
  query UserPositions($trader: Bytes!) {
    positions(where: { trader: $trader, isActive: true }) {
      id
      assetType
      mintedAmount
      bufferCollateral
      hedgedCollateral
      entryPrice
      positionIndex
      timestamp
      paidOut
    }
  }
`

export function useUserPositions() {
  const { address } = useAccount()
  const [positions, setPositions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) return
    const fetchPositions = async () => {
      setLoading(true)
      try {
        const data = await request(SUBGRAPH_URL, QUERY, { trader: address.toLowerCase() })

        const mapped = data.positions.map((p: any) => {
          const collateral = Number(p.bufferCollateral) / 1e6 + Number(p.hedgedCollateral) / 1e6
          const size = Number(p.mintedAmount) / 1e6
          const entryPrice = Number(p.entryPrice) / 1e18

          return {
            id: p.id,
            asset: p.assetType,
            direction: 'Long', // adjust if needed
            collateral,
            leverage: size / collateral || 1,
            size,
            entryPrice,
            currentPrice: entryPrice,
            pnl: 0, // placeholder
            pnlPercentage: '',
            fundingRate: 0
          }
        })

        setPositions(mapped)
      } catch (err) {
        console.error(err)
        setPositions([])
      }
      setLoading(false)
    }
    fetchPositions()
  }, [address])

  return { positions, loading }
}
