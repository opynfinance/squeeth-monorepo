import { useQuery } from 'react-query'

export function useTVL() {
  const { data } = useQuery('tvl', async () => {
    if (!process.env.NEXT_PUBLIC_DEFILLAMA_ENDPOINT) return

    const data = await fetch(`${process.env.NEXT_PUBLIC_DEFILLAMA_ENDPOINT}/tvl/opyn`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    const tvl: any = await data.json()

    return Math.round(tvl / 1e6)
  })

  return data
}
