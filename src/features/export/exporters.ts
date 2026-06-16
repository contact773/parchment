import { saveBlob, type FileFilter } from '@/lib/desktop'
import type { Character, Location, PlotThread, Project, TreeNode, WorldElement, WorldMap } from '@/types'
import { buildManuscript, type Block, type Run, type CompileScope } from './blocks'
import { PROJECT_TYPES, CHARACTER_ROLES, PLOT_THREAD_STATUSES, WORLD_CATEGORIES } from '@/lib/constants'

export type ExportFormat = 'markdown' | 'text' | 'html' | 'json' | 'docx' | 'pdf' | 'fountain' | 'epub'

export interface ExportBundle {
  project: Project
  nodes: TreeNode[]
  characters: Character[]
  locations: Location[]
  threads: PlotThread[]
  worldElements?: WorldElement[]
  maps?: WorldMap[]
  /** Which documents to compile (set by runExport). Defaults to 'manuscript'. */
  scope?: CompileScope
  /** Append a "Story Bible" (characters/locations/threads/world) to the output. */
  includeCodex?: boolean
}

// ── Story bible / codex ──────────────────────────────────────────────────────
interface CodexField { label: string; value: string }
interface CodexEntry { title: string; subtitle?: string; fields: CodexField[] }
interface CodexSection { heading: string; entries: CodexEntry[] }

function buildCodex(bundle: ExportBundle): CodexSection[] {
  const sections: CodexSection[] = []
  const fld = (label: string, value?: string | null): CodexField[] =>
    value && String(value).trim() ? [{ label, value: String(value).trim() }] : []
  const charName = (id: string) => bundle.characters.find((c) => c.id === id)?.name ?? 'Unknown'

  if (bundle.characters.length) {
    sections.push({
      heading: 'Characters',
      entries: bundle.characters.map((c) => ({
        title: c.name,
        subtitle: CHARACTER_ROLES[c.role]?.label,
        fields: [
          ...fld('Aliases', c.aliases),
          ...fld('Summary', c.summary),
          ...fld('Goal', c.goal),
          ...fld('Motivation', c.motivation),
          ...fld('Conflict', c.conflict),
          ...fld('Arc', c.arc),
          ...fld('Voice', c.voice),
          ...fld('Appearance', c.appearance),
          ...fld('Backstory', c.backstory),
          ...((c.relationships ?? []).length
            ? [{ label: 'Relationships', value: (c.relationships ?? []).map((r) => `${r.label} ${charName(r.targetId)}`).join('; ') }]
            : []),
          ...fld('Notes', c.notes),
        ],
      })),
    })
  }
  if (bundle.locations.length) {
    sections.push({
      heading: 'Locations',
      entries: bundle.locations.map((l) => ({
        title: l.name,
        subtitle: l.kind || undefined,
        fields: [...fld('Description', l.description), ...fld('Atmosphere', l.atmosphere), ...fld('Significance', l.significance), ...fld('Notes', l.notes)],
      })),
    })
  }
  if (bundle.threads.length) {
    sections.push({
      heading: 'Plot threads',
      entries: bundle.threads.map((t) => ({ title: t.name, subtitle: PLOT_THREAD_STATUSES[t.status]?.label, fields: [...fld('Description', t.description)] })),
    })
  }
  const world = bundle.worldElements ?? []
  if (world.length) {
    sections.push({
      heading: 'Worldbuilding',
      entries: world.map((w) => ({ title: w.name, subtitle: WORLD_CATEGORIES[w.category]?.label, fields: [...fld('Summary', w.summary), ...fld('Details', w.details), ...fld('Rules', w.rules)] })),
    })
  }
  return sections
}

function codexMd(bundle: ExportBundle): string {
  const secs = buildCodex(bundle)
  if (!secs.length) return ''
  const out: string[] = ['', '---', '', '# Story Bible', '']
  for (const s of secs) {
    out.push(`## ${s.heading}`, '')
    for (const e of s.entries) {
      out.push(`### ${e.title}${e.subtitle ? ` — _${e.subtitle}_` : ''}`, '')
      for (const f of e.fields) out.push(`- **${f.label}:** ${f.value.replace(/\n+/g, ' ')}`)
      out.push('')
    }
  }
  return out.join('\n')
}

