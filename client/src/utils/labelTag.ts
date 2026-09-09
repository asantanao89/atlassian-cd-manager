const LABEL_TAG_COLORS: Record<string, string> = {
  pim: 'bg-cyan-100 text-cyan-800',
  proshop: 'bg-blue-100 text-blue-800',
  prodata: 'bg-violet-100 text-violet-800',
  wholesalers: 'bg-amber-100 text-amber-800',
}

const FALLBACK_TAG_COLORS = [
  'bg-indigo-100 text-indigo-800',
  'bg-fuchsia-100 text-fuchsia-800',
  'bg-rose-100 text-rose-800',
  'bg-orange-100 text-orange-800',
  'bg-emerald-100 text-emerald-800',
  'bg-teal-100 text-teal-800',
  'bg-sky-100 text-sky-800',
  'bg-pink-100 text-pink-800',
  'bg-lime-100 text-lime-800',
  'bg-purple-100 text-purple-800',
]

export function labelTagClass(label: string): string {
  const key = label.trim().toLowerCase()
  if (!key) return 'bg-gray-100 text-gray-700'
  const mapped = LABEL_TAG_COLORS[key]
  if (mapped) return mapped

  let hash = 0
  for (const character of key) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return FALLBACK_TAG_COLORS[hash % FALLBACK_TAG_COLORS.length]
}
