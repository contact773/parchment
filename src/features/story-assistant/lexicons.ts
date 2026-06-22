// Per-language lexicons for the LOCAL (no-LLM) story-analysis heuristics.
// Only the data the KEPT parameters need lives here — tone/tension/genre
// migrated to the advanced LLM panel, so their sentiment lexicons are gone.
//
// All sets are lowercased. `en` is the fallback for every Record when a
// language entry is missing. (German polite `Sie` = "you" is treated as
// third-person `sie`; narration rarely uses formal address, so this is fine.)
import type { LanguageCode } from '@/types'

export const LANGS: LanguageCode[] = ['en', 'nl', 'fr', 'de', 'es']

// ── Point of view ─────────────────────────────────────────────────────────
// Pronouns split by role; weighting (subject 3 / possessive 2 / object 1) is
// applied in detectPOV. Each surface form is assigned to ONE bucket only.
export interface PronounSet {
  first: string[]
  second: string[]
  third: string[]
}

export const PRONOUNS: Record<LanguageCode, PronounSet> = {
  en: {
    first: ['i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our', 'ours', 'ourselves'],
    second: ['you', 'your', 'yours', 'yourself', 'yourselves'],
    third: ['he', 'she', 'him', 'her', 'his', 'hers', 'they', 'them', 'their', 'theirs', 'himself', 'herself', 'themselves', 'it', 'its'],
  },
  nl: {
    first: ['ik', 'me', 'mij', 'mijn', 'we', 'wij', 'ons', 'onze'],
    second: ['je', 'jij', 'jou', 'jouw', 'u', 'uw', 'jullie'],
    // 'het' (the/it) and 'zijn' (his/to-be) are excluded — overwhelmingly an
    // article and the most common verb, so they'd swamp third-person counts.
    third: ['hij', 'hem', 'ze', 'zij', 'haar', 'hen', 'hun'],
  },
  fr: {
    first: ['je', "j'", 'me', "m'", 'moi', 'mon', 'ma', 'mes', 'nous', 'notre', 'nos'],
    second: ['tu', 'te', "t'", 'toi', 'ton', 'ta', 'tes', 'vous', 'votre', 'vos'],
    third: ['il', 'elle', 'ils', 'elles', 'lui', 'leur', 'leurs', 'son', 'sa', 'ses', 'se'],
  },
  de: {
    // `sie` covers she/they (and polite "you"); kept in third — see header note.
    first: ['ich', 'mich', 'mir', 'mein', 'meine', 'wir', 'uns', 'unser', 'unsere'],
    second: ['du', 'dich', 'dir', 'dein', 'deine', 'ihr', 'euch', 'euer'],
    third: ['er', 'es', 'ihn', 'ihm', 'sein', 'seine', 'ihre', 'ihnen', 'sie', 'sich'],
  },
  es: {
    first: ['yo', 'me', 'mi', 'mis', 'mío', 'mía', 'conmigo', 'nosotros', 'nosotras', 'nos', 'nuestro', 'nuestra'],
    second: ['tú', 'te', 'ti', 'tus', 'usted', 'ustedes', 'vosotros', 'os', 'vuestro'],
    third: ['él', 'ella', 'ellos', 'ellas', 'su', 'sus', 'se'],
  },
}

// Pro-drop backstop: high-frequency 1st-person finite verbs (Spanish/French
// routinely omit the subject pronoun). Added to the first-person score.
export const FIRST_PERSON_VERBS: Partial<Record<LanguageCode, string[]>> = {
  es: ['soy', 'estoy', 'tengo', 'quiero', 'puedo', 'voy', 'sé', 'hago', 'veo', 'creo', 'siento', 'pienso', 'digo'],
  fr: ['suis', 'ai', 'vais', 'veux', 'peux', 'sais', 'fais', 'crois', 'pense', 'dis', 'vois'],
}
// 1st-person-plural verb endings (added at low weight to first-person).
export const FIRST_PLURAL_ENDINGS: Partial<Record<LanguageCode, RegExp>> = {
  es: /(amos|emos|imos)$/,
  fr: /ons$/,
}

