import axios from 'axios'
import type { NextApiRequest, NextApiResponse } from 'next'

const SQUEETH_PORTAL_API = process.env.NEXT_PUBLIC_SQUEETH_PORTAL_BASE_URL

const handleRequest = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!SQUEETH_PORTAL_API) {
    res.status(400).json({ status: 'error', message: 'Error fetching information' })
    return
  }

  const jsonResponse = await axios.get(`${SQUEETH_PORTAL_API}/api/auction/getLastHedge`)
  res.status(200).json(jsonResponse.data)
}

export default handleRequest
