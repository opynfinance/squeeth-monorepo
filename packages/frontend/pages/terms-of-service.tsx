import { getMarkdown } from '@utils/markdown'
import MarkdownPage from '@components/MarkdownPage'
import DefaultSiteSeo from '@components/DefaultSiteSeo/DefaultSiteSeo'

const TermsOfService = (props: any) => {
  return (
    <>
      <DefaultSiteSeo />
      <MarkdownPage markdown={props.file} />
    </>
  )
}

export async function getStaticProps() {
  const file = getMarkdown('terms-of-service')

  return { props: { file } }
}

export default TermsOfService
