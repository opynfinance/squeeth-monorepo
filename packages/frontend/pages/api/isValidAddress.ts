import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

const handleRequest = async (req: NextApiRequest, res: NextApiResponse) => {
  const { address } = req.query

  try {
    const { data } = await axios.post(
      `https://api.chainalysis.com/api/kyt/v1/users/${address}/withdrawaladdresses`,
      [
        {
          network: 'Ethereum',
          asset: 'ETH',
          address,
        },
      ],
      { headers: { Token: process.env.NEXT_PUBLIC_AML_API_KEY ?? '' } },
    )

    res.status(200).json({ valid: (data?.[0]?.rating ?? 'highRisk') !== 'highRisk' })
  } catch (e) {
    res.status(200).json({ valid: false })
  }
}

export default handleRequest
