import { getMarkdown } from '@utils/markdown'
import MarkdownPage from '@components/MarkdownPage'
import DefaultSiteSeo from '@components/DefaultSiteSeo/DefaultSiteSeo'

const TermsOfServiceFAQ = (props: any) => {
  return (
    <>
      <DefaultSiteSeo />
      <MarkdownPage markdown={props.file} />
    </>
  )
}

export async function getStaticProps() {
  const file = getMarkdown('terms-of-service-faq')

  return { props: { file } }
}

export default TermsOfServiceFAQ
