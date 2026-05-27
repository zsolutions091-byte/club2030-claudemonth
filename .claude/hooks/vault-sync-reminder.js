#!/usr/bin/env node
// PostToolUse hook for Write|Edit.
// Reads the tool payload from stdin; if the edited file is in a watched
// architectural area, emits `additionalContext` to remind Claude to invoke
// the vault-keeper agent. Silent for unrelated edits.

let input = ''
process.stdin.on('data', (chunk) => { input += chunk })
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}')
    const filePath = data.tool_input?.file_path || data.tool_response?.filePath || ''
    if (!filePath) return

    const norm = filePath.replace(/\\/g, '/')

    const triggers = [
      { pattern: /\/src\/lib\/actions\//,            kind: 'server action' },
      { pattern: /\/src\/lib\/validators\//,         kind: 'Zod validator' },
      { pattern: /\/src\/app\/.*page\.tsx$/,         kind: 'view (route page)' },
      { pattern: /\/src\/components\/(?!ui\/)/,      kind: 'component' },
      { pattern: /\/prisma\/schema\.prisma$/,        kind: 'Prisma schema' },
      { pattern: /\/\.claude\/agents\//,             kind: 'subagent definition' },
      { pattern: /\/\.claude\/hooks\//,              kind: 'hook script' },
      { pattern: /\/\.claude\/settings\.json$/,      kind: 'Claude settings' },
    ]
    const hit = triggers.find((t) => t.pattern.test(norm))
    if (!hit) return

    const rel = (norm.split('Claude Code Month/').pop()) || norm

    const reminder =
      `vault-sync: ${hit.kind} was modified (${rel}). ` +
      `If this is an architectural change (new/modified model, action signature, view, or component group), ` +
      `invoke the vault-keeper agent before completing the task to keep vault/ docs, Architecture.canvas, ` +
      `and File Map.md in sync. Skip if internal-only refactor.`

    process.stdout.write(JSON.stringify({
      systemMessage: `🔔 vault-sync check — ${hit.kind}`,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: reminder,
      },
    }))
  } catch {
    // Silent failure — hooks must never break the user's flow.
  }
})