function codexText(bundle: ExportBundle): string {
  const secs = buildCodex(bundle)
  if (!secs.length) return ''
  const out: string[] = ['', '', 'STORY BIBLE', '===========', '']
  for (const s of secs) {
    out.push('', s.heading.toUpperCase(), '-'.repeat(s.heading.length), '')
    for (const e of s.entries) {
      out.push(e.subtitle ? `${e.title} (${e.subtitle})` : e.title)
      for (const f of e.fields) out.push(`  ${f.label}: ${f.value.replace(/\n+/g, ' ')}`)
      out.push('')
    }
  }
  return out.join('\n')
}

function codexHtml(bundle: ExportBundle): string {
  const secs = buildCodex(bundle)
  if (!secs.length) return ''
  const parts: string[] = ['<hr/>', '<h1>Story Bible</h1>']
  for (const s of secs) {
    parts.push(`<h2>${esc(s.heading)}</h2>`)
    for (const e of s.entries) {
      parts.push(`<h3>${esc(e.title)}${e.subtitle ? ` <em style="font-weight:400;color:#777">— ${esc(e.subtitle)}</em>` : ''}</h3>`)
      for (const f of e.fields) parts.push(`<p style="text-indent:0;margin:0 0 .35rem"><strong>${esc(f.label)}:</strong> ${esc(f.value).replace(/\n/g, '<br/>')}</p>`)
    }
  }
  return parts.join('\n')
}

export const EXPORT_FORMATS: { id: ExportFormat; label: string; desc: string; ext: string }[] = [
  { id: 'docx', label: 'Word (.docx)', desc: 'The submission standard. Opens in Word, Pages, Docs.', ext: 'docx' },
  { id: 'pdf', label: 'PDF / Print', desc: 'Formatted, printable manuscript.', ext: 'pdf' },
  { id: 'markdown', label: 'Markdown (.md)', desc: 'Portable plain-text with formatting.', ext: 'md' },
  { id: 'text', label: 'Plain text (.txt)', desc: 'Just the words.', ext: 'txt' },
  { id: 'html', label: 'HTML (.html)', desc: 'Styled web page.', ext: 'html' },
  { id: 'fountain', label: 'Fountain (.fountain)', desc: 'Screenplay interchange format.', ext: 'fountain' },
  { id: 'epub', label: 'ePub (.epub)', desc: 'E-reader format (foundation).', ext: 'epub' },
  { id: 'json', label: 'Backup (.json)', desc: 'Full project backup you can re-import.', ext: 'json' },
]

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project'
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ── Run renderers ──────────────────────────────────────────────────────────
const runsText = (runs: Run[]) => runs.map((r) => r.text).join('')

function runsMd(runs: Run[]): string {
  return runs
    .map((r) => {
      let t = r.text
      if (!t.trim()) return t
      if (r.code) t = `\`${t}\``
      if (r.bold) t = `**${t}**`
      if (r.italic) t = `*${t}*`
      if (r.strike) t = `~~${t}~~`
      return t
    })
    .join('')
}

function runsHtml(runs: Run[]): string {
  return runs
    .map((r) => {
      let t = esc(r.text).replace(/\n/g, '<br/>')
      if (r.code) t = `<code>${t}</code>`
      if (r.strike) t = `<s>${t}</s>`
      if (r.underline) t = `<u>${t}</u>`
      if (r.italic) t = `<em>${t}</em>`
      if (r.bold) t = `<strong>${t}</strong>`
      return t
    })
    .join('')
}

