import { getMarkdown } from '@utils/markdown'
import MarkdownPage from '@components/MarkdownPage'
import SiteSeo from '@components/SiteSeo'

const TermsOfServiceFAQ = (props: any) => {
  return (
    <>
      <SiteSeo />
      <MarkdownPage markdown={props.file} />
    </>
  )
}

export async function getStaticProps() {
  const file = getMarkdown('terms-of-service-faq')

  return { props: { file } }
}

export default TermsOfServiceFAQ
