import { getMarkdown } from '@utils/markdown'
import MarkdownPage from '@components/MarkdownPage'

const TermsOfService = (props: any) => {
  return <MarkdownPage markdown={props.file} />
}

export async function getStaticProps() {
  const file = getMarkdown('terms-of-service')

  return { props: { file } }
}

export default TermsOfService