// ── Markdown ─────────────────────────────────────────────────────────────
function blocksMd(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case 'heading':
          return `${'#'.repeat(b.level)} ${runsMd(b.runs)}`
        case 'paragraph':
          return runsMd(b.runs)
        case 'blockquote':
          return `> ${runsMd(b.runs)}`
        case 'hr':
          return '* * *'
        case 'code':
          return '```\n' + b.text + '\n```'
        case 'list':
          return b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : '-'} ${runsMd(it)}`).join('\n')
      }
    })
    .join('\n\n')
}

function toMarkdown(bundle: ExportBundle): string {
  const { project } = bundle
  const items = buildManuscript(bundle.nodes, bundle.scope ?? 'manuscript')
  const head = [`# ${project.title}`, project.author ? `_by ${project.author}_` : '', project.logline ? `> ${project.logline}` : '', '', '---', ''].filter((x) => x !== undefined).join('\n')
  const body = items
    .map((it) => {
      const parts: string[] = []
      if (it.sceneBreakBefore) parts.push('* * *')
      if (it.heading) parts.push(`${'#'.repeat(it.heading.level)} ${it.heading.title}`)
      const bm = blocksMd(it.blocks)
      if (bm.trim()) parts.push(bm)
      return parts.join('\n\n')
    })
    .filter((x) => x.trim())
    .join('\n\n')
  return `${head}\n${body}\n${bundle.includeCodex ? codexMd(bundle) : ''}`
}

// ── Plain text ───────────────────────────────────────────────────────────
function toPlainText(bundle: ExportBundle): string {
  const items = buildManuscript(bundle.nodes, bundle.scope ?? 'manuscript')
  const lines: string[] = [bundle.project.title.toUpperCase()]
  if (bundle.project.author) lines.push(`by ${bundle.project.author}`)
  lines.push('', '')
  for (const it of items) {
    if (it.sceneBreakBefore) lines.push('', '          #', '')
    if (it.heading) lines.push('', it.heading.title.toUpperCase(), '')
    for (const b of it.blocks) {
      if (b.kind === 'hr') lines.push('          #')
      else if (b.kind === 'list') b.items.forEach((i) => lines.push(`  • ${runsText(i)}`))
      else if (b.kind === 'code') lines.push(b.text)
      else lines.push(runsText(b.runs))
      lines.push('')
    }
  }
  if (bundle.includeCodex) lines.push(codexText(bundle))
  return lines.join('\n')
}

// ── HTML (also used for PDF print) ───────────────────────────────────────
function blocksHtml(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case 'heading':
          return `<h${b.level}>${runsHtml(b.runs)}</h${b.level}>`
        case 'paragraph': {
          const cls = b.script ? ` class="script ${b.script}"` : ''
          const style = b.align && b.align !== 'left' ? ` style="text-align:${b.align}"` : ''
          return `<p${cls}${style}>${runsHtml(b.runs) || '&nbsp;'}</p>`
        }
        case 'blockquote':
          return `<blockquote>${runsHtml(b.runs)}</blockquote>`
        case 'hr':
          return '<hr/>'
        case 'code':
          return `<pre><code>${esc(b.text)}</code></pre>`
        case 'list':
          return `<${b.ordered ? 'ol' : 'ul'}>${b.items.map((i) => `<li>${runsHtml(i)}</li>`).join('')}</${b.ordered ? 'ol' : 'ul'}>`
      }
    })
    .join('\n')
}

function bodyHtml(bundle: ExportBundle): string {
  const items = buildManuscript(bundle.nodes, bundle.scope ?? 'manuscript')
  return items
    .map((it) => {
      const parts: string[] = []
      if (it.sceneBreakBefore) parts.push('<hr class="scene"/>')
      if (it.heading) parts.push(`<h${it.heading.level}>${esc(it.heading.title)}</h${it.heading.level}>`)
      parts.push(blocksHtml(it.blocks))
      return parts.join('\n')
    })
    .join('\n')
}

