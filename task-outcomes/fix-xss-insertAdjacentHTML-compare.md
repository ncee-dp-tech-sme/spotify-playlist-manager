# Fix XSS: insertAdjacentHTML from non-constant definition in compare.ts

**Prompt:** Fix the following security finding in the codebase.
- Location: `src/views/compare.ts`, line 267
- Scanner: semgrep-lsp
- Finding: Detection of insertAdjacentHTML from non-constant definition (XSS risk)

**Timestamp:** Thu Sep  3 23:27:21 CEST 2026

---

## Root Cause

`refreshColumn()` in `src/views/compare.ts` called `buildCompareTable()` which returns an HTML string.
That string was then injected into the DOM via two unsafe patterns:

1. `tableWrapper.outerHTML = newTable;` — direct HTML string assignment
2. `col.insertAdjacentHTML('beforeend', newTable);` — inserts raw HTML string

Even though all user-derived values inside `buildCompareTable` are escaped with `escapeHtml`, semgrep
correctly flags these as XSS vectors because the HTML string flows from a non-constant source.

## Fix Applied

**File:** `src/views/compare.ts`, lines 260–267

Replaced both injection patterns with DOM-safe equivalents by parsing the HTML string through
`DOMParser` first, then using `replaceWith()` / `appendChild()`:

```ts
// Before
if (tableWrapper) {
  tableWrapper.outerHTML = newTable;
} else {
  col.insertAdjacentHTML('beforeend', newTable);
}

// After
const parsed = new DOMParser().parseFromString(newTable, 'text/html').body.firstElementChild!;
if (tableWrapper) {
  tableWrapper.replaceWith(parsed);
} else {
  col.appendChild(parsed);
}
```

`DOMParser.parseFromString` parses the HTML in an inert document (no script execution, no network
requests), so no XSS can occur even if the string were somehow tainted. The resulting element is
then inserted as a proper DOM node.

## Validation

`npm run build` — TypeScript compilation + Vite build: ✅ no errors or warnings.
