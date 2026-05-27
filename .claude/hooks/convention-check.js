#!/usr/bin/env node
// Stop hook. Statically lints src/lib/actions/ and src/lib/validators/ for the
// THREE deterministic project invariants (no semantic judgement, no git needed
// — this project is not a git repo):
//   #4  every action file starts with 'use server'
//   #5  no relative imports in lib (must use the @/ path alias)
//   #3  no English throw new Error('...') strings (errors must be Hebrew)
// Advisory only: prints a summary if it finds violations, never blocks the Stop.
// The 2 SEMANTIC invariants (soft-delete correctness, audit-log completeness)
// are intentionally left to the convention-reviewer agent.

const fs = require('fs')
const path = require('path')

let input = ''
process.stdin.on('data', (chunk) => { input += chunk })
process.stdin.on('end', () => {
  try {
    // Resolve project root: hook is invoked with cwd = project root (like
    // vault-sync), but fall back to walking up from this file just in case.
    const candidates = [process.cwd(), path.resolve(__dirname, '..', '..')]
    const root = candidates.find((c) =>
      fs.existsSync(path.join(c, 'src', 'lib', 'actions'))
    )
    if (!root) return // nothing to lint — silent

    const actionsDir = path.join(root, 'src', 'lib', 'actions')
    const validatorsDir = path.join(root, 'src', 'lib', 'validators')

    const listTs = (dir) => {
      if (!fs.existsSync(dir)) return []
      return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.ts'))
        .map((f) => path.join(dir, f))
    }

    const actionFiles = listTs(actionsDir)
    const libFiles = [...actionFiles, ...listTs(validatorsDir)]

    const rel = (p) => p.slice(root.length + 1).replace(/\\/g, '/')
    const lineOf = (content, index) =>
      content.slice(0, index).split('\n').length

    const violations = []

    // #4 — 'use server' must be the first non-empty line of every action file.
    for (const file of actionFiles) {
      const content = fs.readFileSync(file, 'utf8')
      const firstLine = (content.split('\n').find((l) => l.trim().length) || '')
        .trim()
        .replace(/;$/, '')
      if (firstLine !== `'use server'` && firstLine !== `"use server"`) {
        violations.push(
          `#4 'use server' — ${rel(file)}:1 — missing/not-first-line directive`
        )
      }
    }

    // #5 — relative imports in lib must use the @/ alias.
    const relImport = /\b(?:from|import)\s+['"](\.\.?\/[^'"]*|\.\.?)['"]/g
    for (const file of libFiles) {
      const content = fs.readFileSync(file, 'utf8')
      let m
      while ((m = relImport.exec(content)) !== null) {
        violations.push(
          `#5 path alias — ${rel(file)}:${lineOf(content, m.index)} — relative import '${m[1]}' (use '@/...')`
        )
      }
    }

    // #3 — throw new Error('...') messages must be Hebrew (not English).
    const errLiteral = /throw\s+new\s+Error\(\s*(['"`])([^'"`]*)\1/g
    for (const file of libFiles) {
      const content = fs.readFileSync(file, 'utf8')
      let m
      while ((m = errLiteral.exec(content)) !== null) {
        const msg = (m[2] || '').trim()
        if (msg && /^[A-Za-z]/.test(msg)) {
          violations.push(
            `#3 Hebrew errors — ${rel(file)}:${lineOf(content, m.index)} — English error string: "${msg}"`
          )
        }
      }
    }

    if (violations.length === 0) return // clean — stay silent

    const body =
      `convention-check found ${violations.length} deterministic ` +
      `convention violation(s) in src/lib/ (advisory, not blocking):\n` +
      violations.map((v) => `  • ${v}`).join('\n') +
      `\nFix these before completing, or run /check-conventions for the full ` +
      `(incl. semantic soft-delete / audit-log) review.`

    process.stdout.write(JSON.stringify({
      systemMessage: `⚠️ convention-check — ${violations.length} violation(s) in src/lib/`,
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext: body,
      },
    }))
  } catch {
    // Silent failure — hooks must never break the user's flow.
  }
})