const PRINT_CSS = `
  :root { color-scheme: light; }
  body { font-family: 'Iowan Old Style', Georgia, serif; max-width: 42rem; margin: 3rem auto; padding: 0 1.5rem;
         line-height: 1.7; color: #1c1a17; }
  h1,h2,h3 { font-family: Georgia, serif; line-height: 1.25; }
  h1 { font-size: 2rem; margin: 2rem 0 1rem; }
  h2 { font-size: 1.5rem; margin: 2.4rem 0 0.8rem; }
  h3 { font-size: 1.2rem; }
  p { margin: 0 0 0.2rem; text-indent: 1.6em; }
  p:first-of-type, h1+p, h2+p, h3+p, hr+p { text-indent: 0; }
  blockquote { border-left: 3px solid #ccc; padding-left: 1rem; font-style: italic; color: #444; }
  hr { border: none; text-align: center; margin: 1.6rem 0; }
  hr::before { content: '⁂'; letter-spacing: .4em; color: #999; }
  hr.scene { margin: 1.4rem 0; }
  .title-page { text-align: center; margin: 6rem 0 4rem; }
  .title-page h1 { font-size: 2.6rem; }
  .title-page .author { color: #555; font-size: 1.1rem; margin-top: 1rem; }
  p.script { text-indent: 0; }
  p.script.character { text-transform: uppercase; margin-left: 38%; font-weight: 600; margin-top: 1rem; }
  p.script.dialogue { margin: 0 22%; }
  p.script.parenthetical { margin: 0 28% 0 30%; font-style: italic; }
  p.script.scene-heading { text-transform: uppercase; font-weight: 700; margin-top: 1.4rem; }
  p.script.transition { text-transform: uppercase; text-align: right; font-weight: 600; }
  @media print { body { margin: 0; max-width: none; } @page { margin: 1in; } }
`

function toHTML(bundle: ExportBundle): string {
  const { project } = bundle
  return `<!doctype html>
<html lang="${project.language}"><head><meta charset="utf-8"/>
<title>${esc(project.title)}</title><style>${PRINT_CSS}</style></head>
<body>
<div class="title-page">
  <h1>${esc(project.title)}</h1>
  ${project.author ? `<div class="author">by ${esc(project.author)}</div>` : ''}
  ${project.logline ? `<p style="text-indent:0;font-style:italic;margin-top:2rem">${esc(project.logline)}</p>` : ''}
</div>
${bodyHtml(bundle)}
${bundle.includeCodex ? codexHtml(bundle) : ''}
</body></html>`
}

// ── Fountain (screenplay) ────────────────────────────────────────────────
function toFountain(bundle: ExportBundle): string {
  const items = buildManuscript(bundle.nodes, bundle.scope ?? 'manuscript')
  const out: string[] = [`Title: ${bundle.project.title}`, `Author: ${bundle.project.author ?? ''}`, '', '====', '']
  for (const it of items) {
    for (const b of it.blocks) {
      if (b.kind !== 'paragraph') {
        if (b.kind === 'heading') out.push('', `# ${runsText(b.runs)}`, '')
        continue
      }
      const text = runsText(b.runs).trim()
      if (!text) {
        out.push('')
        continue
      }
      switch (b.script) {
        case 'scene-heading':
          out.push('', text.toUpperCase())
          break
        case 'character':
          out.push('', text.toUpperCase())
          break
        case 'parenthetical':
          out.push(`(${text.replace(/^\(|\)$/g, '')})`)
          break
        case 'dialogue':
          out.push(text)
          break
        case 'transition':
          out.push('', `> ${text.toUpperCase()}`)
          break
        case 'shot':
          out.push('', text.toUpperCase())
          break
        default:
          out.push('', text)
      }
    }
  }
  return out.join('\n')
}

