import { useQuery } from 'react-query'

export function useTVL() {
  const { data } = useQuery('tvl', async () => {
    const tvlResponse = await fetch('/api/tvl', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!tvlResponse.ok) {
      throw new Error('Network response was not ok')
    }

    const tvl = await tvlResponse.json()
    return Math.round(tvl / 1e6)
  })

  return data
}
