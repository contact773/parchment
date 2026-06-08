/** Local language tools used by the offline assistant: a curated thesaurus of
 *  stronger alternatives, a lightweight grammar/style checker, and simple
 *  text transforms. These work with zero configuration; connecting an AI model
 *  in Settings unlocks full rewriting/translation. */

export const THESAURUS: Record<string, string[]> = {
  good: ['fine', 'excellent', 'superb', 'admirable', 'worthy'],
  bad: ['poor', 'wretched', 'dismal', 'awful', 'lousy'],
  big: ['vast', 'immense', 'towering', 'enormous', 'sprawling'],
  small: ['slight', 'tiny', 'minute', 'cramped', 'meager'],
  happy: ['glad', 'elated', 'buoyant', 'content', 'jubilant'],
  sad: ['mournful', 'forlorn', 'desolate', 'crestfallen', 'bleak'],
  angry: ['furious', 'livid', 'seething', 'incensed', 'irate'],
  scared: ['terrified', 'petrified', 'fearful', 'shaken', 'rattled'],
  walk: ['stride', 'amble', 'trudge', 'saunter', 'pace'],
  run: ['sprint', 'bolt', 'dash', 'tear', 'race'],
  look: ['gaze', 'glance', 'peer', 'study', 'regard'],
  said: ['murmured', 'replied', 'admitted', 'countered', 'offered'],
  beautiful: ['lovely', 'radiant', 'striking', 'exquisite', 'handsome'],
  ugly: ['hideous', 'grotesque', 'unsightly', 'plain', 'coarse'],
  cold: ['frigid', 'icy', 'biting', 'glacial', 'raw'],
  hot: ['scorching', 'sweltering', 'blistering', 'searing', 'torrid'],
  dark: ['murky', 'dim', 'shadowed', 'gloomy', 'pitch-black'],
  bright: ['luminous', 'brilliant', 'gleaming', 'vivid', 'dazzling'],
  quiet: ['hushed', 'still', 'muted', 'silent', 'subdued'],
  loud: ['deafening', 'thunderous', 'booming', 'piercing', 'raucous'],
  fast: ['swift', 'rapid', 'fleet', 'brisk', 'headlong'],
  slow: ['languid', 'sluggish', 'unhurried', 'plodding', 'leisurely'],
  old: ['ancient', 'aged', 'weathered', 'venerable', 'antique'],
  new: ['fresh', 'novel', 'recent', 'unspoiled', 'pristine'],
  tired: ['weary', 'exhausted', 'spent', 'drained', 'fatigued'],
  nice: ['pleasant', 'agreeable', 'gracious', 'kind', 'warm'],
  very: ['remarkably', 'intensely', 'thoroughly', 'deeply', 'acutely'],
  really: ['truly', 'genuinely', 'profoundly', 'decidedly'],
  smart: ['clever', 'astute', 'shrewd', 'sharp', 'brilliant'],
  strong: ['powerful', 'sturdy', 'robust', 'formidable', 'mighty'],
  weak: ['frail', 'feeble', 'fragile', 'faint', 'brittle'],
  thing: ['object', 'matter', 'detail', 'item', 'element'],
  important: ['crucial', 'vital', 'pivotal', 'essential', 'momentous'],
}

/** "Weak" / filter words worth flagging for stronger prose. */
export const FILTER_WORDS = ['very', 'really', 'just', 'quite', 'rather', 'somewhat', 'actually', 'basically', 'literally', 'suddenly', 'felt', 'saw', 'heard', 'seemed', 'began to', 'started to']

export function synonymsFor(word: string): string[] {
  return THESAURUS[word.toLowerCase().trim()] ?? []
}

/** Suggest stronger alternatives for notable words in a passage. */
export function strongerWords(text: string): { word: string; alternatives: string[] }[] {
  const seen = new Set<string>()
  const out: { word: string; alternatives: string[] }[] = []
  for (const m of text.toLowerCase().matchAll(/[a-z']+/g)) {
    const w = m[0]
    if (seen.has(w)) continue
    const alts = THESAURUS[w]
    if (alts) {
      seen.add(w)
      out.push({ word: w, alternatives: alts })
    }
    if (out.length >= 8) break
  }
  return out
}

export interface GrammarIssue {
  message: string
  excerpt?: string
}

/** Lightweight, language-agnostic-ish grammar & style checks. */
export function checkGrammar(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = []
  const add = (message: string, excerpt?: string) => issues.push({ message, excerpt })

  // Doubled words ("the the").
  for (const m of text.matchAll(/\b(\w+)\s+\1\b/gi)) add(`Repeated word "${m[1]}"`, m[0])
  // Double spaces.
  if (/ {2,}/.test(text)) add('Double spaces found — collapse to single spaces.')
  // Space before punctuation.
  for (const m of text.matchAll(/\s+([,.!?;:])/g)) add(`Space before "${m[1]}"`, m[0].trim())
  // Missing space after sentence punctuation.
  for (const m of text.matchAll(/[a-z]([.!?])[A-Z]/g)) add(`Missing space after "${m[1]}"`, m[0])
  // Lowercase sentence start.
  for (const m of text.matchAll(/[.!?]\s+([a-z])/g)) add('Sentence may start with a lowercase letter.', m[0].trim())
  // a / an. Heuristic — guard the common consonant-sound-vowel and
  // vowel-sound-consonant (acronym / silent-h) exceptions to cut false positives.
  const consonantSoundVowel = /^(uni|use|usu|util|ubiq|euro|eu|one|once|u[bcdfghjklmnpqrstvwxz][aeiou])/i
  for (const m of text.matchAll(/\ba\s+([aeiouAEIOU]\w+)/g)) {
    if (!consonantSoundVowel.test(m[1])) add(`Consider "an ${m[1]}" instead of "a ${m[1]}".`)
  }
  const vowelSoundConsonant = (w: string) =>
    /^[hH](onest|our|eir|ono)/.test(w) || (/^[A-Z]{2,}$/.test(w) && 'AEFHILMNORSX'.includes(w[0]))
  for (const m of text.matchAll(/\ban\s+([^aeiouAEIOU\s]\w+)/g)) {
    if (!vowelSoundConsonant(m[1])) add(`Consider "a ${m[1]}" instead of "an ${m[1]}".`)
  }
  // Common typos.
  const typos: Record<string, string> = { teh: 'the', recieve: 'receive', alot: 'a lot', occured: 'occurred', wich: 'which', thier: 'their', definately: 'definitely', seperate: 'separate' }
  for (const [bad, good] of Object.entries(typos)) {
    if (new RegExp(`\\b${bad}\\b`, 'i').test(text)) add(`Possible typo "${bad}" → "${good}".`)
  }
  // Filter words.
  const filters = FILTER_WORDS.filter((f) => new RegExp(`\\b${f}\\b`, 'i').test(text))
  if (filters.length) add(`Filter/weak words present: ${filters.slice(0, 6).join(', ')}. Cutting them tightens prose.`)

  return issues
}

/** A naive "simpler" transform: split long sentences and trim filler. */
export function simplify(text: string): string {
  let t = text.replace(/\b(in order to)\b/gi, 'to').replace(/\b(due to the fact that)\b/gi, 'because')
  t = t.replace(/\b(very|really|quite|rather|just|actually|basically)\s+/gi, '')
  // Break very long sentences at ", and " / ", but ".
  t = t.replace(/,\s+(and|but)\s+/g, '. ')
  return t.replace(/\s{2,}/g, ' ').trim()
}