// ── Name detection ──────────────────────────────────────────────────────────
export const HONORIFICS: Record<LanguageCode, Set<string>> = {
  en: new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'sir', 'lady', 'lord', 'captain', 'colonel', 'father', 'sister', 'aunt', 'uncle', 'king', 'queen', 'prince', 'princess']),
  nl: new Set(['dhr', 'mevr', 'mw', 'meneer', 'mevrouw', 'dokter', 'professor', 'oom', 'tante']),
  fr: new Set(['m', 'mme', 'mlle', 'monsieur', 'madame', 'mademoiselle', 'dr', 'docteur', 'maître', 'père', 'sœur', 'tante', 'oncle']),
  de: new Set(['herr', 'frau', 'dr', 'prof', 'graf', 'gräfin', 'könig', 'königin', 'tante', 'onkel']),
  es: new Set(['sr', 'sra', 'srta', 'señor', 'señora', 'señorita', 'don', 'doña', 'dr', 'dra', 'tío', 'tía']),
}

export const SAID_VERBS: Record<LanguageCode, Set<string>> = {
  en: new Set(['said', 'asked', 'replied', 'whispered', 'shouted', 'cried', 'murmured', 'muttered', 'answered', 'called', 'yelled', 'added', 'continued', 'snapped', 'sighed']),
  nl: new Set(['zei', 'vroeg', 'antwoordde', 'riep', 'fluisterde', 'mompelde', 'schreeuwde', 'zuchtte']),
  fr: new Set(['dit', 'demanda', 'répondit', 'murmura', 'cria', 'chuchota', 'ajouta', 'soupira', 'lança', 'reprit']),
  de: new Set(['sagte', 'fragte', 'antwortete', 'flüsterte', 'rief', 'murmelte', 'schrie', 'seufzte', 'erwiderte']),
  es: new Set(['dijo', 'preguntó', 'respondió', 'murmuró', 'gritó', 'susurró', 'añadió', 'suspiró', 'exclamó', 'contestó']),
}

// Lowercase nobiliary / surname particles that join into one name entity.
export const PARTICLES: Record<LanguageCode, Set<string>> = {
  en: new Set(['de', 'van', 'von', 'mac', 'mc', "o'"]),
  nl: new Set(['van', 'de', 'den', 'der', 'ten', 'ter', 'het', "'t", 'op', 'in']),
  fr: new Set(['de', 'du', 'des', "d'", 'la', 'le', 'von']),
  de: new Set(['von', 'van', 'zu', 'der', 'den']),
  es: new Set(['de', 'del', 'la', 'las', 'los', 'y']),
}

// Common capitalized-but-not-a-name words + function words to reject as names.
export const NAME_STOPWORDS: Record<LanguageCode, Set<string>> = {
  en: new Set(['the', 'a', 'an', 'and', 'but', 'or', 'if', 'then', 'so', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'to', 'with', 'this', 'that', 'these', 'those', 'there', 'here', 'when', 'where', 'why', 'how', 'what', 'who', 'i', 'he', 'she', 'they', 'we', 'you', 'it', 'his', 'her', 'their', 'my', 'your', 'chapter', 'scene', 'one', 'two', 'three', 'god', 'lord', 'yes', 'no', 'oh', 'ah', 'well', 'now', 'later', 'today', 'tomorrow', 'yesterday', 'mr', 'mrs', 'ms', 'dr', 'people', 'crowd', 'everyone', 'someone', 'anyone', 'nobody', 'somebody', 'man', 'woman', 'child', 'children', 'boy', 'girl', 'voice', 'stop', 'wait', 'help', 'please', 'hello', 'sir', 'madam', 'soldiers']),
  nl: new Set(['de', 'het', 'een', 'en', 'maar', 'of', 'als', 'dan', 'dus', 'op', 'in', 'van', 'voor', 'met', 'dit', 'dat', 'deze', 'die', 'er', 'hier', 'daar', 'toen', 'waar', 'hoofdstuk', 'ja', 'nee', 'ik', 'hij', 'zij', 'wij', 'jij']),
  fr: new Set(['le', 'la', 'les', 'un', 'une', 'des', 'et', 'mais', 'ou', 'si', 'donc', 'sur', 'dans', 'de', 'pour', 'avec', 'ce', 'cet', 'cette', 'ces', 'ici', 'là', 'quand', 'où', 'chapitre', 'oui', 'non', 'je', 'il', 'elle', 'nous', 'vous']),
  de: new Set(['der', 'die', 'das', 'ein', 'eine', 'und', 'aber', 'oder', 'wenn', 'dann', 'also', 'auf', 'in', 'von', 'für', 'mit', 'dies', 'diese', 'jener', 'hier', 'dort', 'wann', 'wo', 'kapitel', 'ja', 'nein', 'ich', 'er', 'sie', 'wir', 'du', 'es', 'so', 'als', 'doch', 'nun', 'morgen', 'abend', 'tag', 'nacht', 'mann', 'kind', 'kinder', 'haus', 'wald', 'zeit', 'jahr', 'welt', 'leben', 'stunde', 'woche', 'gott', 'leute', 'menschen']),
  es: new Set(['el', 'la', 'los', 'las', 'un', 'una', 'y', 'pero', 'o', 'si', 'entonces', 'sobre', 'en', 'de', 'para', 'con', 'este', 'esta', 'estos', 'ese', 'aquí', 'allí', 'cuando', 'dónde', 'capítulo', 'sí', 'no', 'yo', 'él', 'ella', 'nosotros', 'usted']),
}

