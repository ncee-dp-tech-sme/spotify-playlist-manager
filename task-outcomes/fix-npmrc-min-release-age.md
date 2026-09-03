# Prompt
Fix the following security finding in the codebase.

**Location:** `/Users/erwin/Documents/Projecten/Github_repos/workspace_bob/spotify/.npmrc`, line 1

### Finding
## Scanner: semgrep-lsp

## Message
This .npmrc does not set a minimum release age or sets it too low. Newly published packages can be malicious or unstable. Add `min-release-age = 7` to wait 7 days before resolving newly published package versions. Added in: v11.10 Reference: https://github.blog/changelog/2026-02-18-npm-bulk-trusted-publishing-config-and-script-security-now-generally-available/

**Timestamp:** Thu Sep  3 23:40:00 CEST 2026

---

## Root Cause
The `.npmrc` file did not include `min-release-age`, meaning npm could immediately resolve and install newly published (potentially malicious or unstable) package versions.

## Fix Applied
**File:** `.npmrc`

Added `min-release-age=7` so npm waits at least 7 days before resolving newly published package versions.

### Before
```
allow-scripts=fsevents@2.3.3
```

### After
```
allow-scripts=fsevents@2.3.3
min-release-age=7
```

## Security Impact
Mitigates supply-chain attacks where a malicious package is published and immediately pulled in by a build. Requires npm v11.10+.
