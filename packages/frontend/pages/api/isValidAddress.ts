import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

const handleRequest = async (req: NextApiRequest, res: NextApiResponse) => {
  const { address } = req.query

  const { data } = await axios.post(
    `https://api.chainalysis.com/api/kyt/v1/users/${address}/withdrawaladdresses`,
    {
      network: 'Ethereum',
      asset: 'ETH',
      address,
    },
    { headers: { Token: '42a447a56771499cc025e34114faf46df3b69019dcdf0a43039b677f98be648d' } },
  )

  res.status(200).json({ valid: (data?.[0]?.rating ?? 'highRisk') === 'highRisk' })
}

export default handleRequest
