import { expect, test } from 'claude-code/testing'

import { EMPTY, formatList, parse, pick, remove, titleFrom, upsert } from './pins'
import type { Pin } from './pins'

const make = (id: string, extra: Partial<Pin> = {}): Pin => ({
  id,
  title: `title ${id}`,
  note: '',
  cwd: '/Users/me/repo',
  transcript: `/Users/me/.claude/projects/-Users-me-repo/${id}.jsonl`,
  backup: `/Users/me/.claude/evergreen-sessions/backups/${id}.jsonl`,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...extra,
})

test('parse tolerates a missing or broken file', async () => {
  expect(parse(undefined).pins).toEqual([])
  expect(parse('not json').pins).toEqual([])
  expect(parse('{"version":1,"pins":[]}').pins).toEqual([])
})

test('upsert puts the newest first and keeps createdAt and note on re-pin', async () => {
  let file = upsert(upsert(EMPTY, make('aaa', { note: 'auth refactor' })), make('bbb'))
  expect(file.pins.map(b => b.id)).toEqual(['bbb', 'aaa'])
  file = upsert(file, make('aaa', { createdAt: '2026-10-09T00:00:00.000Z' }))
  expect(file.pins.map(b => b.id)).toEqual(['aaa', 'bbb'])
  expect(file.pins[0]?.createdAt).toBe('2026-10-01T00:00:00.000Z')
  expect(file.pins[0]?.note).toBe('auth refactor')
})

test('pick finds the current session, a number, or a unique id prefix', async () => {
  const file = upsert(upsert(EMPTY, make('abc123')), make('abd456'))
  expect(pick(file, '', 'abc123')?.id).toBe('abc123')
  expect(pick(file, '1', 'x')?.id).toBe('abd456')
  expect(pick(file, 'abc', 'x')?.id).toBe('abc123')
  expect(pick(file, 'ab', 'x')).toBeUndefined()
  expect(pick(file, '9', 'x')).toBeUndefined()
  expect(remove(file, 'abc123').pins.map(b => b.id)).toEqual(['abd456'])
})

test('titles are one short line', async () => {
  expect(titleFrom('', 'fix   the\nlogin bug')).toBe('fix the login bug')
  expect(titleFrom('', undefined)).toBe('Untitled session')
  expect(titleFrom('x'.repeat(100), undefined).length).toBe(70)
})

test('the list shows a resume command with the home folder shortened', async () => {
  const text = formatList(upsert(EMPTY, make('abc12345-0000')), '/Users/me', 'abc12345-0000')
  expect(text).toContain('cd ~/repo && claude --resume abc12345-0000')
  expect(text).toContain('this session')
  expect(formatList(EMPTY, '/Users/me', 'x')).toContain('No pinned sessions yet')
})
