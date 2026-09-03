# Fix npm warn install-scripts for fsevents

**Prompt:** using npm install I get npm warn install-scripts 1 package has install scripts not yet covered by allowScripts: npm warn install-scripts fsevents@2.3.3 (install: (install scripts present)) Can you make changes so this doesn't happen?
**Timestamp:** Thu Sep  3 23:37:25 CEST 2026

---

## Root Cause

npm's `allowScripts` feature requires explicit opt-in for any package that runs install scripts.
`fsevents@2.3.3` is a macOS-only optional dependency pulled in transitively by Vite for its file watcher.
Without acknowledgement in `.npmrc`, npm emits a warning on every `npm install`.

## Fix Applied

Created `.npmrc` at the project root with:

```
allow-scripts=fsevents@2.3.3
```

This explicitly allows `fsevents` to run its install script, silencing the warning.
`fsevents` is a well-known, safe native module maintained by the Node.js ecosystem.

## Validation

`npm install` — completed with no warnings and 0 vulnerabilities. ✅
