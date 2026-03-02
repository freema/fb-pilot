# Changelog

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