// ── DOCX (docx lib is loaded on demand to keep the main bundle small) ──────
async function toDocxBlob(bundle: ExportBundle): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx')
  const headingFor = (level: 1 | 2 | 3) =>
    level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3

  const runsToDocx = (runs: Run[]): InstanceType<typeof TextRun>[] => {
    if (!runs.length) return [new TextRun('')]
    return runs.map(
      (r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic, underline: r.underline ? {} : undefined, strike: r.strike }),
    )
  }

  const blocksToDocx = (blocks: Block[], scene: boolean): InstanceType<typeof Paragraph>[] => {
    const paras: InstanceType<typeof Paragraph>[] = []
    if (scene) paras.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 }, children: [new TextRun('⁂')] }))
    for (const b of blocks) {
      switch (b.kind) {
        case 'heading':
          paras.push(new Paragraph({ heading: headingFor(b.level), children: runsToDocx(b.runs) }))
          break
        case 'paragraph':
          paras.push(new Paragraph({ children: runsToDocx(b.runs) }))
          break
        case 'blockquote':
          paras.push(new Paragraph({ indent: { left: 720 }, children: runsToDocx(b.runs) }))
          break
        case 'hr':
          paras.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('⁂')] }))
          break
        case 'code':
          paras.push(new Paragraph({ children: [new TextRun({ text: b.text, font: 'Consolas' })] }))
          break
        case 'list':
          b.items.forEach((it) => paras.push(new Paragraph({ bullet: b.ordered ? undefined : { level: 0 }, children: runsToDocx(it) })))
          break
      }
    }
    return paras
  }

  const { project } = bundle
  const items = buildManuscript(bundle.nodes, bundle.scope ?? 'manuscript')
  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 240 }, children: [new TextRun({ text: project.title, bold: true, size: 56 })] }),
  ]
  if (project.author) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `by ${project.author}`, size: 28 })] }))
  children.push(new Paragraph({ pageBreakBefore: true, children: [] }))

  for (const it of items) {
    if (it.heading) children.push(new Paragraph({ heading: headingFor(it.heading.level), children: [new TextRun(it.heading.title)] }))
    children.push(...blocksToDocx(it.blocks, it.sceneBreakBefore))
  }

  if (bundle.includeCodex) {
    const secs = buildCodex(bundle)
    if (secs.length) {
      children.push(new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [new TextRun('Story Bible')] }))
      for (const s of secs) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(s.heading)] }))
        for (const e of s.entries) {
          children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(e.subtitle ? `${e.title} — ${e.subtitle}` : e.title)] }))
          for (const f of e.fields) children.push(new Paragraph({ children: [new TextRun({ text: `${f.label}: `, bold: true }), new TextRun(f.value)] }))
        }
      }
    }
  }

  const doc = new Document({ creator: 'Parchment', title: project.title, sections: [{ children }] })
  return Packer.toBlob(doc)
}

// ── EPUB (foundation: valid single-spine epub) ───────────────────────────
async function toEpubBlob(bundle: ExportBundle): Promise<Blob> {
  const JSZip = (await import('jszip')).default
  const { project } = bundle
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  )
  const content = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${project.language}"><head>
<meta charset="utf-8"/><title>${esc(project.title)}</title><link rel="stylesheet" href="style.css"/></head>
<body>${bodyHtml(bundle)}${bundle.includeCodex ? codexHtml(bundle) : ''}</body></html>`
  zip.file('OEBPS/content.xhtml', content)
  zip.file('OEBPS/style.css', PRINT_CSS)
  zip.file(
    'OEBPS/nav.xhtml',
    `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head>
<body><nav epub:type="toc"><h1>Contents</h1><ol><li><a href="content.xhtml">${esc(project.title)}</a></li></ol></nav></body></html>`,
  )
  const uid = `urn:parchment:${project.id}`
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${uid}</dc:identifier>
    <dc:title>${esc(project.title)}</dc:title>
    <dc:creator>${esc(project.author ?? 'Unknown')}</dc:creator>
    <dc:language>${project.language}</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
  </manifest>
  <spine><itemref idref="content"/></spine>
</package>`,
  )
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' })
}

// ── JSON backup (single project) ─────────────────────────────────────────
export function toProjectBackup(bundle: ExportBundle): string {
  return JSON.stringify(
    {
      format: 'parchment-project',
      version: 1,
      exportedAt: new Date().toISOString(),
      project: bundle.project,
      nodes: bundle.nodes,
      characters: bundle.characters,
      locations: bundle.locations,
      threads: bundle.threads,
      worldElements: bundle.worldElements ?? [],
      maps: bundle.maps ?? [],
    },
    null,
    2,
  )
}

/** Export a single node (and its descendants) — used for per-scene/chapter export. */
export async function runExportNode(
  format: ExportFormat,
  project: Project,
  allNodes: TreeNode[],
  rootId: string,
): Promise<string> {
  const subtree: TreeNode[] = []
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    const node = allNodes.find((n) => n.id === id)
    if (!node) continue
    subtree.push(node)
    allNodes.filter((n) => n.parentId === id).forEach((c) => stack.push(c.id))
  }
  return runExport(format, { project, nodes: subtree, characters: [], locations: [], threads: [] }, 'all')
}

