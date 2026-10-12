# 🌲 evergreen-sessions

**Pin your important Claude Code sessions and they stay evergreen: easy to find from any project, never deleted by cleanup.**

If you use Claude Code every day, `claude --resume` quickly fills up with one-off sessions. The ones that matter, like a feature you've worked on for weeks, get buried. Worse, Claude Code deletes transcripts older than `cleanupPeriodDays` (30 days by default), so a long-running session can disappear.

`evergreen-sessions` fixes both problems:

| | |
|---|---|
| `/pin [note]` | Pin the current session, with an optional note |
| `/pins` | List pinned sessions from **every** project, each with a ready-to-run resume command |
| `/unpin [n \| id]` | Remove a pin (defaults to the current session) |
| `cc-pin` | From any terminal, pick a pin and resume it in the right folder |
| Auto-backup | Pinned transcripts are copied to a safe place and refreshed whenever the session ends. `cc-pin` restores them if cleanup deleted the original |

## Install

Requires Claude Code 2.1.275 or later. In a Claude Code session:

```
/plugin install evergreen-sessions --marketplace himanshu07gupta/claude-evergreen-sessions
```

Answer `y` to add the marketplace, then choose the user scope.

Optional: put the `cc-pin` command on your PATH (it needs `jq`; `fzf` is used when installed):

```bash
git clone https://github.com/himanshu07gupta/claude-evergreen-sessions ~/.claude-evergreen-sessions
ln -s ~/.claude-evergreen-sessions/bin/cc-pin /usr/local/bin/cc-pin
```

## Usage

```text
> /pin GST invoice export – phase 2
📌 Pinned "GST invoice export – phase 2" (405c1e53).
Transcript backed up; it is refreshed every time this session ends.

> /pins
Pinned sessions (2):

1. 📌 GST invoice export – phase 2  ← this session
     ~/work/invoices · 2026-10-12 · 405c1e53
     resume: cd ~/work/invoices && claude --resume 405c1e53-...
```

From any terminal:

```bash
cc-pin          # interactive picker
cc-pin list     # print pins
cc-pin 2        # resume pin #2
cc-pin 405c     # resume by id prefix
```

## How it works

- Pins are stored in `~/.claude/evergreen-sessions/pins.json` (or under `$CLAUDE_CONFIG_DIR` if set). It's plain JSON, so you can read, edit or sync it.
- Backups go in `~/.claude/evergreen-sessions/backups/`. Claude Code's cleanup only touches `~/.claude/projects/`, so backups are never deleted.
- The plugin is a Claude Code hooks module (`hooks/register.ts`): it registers the three slash commands at `session.start` and refreshes the backup at `session.end`.

## Similar projects

Other tools for session bookmarking and pinning, if you need more features:
[claude-pins](https://github.com/MasonFlint44/claude-pins) (fzf picker, fork/worktree modes),
[claude-bookmarks](https://github.com/Revaz-Goguadze/claude-bookmarks) (tags and search).
`evergreen-sessions` aims to be the zero-setup option: one `/plugin install`, no runtime to install,
and a real backup copy of every pinned transcript.

## Develop

```bash
claude plugin validate .
claude plugin test .
claude --plugin-dir .      # try it in a session
```

## License

MIT
