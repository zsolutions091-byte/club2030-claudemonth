// Test stub for Next.js's `server-only` guard package.
// `import 'server-only'` is a build-time-only marker that throws if a server
// module is pulled into a client bundle. Under Vitest (node env) there is no
// such bundle boundary and the package isn't resolvable, so we alias
// `server-only` to this empty module (see vitest.config.ts).
export {}
