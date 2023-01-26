import axios from 'axios'
import type { NextApiRequest, NextApiResponse } from 'next'

const ETHERSCAN_API = 'https://api.etherscan.io'

const handleRequest = async (req: NextApiRequest, res: NextApiResponse) => {
  const { timestamp } = req.query
  // eslint-disable-next-line  no-undef
  console.log('timestamp', timestamp)
  const resp = await fetch(
    `${ETHERSCAN_API}/api?module=block&action=getblocknobytime&timestamp=${Number(timestamp).toFixed(
      0,
    )}&closest=before&apikey=${process.env.ETHERSCAN_API_KEY}`,
  )
  const data = await resp.json()
  console.log('data', data)
  if (data.status === '1') {
    return res.status(200).json({ blockNumber: Number(data.result) })
  } else {
    return res.status(200).json({ blockNumber: 0 })
  }
}

export default handleRequest
