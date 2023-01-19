import { getMarkdown } from '@utils/markdown'
import MarkdownPage from '@components/MarkdownPage'

const PosMerge = (props: any) => {
  return <MarkdownPage markdown={props.file} />
}

export async function getStaticProps() {
  const file = getMarkdown('pos-merge')

  return { props: { file } }
}

export default PosMerge
