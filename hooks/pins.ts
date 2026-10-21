// Pure helpers for the pins file: no `$`, so tests can exercise them directly.

export type Pin = {
  id: string
  title: string
  note: string
  cwd: string
  transcript: string
  backup: string
  createdAt: string
  updatedAt: string
}

export type PinFile = { version: 1; pins: Pin[] }

export const EMPTY: PinFile = { version: 1, pins: [] }

export function parse(text: string | undefined): PinFile {
  if (!text) return { ...EMPTY, pins: [] }
  try {
    const data = JSON.parse(text)
    if (data && Array.isArray(data.pins)) return { version: 1, pins: data.pins }
  } catch {}
  return { ...EMPTY, pins: [] }
}

export function serialize(file: PinFile): string {
  return JSON.stringify(file, null, 2) + '\n'
}

/** Adds or refreshes a pin; an existing one keeps its createdAt and, without a new note, its note. */
export function upsert(file: PinFile, next: Pin): PinFile {
  const old = file.pins.find(b => b.id === next.id)
  const merged: Pin = old
    ? {
        ...next,
        createdAt: old.createdAt,
        note: next.note || old.note,
        title: next.note ? next.title : old.title,
      }
    : next
  return { version: 1, pins: [merged, ...file.pins.filter(b => b.id !== next.id)] }
}

/**
 * Finds the pin a /unpin argument names: empty means the current session,
 * a number is its position in /pins, anything else an id prefix.
 */
export function pick(file: PinFile, arg: string, currentId: string): Pin | undefined {
  const query = arg.trim()
  if (query === '') return file.pins.find(b => b.id === currentId)
  if (/^\d+$/.test(query)) return file.pins[Number(query) - 1]
  const matches = file.pins.filter(b => b.id.startsWith(query))
  return matches.length === 1 ? matches[0] : undefined
}

export function remove(file: PinFile, id: string): PinFile {
  return { version: 1, pins: file.pins.filter(b => b.id !== id) }
}

export function titleFrom(note: string, firstPrompt: string | undefined): string {
  const source = note || firstPrompt || 'Untitled session'
  const line = source.replace(/\s+/g, ' ').trim()
  return line.length > 70 ? line.slice(0, 67) + '...' : line
}

export function shortPath(path: string, home: string): string {
  return home && path.startsWith(home) ? '~' + path.slice(home.length) : path
}

export function formatList(file: PinFile, home: string, currentId: string): string {
  if (file.pins.length === 0) {
    return 'No pinned sessions yet. Run /pin [note] in a session you want to keep.'
  }
  const rows = file.pins.map((b, i) => {
    const here = b.id === currentId ? '  ← this session' : ''
    const note = b.note && b.note !== b.title ? `\n     note: ${b.note}` : ''
    return (
      `${i + 1}. 📌 ${b.title}${here}\n` +
      `     ${shortPath(b.cwd, home)} · ${b.updatedAt.slice(0, 10)} · ${b.id.slice(0, 8)}${note}\n` +
      `     resume: cd ${quote(shortPath(b.cwd, home))} && claude --resume ${b.id}`
    )
  })
  return `Pinned sessions (${file.pins.length}):\n\n${rows.join('\n\n')}\n\nTip: run \`claude-pin\` from any terminal to pick one and resume it.`
}

function quote(path: string): string {
  return /^[~\w./-]+$/.test(path) ? path : `'${path.replace(/'/g, `'\\''`)}'`
}
