import { getMarkdown } from '@utils/markdown'
import MarkdownPage from '@components/MarkdownPage'
import SiteSeo from '@components/SiteSeo'

const PosMerge = (props: any) => {
  return (
    <>
      <SiteSeo />
      <MarkdownPage markdown={props.file} />
    </>
  )
}

export async function getStaticProps() {
  const file = getMarkdown('pos-merge')

  return { props: { file } }
}

export default PosMerge
