# FB Pilot

> Chrome extension pro správu Facebook stránek. Hromadné zvání fanoušků ze seznamu reakcí s lidským klikáním a ochranou proti rate limitům.

![CI](https://github.com/user/fb-pilot/actions/workflows/test.yml/badge.svg)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Tests](https://img.shields.io/badge/tests-101%20passing-brightgreen)

## How It Compares

| Feature | FB Pilot | [Auto Page Inviter](https://www.autopageinvite.com/) | [Invite Fans & Likers](https://chromewebstore.google.com/detail/eiamkpbeehcnmbilkjkflelnendbmmhi) | [GitHub Gist script](https://gist.github.com/guiliredu/ef83ac2c81452a7116956f3fd73b406d) |
|---------|----------|---------------------|--------------------------|----------------|
| Human-like events (mouseover→mousedown→mouseup→click) | **Yes** | Unknown | Unknown | No (bare `.click()`) |
| Soft limit detection | **Yes** (text-change check) | No | No | No |
| Auto-scroll | **Yes** (finds scrollable container) | No | No | No (manual scroll) |
| MutationObserver for new buttons | **Yes** | No (scroll loop) | No | No (manual scroll + retry) |
| Coffee break pauses | **Yes** | Unknown | No | No |
| Random delays | Yes | Yes | Yes | Yes (2-4s fixed) |
| Configurable invite text | **Yes** (any language) | English only | English only | English `aria-label` only |
| Daily counter + badge | **Yes** | Session stats | No | Console log |
| State machine | **Yes** (5 states) | Basic start/stop | Basic | None |
| Dark mode | **Yes** | No | No | N/A |
| Bilingual UI (CZ/EN) | **Yes** | English only | English only | N/A |
| Open source | **Yes** | No | No | Yes |
| Unit tests | **101 tests** | None public | None public | None |
| Price | Free | Free | Freemium (250/day free) | Free |

### What makes FB Pilot different

1. **Human-like event sequence** — dispatches `mouseover → mousedown → mouseup → click` with correct coordinates calculated from `getBoundingClientRect()`. Most alternatives just call `.click()` which is trivially detectable.

2. **Soft limit detection** — checks if button text actually changes after click. If 5 consecutive clicks don't change anything, FB is throttling and the extension stops automatically. No other tool does this.

3. **Auto-scroll** — automatically scrolls the reaction list to load more users. No need to manually scroll — just click Start and walk away.

4. **MutationObserver** — reacts to actual DOM changes after auto-scroll. More responsive and less wasteful than blind retry loops.

5. **State machine** — clean 5-state model (IDLE → RUNNING → WAITING_FOR_SCROLL → SOFT_LIMITED → BATCH_DONE) instead of boolean flags. Predictable behavior.

6. **Coffee breaks** — periodic longer pauses to further randomize the pattern.

## Features

- **Human-like clicking** — realistic mouse event sequences with calculated coordinates
- **Auto-scroll** — automatically scrolls reaction list to load more users
- **Configurable invite text** — works with "Pozvat", "Invite", or any custom text
- **Random delays** — configurable min/max range between clicks
- **Coffee breaks** — automatic pauses at configurable intervals
- **Soft limit detection** — auto-stops when Facebook starts throttling
- **MutationObserver** — detects new buttons after auto-scroll
- **Daily counter** — tracks invites per day with extension badge
- **Bilingual UI** — Czech (default) and English
- **Dark mode** — follows system preference

## Installation

1. Clone:
   ```bash
   git clone https://github.com/user/fb-pilot.git
   cd fb-pilot
   ```

2. Open `chrome://extensions` in Chrome

3. Enable **Developer mode** (top-right toggle)

4. Click **Load unpacked** → select the project root

5. FB Pilot icon appears in your toolbar

## Usage

1. Go to a Facebook page you manage
2. Open a post's reaction list (click on the reaction count)
3. Click the FB Pilot icon in toolbar
4. Click **Spustit** (Start)
5. The extension auto-clicks invite buttons and auto-scrolls to load more
6. Click **Zastavit** (Stop) to pause, or wait for the batch to complete

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Invite button text | `Pozvat` | Text on buttons. `Invite` for English, etc. |
| Detection mode | `both` | Text + aria-label, text only, or aria-label only |
| Max per batch | `50` | Stop after N successful invites |
| Min delay (ms) | `800` | Minimum wait between clicks |
| Max delay (ms) | `2500` | Maximum wait between clicks |
| Coffee break every N | `15` | Pause after every N clicks |
| Coffee break duration | `5000` | Pause length in ms |

## States

| State | Color | Meaning |
|-------|-------|---------|
| Nečinný / Idle | Blue | Not running |
| Běží / Running | Green | Clicking invite buttons |
| Auto-scroll | Yellow | No more buttons — auto-scrolling to load more |
| Soft limit | Red | Facebook is throttling — stop and try later |
| Dávka dokončena / Batch done | Blue | Reached max per batch |

## Development

### Prerequisites

- Node.js 20+
- Chrome (for E2E tests)

### Setup

```bash
npm install
```

### Scripts

```bash
npm test              # All unit tests
npm run test:unit     # Unit tests only
npm run test:coverage # Unit tests with coverage report
npm run test:e2e      # E2E tests (needs Chrome)
npm run lint          # ESLint check
npm run lint:fix      # ESLint auto-fix
npm run validate:manifest  # Validate manifest.json
npm run ci            # Full CI pipeline (lint + validate + tests + coverage)
```

### CI Pipeline

GitHub Actions runs on every push/PR to `main`:

1. **Lint & Validate** — ESLint + manifest.json validation
2. **Unit Tests** — 101 tests with coverage report (uploaded as artifact)
3. **E2E Tests** — Puppeteer in headed Chrome via xvfb

### Project Structure

```
fb-pilot/
├── manifest.json            # Chrome Extension manifest (V3)
├── content/
│   └── content.js           # Content script — core clicking logic
├── background/
│   └── background.js        # Service worker — daily counter, badge
├── popup/
│   ├── popup.html           # Extension popup
│   ├── popup.css            # Styles (dark mode)
│   └── popup.js             # Logic, i18n, settings
├── icons/                    # Extension icons (16, 48, 128px)
├── tests/
│   ├── setup.js             # Chrome API mocks
│   ├── content.test.js      # Content script tests
│   ├── background.test.js   # Background tests
│   ├── popup.test.js        # Popup tests
│   └── e2e/
│       ├── setup.js         # Puppeteer setup
│       └── extension.test.js
├── scripts/
│   ├── generate-icons.js    # Icon generation
│   └── validate-manifest.js # Manifest validator
├── .eslintrc.json           # ESLint config
├── .github/
│   └── workflows/
│       └── test.yml         # CI pipeline
└── CHANGELOG.md
```

### Test Coverage

| Module | Tests |
|--------|-------|
| `content.js` — humanClick | Event dispatch order, coordinate calculation |
| `content.js` — findInviteTextNodes | Visible matching, hidden filtering, case-insensitive |
| `content.js` — getClickableTarget | button/role=button/a detection, disabled/aria-disabled, no parent |
| `content.js` — State machine | All 5 states, transitions |
| `content.js` — randomDelay | Within configured range |
| `background.js` — Daily counter | Increment, persist, get |
| `background.js` — Midnight reset | Date change reset, same-day preserve |
| `background.js` — Badge | Text + color update, zero clearing |
| `popup.js` — i18n | EN/CZ keys, language switching |
| `popup.js` — Settings | UI read/write, chrome.storage persistence |
| `popup.js` — updateUI | Counter, banner, scroll prompt, button states |

## FAQ

**Q: Does this work with non-Czech Facebook?**
A: Yes — change "Invite button text" in Settings to match your locale (e.g., "Invite" for English, "Einladen" for German).

**Q: What's the soft limit?**
A: When Facebook silently ignores your clicks (button text stays "Pozvat" instead of changing to "Pozván(a)"), the extension detects this and stops after 5 failed attempts.

**Q: Is this safe?**
A: The extension mimics human behavior with random delays and coffee breaks. However, excessive use can trigger Facebook's rate limits. Use reasonable settings.

**Q: Why `activeTab` + `host_permissions`?**
A: `activeTab` for popup-to-tab communication, `host_permissions` for the content script to run on facebook.com.

## License

See [LICENSE](LICENSE) for details.

## Testing

This section was added by CodeForge E2E Test 2.