// ── Orchestrator ─────────────────────────────────────────────────────────
const EXPORT_FILTERS: Record<Exclude<ExportFormat, 'pdf'>, FileFilter[]> = {
  markdown: [{ name: 'Markdown', extensions: ['md'] }],
  text: [{ name: 'Plain text', extensions: ['txt'] }],
  html: [{ name: 'HTML', extensions: ['html'] }],
  json: [{ name: 'Parchment backup', extensions: ['json'] }],
  fountain: [{ name: 'Fountain', extensions: ['fountain'] }],
  docx: [{ name: 'Word document', extensions: ['docx'] }],
  epub: [{ name: 'EPUB', extensions: ['epub'] }],
}

/** Render HTML into an off-screen iframe and print it. Avoids window.open (which
 *  WebView2 and most browsers block as a pop-up) and lets the user "Save as PDF"
 *  or print from the system dialog. */
function printViaIframe(html: string): string {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  Object.assign(iframe.style, { position: 'fixed', left: '-99999px', top: '0', width: '794px', height: '1123px', border: '0' })
  document.body.appendChild(iframe)
  const cw = iframe.contentWindow
  const cdoc = cw?.document
  if (!cw || !cdoc) {
    iframe.remove()
    return 'Could not open the print view'
  }
  cdoc.open()
  cdoc.write(html)
  cdoc.close()
  const cleanup = () => {
    try {
      iframe.remove()
    } catch {
      /* already removed */
    }
  }
  cw.addEventListener?.('afterprint', cleanup)
  // Let the WebView lay the document out before invoking print.
  setTimeout(() => {
    try {
      cw.focus()
      cw.print()
    } catch {
      /* ignore */
    }
    setTimeout(cleanup, 60_000)
  }, 350)
  return 'Opening print dialog…'
}

export async function runExport(format: ExportFormat, bundle: ExportBundle, scope: CompileScope = 'manuscript'): Promise<string> {
  bundle = { ...bundle, scope }
  const base = slug(bundle.project.title) + (scope === 'notes' ? '-notes' : '')
  const isScript = PROJECT_TYPES[bundle.project.type].defaultDocType === 'script'

  // PDF renders into a hidden iframe and prints it — no pop-up (works in the
  // desktop WebView and in browsers that block window.open).
  if (format === 'pdf') {
    return printViaIframe(toHTML(bundle))
  }

  let blob: Blob
  let filename: string
  let okMsg: string
  switch (format) {
    case 'markdown':
      blob = new Blob([toMarkdown(bundle)], { type: 'text/markdown;charset=utf-8' })
      filename = `${base}.md`
      okMsg = 'Markdown exported'
      break
    case 'text':
      blob = new Blob([toPlainText(bundle)], { type: 'text/plain;charset=utf-8' })
      filename = `${base}.txt`
      okMsg = 'Plain text exported'
      break
    case 'html':
      blob = new Blob([toHTML(bundle)], { type: 'text/html;charset=utf-8' })
      filename = `${base}.html`
      okMsg = 'HTML exported'
      break
    case 'json':
      blob = new Blob([toProjectBackup(bundle)], { type: 'application/json;charset=utf-8' })
      filename = `${base}.parchment.json`
      okMsg = 'Backup exported'
      break
    case 'fountain':
      blob = new Blob([toFountain(bundle)], { type: 'text/plain;charset=utf-8' })
      filename = `${base}.fountain`
      okMsg = isScript ? 'Fountain exported' : 'Fountain exported (note: not a script project)'
      break
    case 'docx':
      blob = await toDocxBlob(bundle)
      filename = `${base}.docx`
      okMsg = 'Word document exported'
      break
    case 'epub':
      blob = await toEpubBlob(bundle)
      filename = `${base}.epub`
      okMsg = 'ePub exported'
      break
    default: {
      const _exhaustive: never = format
      throw new Error(`Unknown export format: ${String(_exhaustive)}`)
    }
  }

  const saved = await saveBlob(blob, filename, EXPORT_FILTERS[format])
  return saved === null ? 'Export cancelled' : okMsg
}
