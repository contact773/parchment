import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style'
import type { Extensions } from '@tiptap/core'
import type { DocType, LanguageCode } from '@/types'
import { Spellcheck } from '../spellcheck/SpellcheckExtension'
import { ScriptElementExt } from './ScriptElement'
import { CommentMark } from './CommentMark'
import { FocusBlock } from './FocusBlock'
import { BlockStyle } from './BlockStyle'
import { SearchExtension } from './SearchExtension'

export interface BuildOptions {
  docType: DocType
  language: LanguageCode
  spellcheckEnabled: boolean
  placeholder?: string
}

export function buildExtensions(opts: BuildOptions): Extensions {
  const ext: Extensions = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      codeBlock: { HTMLAttributes: { spellcheck: 'false' } },
    }),
    Placeholder.configure({
      placeholder: opts.placeholder ?? 'Begin writing…',
      emptyEditorClass: 'is-editor-empty',
    }),
    CharacterCount,
    Highlight.configure({ multicolor: true }),
    Typography,
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    BlockStyle,
    CommentMark,
    SearchExtension,
    Spellcheck.configure({ enabled: opts.spellcheckEnabled, language: opts.language }),
  ]

  if (opts.docType === 'script') {
    ext.push(ScriptElementExt)
  } else {
    ext.push(TextAlign.configure({ types: ['heading', 'paragraph'] }))
  }

  // FocusBlock is always present; it only paints the dimming when the editor
  // container carries the `focus-active` class, so focus mode toggles via CSS
  // alone — no editor rebuild (which would wipe undo history & cursor).
  ext.push(FocusBlock)

  return ext
}
