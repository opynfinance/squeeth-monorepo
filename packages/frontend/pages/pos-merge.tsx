import { getMarkdown } from '@utils/markdown'
import MarkdownPage from '@components/MarkdownPage'
import DefaultSiteSeo from '@components/DefaultSiteSeo/DefaultSiteSeo'

const PosMerge = (props: any) => {
  return (
    <>
      <DefaultSiteSeo />
      <MarkdownPage markdown={props.file} />
    </>
  )
}

export async function getStaticProps() {
  const file = getMarkdown('pos-merge')

  return { props: { file } }
}

export default PosMerge
