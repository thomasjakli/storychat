# Isolated UX review preview

This development preview uses original synthetic characters, personas, long conversations and pictures. It uses fake inference only and never loads production provider credentials. It is not a production deployment.

## Start or restart

From the repository root, install the normal dependencies if needed, then run with Node24 or later:

```sh
node scripts/preview-ux.mjs
```

Windows PowerShell alternative:

```powershell
./deploy/start-ux-preview.ps1 -NodeExecutable node
```

If Node24 is not on PATH, provide its executable path through `-NodeExecutable`. Optional `-Port 8797` changes only the loopback port. The launcher always binds127.0.0.1. It does not configure LAN exposure, reverse proxies, DNS or tunnels.

Open http://127.0.0.1:8796/ on the host PC. Login password is `synthetic-preview-password`, deliberately a test-only value. Phone access requires a separately authorized device-accessible route; loopback on a phone is not the PC. No new network route is configured by this launcher.

Stop with Ctrl+C before restarting. A dedicated runtime lock prevents accidentally opening the retained preview database in concurrent preview processes. The process may end when the terminal/session or PC stops; restart the launcher to resume. This preview is not installed as a background service.

## Retained test content

- `data/ux-review/preview.sqlite` and `data/ux-review/media/` retain synthetic review content and owner test edits across restarts. They are ignored by Git and excluded from container images.
- `data/ux-review/sample-character.storychat.json` and `sample-persona.storychat.json` are original synthetic media-aware import fixtures for the character/persona libraries.
- Initial seed contains seven characters, one draft character, a persona, several stories and one longer conversation with narration, thought blocks and source-linked memory. Existing nonempty preview libraries are not reseeded on every restart.
- Send ordinary text for a clearly labelled successful FAKE reply. Include `[simulate failure]` in a user message for a deterministic failed request. Thought generation pauses briefly for loading/cancel review and also fails when that marker is in recent context. No network inference happens.

Do not import private stories or credentials into a demonstration meant for screenshots. Use separate disposable data for destructive recovery testing. Never point this launcher at production storage; its data root is fixed to the isolated preview folder.

## Backend UX contracts

Authenticated `GET /api/transfer-limits` advertises notebook/item request limits and upload limit; the server still enforces validation and bounds. With media enabled, notebook/item request cap is384MiB and image upload is8MiB. The logical data subset still has its separate8MiB validation budget.

Item preview returns the existing type/data plus `thumbnail` (validated embedded WebP data URL or null) and `status` (draft/ready). Preview validates image content without installing it, fetching a remote URL or sending inference. Story summaries expose bounded180-character last ordinary-message previews, never full definitions, thought text or stored provider contexts.
