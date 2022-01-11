import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const markdownDir = path.join(process.cwd(), 'src/markdown')

export function getMarkdown(file: string) {
  const filePath = path.join(markdownDir, `${file}.md`)
  const fileContents = fs.readFileSync(filePath, 'utf8')
  const markdownData = matter(fileContents)

  return markdownData.content
}
