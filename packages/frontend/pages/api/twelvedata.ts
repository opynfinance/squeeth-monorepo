import type { NextApiRequest, NextApiResponse } from 'next'

const TWELVE_DATA_API = 'https://api.twelvedata.com'

const handleRequest = async (req: NextApiRequest, res: NextApiResponse) => {
  const { path } = req.query
  const queryString = Object.keys(req.query).reduce((acc, key) => {
    if (key !== 'path') acc += `${key}=${req.query[key]}&`
    return acc
  }, '')

  if (!path) res.status(400).json({ status: 'error', message: 'Path parameter is missing' })

  const jsonResponse = await (
    await fetch(`${TWELVE_DATA_API}/${path}?${queryString}&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_APIKEY}`)
  ).json()
  res.status(200).json(jsonResponse)
}

export default handleRequest
