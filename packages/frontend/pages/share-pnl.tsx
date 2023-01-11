import Head from 'next/head'

const SharePnl = () => {
  return (
    <Head>
      <title>The post title</title>
      <meta property="og:image" content="/api/og?title=my post title" />
    </Head>
  )
}

export default SharePnl