export const CALENDAR: Record<LanguageCode, Set<string>> = {
  en: new Set(['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  nl: new Set(['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']),
  fr: new Set(['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']),
  de: new Set(['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag']),
  es: new Set(['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']),
}

// Common place names (cities / countries / regions) to reject as character names.
export const PLACES = new Set([
  'london', 'paris', 'madrid', 'berlin', 'rome', 'amsterdam', 'vienna', 'prague', 'dublin', 'lisbon', 'moscow',
  'warsaw', 'brussels', 'barcelona', 'munich', 'milan', 'venice', 'florence', 'naples', 'geneva', 'zurich',
  'athens', 'istanbul', 'cairo', 'tokyo', 'kyoto', 'beijing', 'shanghai', 'delhi', 'mumbai', 'bangkok',
  'sydney', 'melbourne', 'toronto', 'montreal', 'vancouver', 'chicago', 'boston', 'seattle', 'denver',
  'dallas', 'houston', 'miami', 'atlanta', 'phoenix', 'york', 'washington', 'california', 'texas', 'florida',
  'england', 'scotland', 'wales', 'ireland', 'france', 'spain', 'germany', 'italy', 'portugal', 'greece',
  'russia', 'poland', 'netherlands', 'belgium', 'austria', 'switzerland', 'sweden', 'norway', 'denmark',
  'finland', 'china', 'japan', 'india', 'africa', 'asia', 'europe', 'america', 'canada', 'mexico', 'brazil',
  'argentina', 'egypt', 'éire', 'españa', 'deutschland', 'frankrijk', 'frankreich', 'américa', 'nederland',
  'brighton', 'lyon', 'marseille', 'sicily', 'cornwall', 'yorkshire', 'manchester', 'liverpool', 'glasgow',
  'edinburgh', 'cardiff', 'oxford', 'cambridge', 'dover', 'hastings', 'normandy', 'brittany', 'provence',
  'tuscany', 'bavaria', 'andalusia', 'catalonia', 'valencia', 'seville', 'granada', 'bilbao', 'rotterdam',
  'hague', 'antwerp', 'ghent', 'bruges', 'cologne', 'hamburg', 'dresden', 'leipzig', 'stuttgart', 'bonn',
])

// ── Adverbs ─────────────────────────────────────────────────────────────────
// Per-language manner-adverb suffix matcher. DE/NL are low-confidence (most
// adverbs are bare adjectives, morphologically invisible).
export const ADVERB_RE: Record<LanguageCode, RegExp> = {
  // Match -ly/-ment/-mente in any case (catches sentence-initial "Suddenly"); the
  // per-language stoplists filter the proper nouns (Italy, Sally) and -ment nouns.
  en: /(?<![\p{L}])[\p{L}][\p{L}'’-]*ly(?![\p{L}])/giu,
  fr: /(?<![\p{L}])[\p{L}][\p{L}'’-]{3,}ment(?![\p{L}])/giu,
  es: /(?<![\p{L}])[\p{L}][\p{L}'’-]{3,}mente(?![\p{L}])/giu,
  de: /\b[\p{L}-]{4,}weise\b/giu,
  nl: /\b[\p{L}-]{4,}lijk\b/giu,
}
export const ADVERB_LOW_CONFIDENCE: Record<LanguageCode, boolean> = {
  en: false, fr: false, es: false, de: true, nl: true,
}
// EN -ly words that are NOT manner adverbs (adjectives / nouns / verbs).
export const EN_ADVERB_STOPLIST = new Set([
  // verbs / nouns
  'family', 'reply', 'supply', 'apply', 'comply', 'rely', 'imply', 'multiply', 'ally', 'rally', 'bully', 'jelly',
  'belly', 'folly', 'gully', 'lily', 'valley', 'alley', 'galley', 'volley', 'trolley', 'medley', 'parsley', 'barley',
  'dally', 'tally', 'sally', 'dolly', 'lolly', 'butterfly', 'holly', 'monopoly', 'assembly', 'anomaly', 'melancholy', 'italy',
  // adjectives ending -ly (not manner adverbs)
  'holy', 'ugly', 'only', 'early', 'silly', 'lonely', 'lovely', 'lively', 'comely', 'costly', 'deadly',
  'friendly', 'ghastly', 'ghostly', 'grisly', 'kingly', 'knightly', 'lordly', 'manly', 'miserly', 'oily', 'orderly',
  'portly', 'princely', 'prickly', 'queenly', 'saintly', 'scholarly', 'seemly', 'shapely', 'sickly', 'smelly',
  'stately', 'steely', 'surly', 'timely', 'unruly', 'wifely', 'wobbly', 'worldly', 'wrinkly', 'curly', 'chilly',
  'bubbly', 'crumbly', 'cuddly', 'frilly', 'giggly', 'woolly', 'likely', 'unlikely', 'lowly', 'godly', 'ungodly',
  'beastly', 'brotherly', 'sisterly', 'fatherly', 'motherly', 'neighborly', 'scaly', 'slovenly', 'cowardly',
  'leisurely', 'elderly', 'measly', 'homely', 'jolly', 'hilly', 'fly', 'ply', 'sly',
  // time words read as nouns/adjectives here
  'july', 'daily', 'weekly', 'monthly', 'yearly', 'nightly', 'quarterly', 'fortnightly',
])

// FR -ment words that are NOUNS, not adverbs (French nouns commonly end in -ment).
export const FR_ADVERB_STOPLIST = new Set([
  'mouvement', 'monument', 'gouvernement', 'bâtiment', 'document', 'moment', 'vêtement', 'appartement', 'changement',
  'sentiment', 'événement', 'instrument', 'département', 'environnement', 'élément', 'argument', 'complément',
  'parlement', 'règlement', 'équipement', 'traitement', 'comportement', 'raisonnement', 'fonctionnement',
  'développement', 'commencement', 'logement', 'jugement', 'paiement', 'abonnement', 'renseignement',
  'enseignement', 'remboursement', 'licenciement', 'financement', 'classement', 'déménagement', 'rassemblement',
  'accompagnement', 'divertissement', 'hurlement', 'roulement', 'glissement', 'tremblement', 'grognement',
  'claquement', 'craquement', 'battement', 'frottement', 'dénouement', 'campement', 'segment', 'fragment',
  'ciment', 'aliment', 'régiment', 'firmament', 'testament', 'ornement', 'tourment', 'serment',
])

// ── Pacing (motion verbs, language-neutral-ish small set) ────────────────────
export const MOTION_VERBS: Record<LanguageCode, Set<string>> = {
  en: new Set(['ran', 'run', 'rushed', 'grabbed', 'slammed', 'leapt', 'dashed', 'lunged', 'sprinted', 'darted', 'spun', 'snatched', 'hurled', 'flung', 'shoved', 'bolted']),
  nl: new Set(['rende', 'rennen', 'greep', 'sloeg', 'sprong', 'schoot', 'duwde', 'stormde']),
  fr: new Set(['courut', 'saisit', 'frappa', 'bondit', 'fonça', 'jaillit', 'poussa', 'attrapa']),
  de: new Set(['rannte', 'packte', 'schlug', 'sprang', 'stürzte', 'riss', 'stieß', 'jagte']),
  es: new Set(['corrió', 'agarró', 'golpeó', 'saltó', 'lanzó', 'empujó', 'arrancó', 'cruzó']),
}

/** Safe lookup with English fallback. */
export function forLang<T>(rec: Partial<Record<LanguageCode, T>>, lang: LanguageCode | undefined): T {
  return (lang && rec[lang]) ?? (rec.en as T)
}
