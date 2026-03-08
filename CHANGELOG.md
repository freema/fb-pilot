# Changelog

## 1.1.0 (2026-03-08)

### Added
- Auto-scroll — automatically scrolls the reaction list to load more users (no more manual scrolling)
- `scrollIntoView()` before each click so humanClick dispatches at visible coordinates
- `startsWith` matching for aria-label (catches "Pozvat uživatele XY" etc.)

### Changed
- Default language switched to Czech (CZ)
- Default invite word changed from "Invite" to "Pozvat"
- Soft limit streak threshold raised from 3 to 5 (fewer false positives)
- Post-click DOM check wait increased from 300ms to 600ms
- `isVisible()` simplified — removed overly strict `offsetParent` check
- `findInviteTextNodes()` now uses innermost-match logic instead of leaf-node-only filter
- Unit tests updated and expanded (101 tests total)

## 1.0.0 (2026-03-02)

### Added
- Content script with human-like click automation (mouseover → mousedown → mouseup → click)
- Invite button detection for configurable button text (default: "Invite" / "Pozvat")
- State machine: IDLE → RUNNING → WAITING_FOR_SCROLL → SOFT_LIMITED → BATCH_DONE
- MutationObserver for detecting new invite buttons after scroll
- Configurable random delays between clicks to avoid pattern detection
- Coffee break pauses at configurable intervals
- Soft limit detection when button text doesn't change after click
- Background service worker with daily counter and badge updates
- Popup UI with Start/Stop, status indicator, batch and daily counters
- Settings panel: invite text, max per batch, delay range, coffee break config
- Bilingual support (EN / CZ)
- Dark mode support via `prefers-color-scheme`
- Unit tests (Jest + jsdom) for content script, background, and popup
- E2E tests (Puppeteer) for extension loading and popup UI
- GitHub Actions CI pipeline
