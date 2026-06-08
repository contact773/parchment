declare module 'nspell' {
  export interface NSpell {
    correct: (word: string) => boolean
    suggest: (word: string) => string[]
    add: (word: string, model?: string) => NSpell
    remove: (word: string) => NSpell
    spell: (word: string) => { correct: boolean; forbidden: boolean; warn: boolean }
  }
  /** nspell(aff, dic) or nspell({ aff, dic }) */
  const nspell: (aff: string | Buffer | { aff: string | Buffer; dic: string | Buffer }, dic?: string | Buffer) => NSpell
  export default nspell
}
