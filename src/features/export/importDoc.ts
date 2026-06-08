import { db } from '@/data/db'
import { createProject } from '@/data/repo'
import { docToText, countWords } from '@/lib/text'
import type { DocContent, LanguageCode, Project } from '@/types'

function para(text: string): DocContent {
  return { type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }
}
function heading(level: number, text: string): DocContent {
  return { type: 'heading', attrs: { level: Math.min(4, level) }, content: [{ type: 'text', text }] }
}

/** Plain text → blocks (blank-line separated paragraphs). */
function textToBlocks(text: string): DocContent[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => para(chunk.replace(/\n/g, ' ')))
}

/** Markdown → blocks (headings, quotes, lists, paragraphs — block level). */
function markdownToBlocks(md: string): DocContent[] {
  const blocks: DocContent[] = []
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  let listItems: string[] = []
  let ordered = false
  const flushList = () => {
    if (!listItems.length) return
    blocks.push({
      type: ordered ? 'orderedList' : 'bulletList',
      content: listItems.map((t) => ({ type: 'listItem', content: [para(t)] })),
    })
    listItems = []
  }
  let buffer: string[] = []
  const flushPara = () => {
    if (buffer.length) {
      blocks.push(para(buffer.join(' ').trim()))
      buffer = []
    }
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      flushPara()
      flushList()
      blocks.push(heading(h[1].length, h[2]))
      continue
    }
    if (/^>\s+/.test(line)) {
      flushPara()
      flushList()
      blocks.push({ type: 'blockquote', content: [para(line.replace(/^>\s+/, ''))] })
      continue
    }
    const li = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/)
    if (li) {
      flushPara()
      ordered = /\d+\./.test(li[2])
      listItems.push(li[3])
      continue
    }
    if (line.trim() === '') {
      flushPara()
      flushList()
    } else {
      flushList()
      buffer.push(line.replace(/\*\*|__|\*|_|`/g, ''))
    }
  }
  flushPara()
  flushList()
  return blocks.length ? blocks : [para('')]
}

/** DOCX (via mammoth) → blocks. */
async function docxToBlocks(file: File): Promise<DocContent[]> {
  const mod = (await import('mammoth')) as unknown as { default?: { convertToHtml: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }; convertToHtml?: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }
  const mammoth = mod.default ?? mod
  const arrayBuffer = await file.arrayBuffer()
  const { value: html } = await mammoth.convertToHtml!({ arrayBuffer })
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks: DocContent[] = []
  doc.body.childNodes.forEach((node) => {
    if (node.nodeType !== 1) return
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    const text = el.textContent?.trim() ?? ''
    if (/^h[1-6]$/.test(tag)) blocks.push(heading(Number(tag[1]), text))
    else if (tag === 'blockquote') blocks.push({ type: 'blockquote', content: [para(text)] })
    else if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(el.querySelectorAll('li')).map((li) => ({ type: 'listItem', content: [para(li.textContent?.trim() ?? '')] }))
      if (items.length) blocks.push({ type: tag === 'ol' ? 'orderedList' : 'bulletList', content: items })
    } else if (text) blocks.push(para(text))
  })
  return blocks.length ? blocks : [para('')]
}

export type ImportableExt = 'txt' | 'md' | 'markdown' | 'docx'

/** Import a .txt/.md/.docx file as a new manuscript project. */
export async function importDocumentFile(file: File, language: LanguageCode = 'en'): Promise<Project> {
  const name = file.name.replace(/\.[^.]+$/, '')
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  let blocks: DocContent[]
  if (ext === 'docx') blocks = await docxToBlocks(file)
  else if (ext === 'md' || ext === 'markdown') blocks = markdownToBlocks(await file.text())
  else blocks = textToBlocks(await file.text())

  const project = await createProject({ title: name || 'Imported', type: 'manuscript', language })
  const nodes = await db.nodes.where('projectId').equals(project.id).toArray()
  const scene = nodes.find((n) => n.type === 'scene')
  if (scene) {
    const content: DocContent = { type: 'doc', content: blocks }
    const text = docToText(content)
    await db.nodes.update(scene.id, { title: 'Imported text', content, text, wordCount: countWords(text) })
  }
  return project
}
