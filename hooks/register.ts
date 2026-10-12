import type { EngineInterface, Register } from 'claude-code'

import { formatList, parse, pick, remove, serialize, titleFrom, upsert } from './pins'
import type { Pin, PinFile } from './pins'

type Paths = { home: string; config: string; dir: string; file: string; backups: string }

async function paths($: EngineInterface): Promise<Paths> {
  const home = (await $.env.get('HOME')) ?? ''
  const config = (await $.env.get('CLAUDE_CONFIG_DIR')) || `${home}/.claude`
  const dir = `${config}/pinned-sessions`
  return { home, config, dir, file: `${dir}/pins.json`, backups: `${dir}/backups` }
}

async function load($: EngineInterface, p: Paths): Promise<PinFile> {
  const text = (await $.fs.exists(p.file)) ? await $.fs.read(p.file) : undefined
  return parse(typeof text === 'string' ? text : undefined)
}

const save = ($: EngineInterface, p: Paths, file: PinFile) => $.fs.write(p.file, serialize(file))

/** The transcript lives at <config>/projects/<encoded cwd>/<id>.jsonl; look it up rather than guess the encoding. */
async function findTranscript($: EngineInterface, p: Paths, id: string): Promise<string | undefined> {
  const projects = `${p.config}/projects`
  if (!(await $.fs.exists(projects))) return undefined
  for (const entry of await $.fs.list(projects)) {
    if (entry.kind !== 'dir') continue
    const candidate = `${projects}/${entry.name}/${id}.jsonl`
    if (await $.fs.exists(candidate)) return candidate
  }
  return undefined
}

/** Copies the transcript (and its subagent folder, if any) out of reach of cleanupPeriodDays. */
async function backup($: EngineInterface, p: Paths, b: Pin): Promise<boolean> {
  if (!b.transcript || !(await $.fs.exists(b.transcript))) return false
  await $.process.run(['mkdir', '-p', p.backups])
  const copied = await $.process.run(['cp', '-p', b.transcript, b.backup])
  const sidecar = b.transcript.replace(/\.jsonl$/, '')
  if (await $.fs.exists(sidecar)) {
    await $.process.run(['rm', '-rf', `${p.backups}/${b.id}`])
    await $.process.run(['cp', '-Rp', sidecar, `${p.backups}/${b.id}`])
  }
  return copied.exitCode === 0
}

async function firstPrompt($: EngineInterface): Promise<string | undefined> {
  const messages = await $.session.messages()
  if (!Array.isArray(messages)) return undefined
  return messages.find(m => m.role === 'user' && m.text.trim() !== '')?.text
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pin',
      description: 'Pin this session so it is easy to find and safe from cleanup',
      argumentHint: '[note]',
    })
    await $.command.register({
      name: 'pins',
      description: 'List pinned sessions from every project',
    })
    await $.command.register({
      name: 'unpin',
      description: 'Remove a pin (this session, a number from /pins, or an id prefix)',
      argumentHint: '[number | id]',
    })
    return next(e)
  })

  on('command.run', { command: 'pin' }, async ($, e) => {
    const p = await paths($)
    const id = await $.session.id()
    const transcript = (await findTranscript($, p, id)) ?? ''
    const note = e.args.trim()
    const now = new Date().toISOString()
    const pin: Pin = {
      id,
      title: titleFrom(note, await firstPrompt($)),
      note,
      cwd: await $.session.cwd(),
      transcript,
      backup: `${p.backups}/${id}.jsonl`,
      createdAt: now,
      updatedAt: now,
    }
    const file = upsert(await load($, p), pin)
    await save($, p, file)
    const saved = file.pins[0] ?? pin
    const isBackedUp = await backup($, p, saved)
    const safety = isBackedUp
      ? 'Transcript backed up; it is refreshed every time this session ends.'
      : 'Transcript not written yet; it will be backed up when this session ends.'
    return { text: `📌 Pinned "${saved.title}" (${id.slice(0, 8)}).\n${safety}` }
  })

  on('command.run', { command: 'pins' }, async $ => {
    const p = await paths($)
    return { text: formatList(await load($, p), p.home, await $.session.id()) }
  })

  on('command.run', { command: 'unpin' }, async ($, e) => {
    const p = await paths($)
    const file = await load($, p)
    const target = pick(file, e.args, await $.session.id())
    if (!target) {
      return {
        text: e.args.trim()
          ? `No single pin matches "${e.args.trim()}". Run /pins to see the list.`
          : 'This session is not pinned.',
      }
    }
    await save($, p, remove(file, target.id))
    await $.process.run(['rm', '-rf', target.backup, `${p.backups}/${target.id}`])
    return { text: `Removed pin "${target.title}" and its backup.` }
  })

  // Keep the backup of a pinned session current as it grows.
  on('session.end', async ($, e, next) => {
    const p = await paths($)
    const id = await $.session.id()
    const file = await load($, p)
    const pin = file.pins.find(b => b.id === id)
    if (pin) {
      const transcript = pin.transcript || (await findTranscript($, p, id)) || ''
      const refreshed = { ...pin, transcript, updatedAt: new Date().toISOString() }
      await backup($, p, refreshed)
      await save($, p, { version: 1, pins: file.pins.map(b => (b.id === id ? refreshed : b)) })
    }
    return next(e)
  })
}
