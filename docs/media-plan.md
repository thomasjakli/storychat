# Milestone 4 plan: character covers and scene media

Status: planning only, 2026-10-30. No media provider, paid service, generation job or deployment change is enabled. Milestones 1–3 remain complete; deferred owner recovery testing stays non-blocking. This plan adds milestone 4 without changing those acceptance decisions.

## Current priority — owner scope decision

Character title/cover image uploads remain wanted. Stage 4A is the active planned scope: upload, preview/crop, replace/remove, authenticated serving, durable storage and backup/restore. It needs no image-generation provider. Stage 4A remains planning, not an implemented feature.

Message-based image/video generation (stages 4B/4C) is shelved pending a future provider discussion. Do not implement generation buttons, media-provider integrations, generation queues or prompt-generation requests as part of character uploads. Message attachments/gallery, manual scene-generation workflows and video/audio controls below are retained as deferred design ideas, not requirements for 4A. No meeting or reminder has been scheduled.

## Confirmed scope

- Each character can have a title/cover image shown in its library card and character details.
- Deferred: illustrate a completed story message as an image or short video representing its scene.
- Deferred: video duration, quality/resolution and sound controls, subject to provider selection.
- Keep the Android-first, sole-owner deployment, original interface and no in-app payments. External generation costs require separate approval.

## Provider feasibility gate

Official documentation checked 2026-10-30 explicitly lists image generation as unsupported in the current ChatGPT plan integration. Its documented inference route does not establish a subscription-authorized video generation route. Having image/video features in a consumer subscription does not establish programmatic access from this application. [Current integration limits](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).

Keep the existing ChatGPT story adapter unchanged. Add a separate capability-based media adapter; never send its credentials to an image/video endpoint based on assumption. Evaluate these routes before enabling generation:

| Route | Intended use | Evidence/decision needed |
| --- | --- | --- |
| Upload existing files | Covers and message-linked images/videos | Implementable without generation-provider access; user selects original or permitted assets |
| Manual generation/import | Copy an editable scene prompt, generate using an authorized external interface, upload result | No browser/session automation; no promise of one-click generation or consumer video eligibility |
| Self-hosted generation | Optional endpoint for image/video jobs | Hardware/GPU, model licensing, identity-reference support, audio and operational limits must be verified; existing amd64 Docker host does not imply suitable GPU capacity |
| External media API | Optional integrated generation | Verify official API access, supported parameters, pricing, privacy and account eligibility; explicit owner approval before separately billed use |

The chosen image and video backends may differ. This is an extension for media, not a replacement of the single instance ChatGPT story connection. No particular backend/model is selected. Do not substitute unsupported account-token reuse, scraping or undocumented endpoints. Provider selection blocks real automated generation only, not uploaded covers or media storage/UI.

## Owner experience

### Character cover

Add Upload/change cover, crop/focal-point preview, accessible description and Remove cover to the character editor. Use a portrait-friendly card with a readable text overlay and an original placeholder when no cover exists. Preserve aspect ratio and provide a larger preview. Generated covers can be added after the image adapter is verified.

A cover is presentation metadata, not a memory. Version the cover reference with the character definition; existing stories retain their chosen cover snapshot unless the owner explicitly updates that story's artwork. Duplicates initially share a managed asset reference; replacing/deleting one reference must not break another character or story.

### Illustrate a message

Under a completed, active message offer Create image and Create video, plus Attach existing media. Open an Android-friendly dialog with an editable scene brief, selected source message, character reference and supported settings. Exclude failed/pending/superseded messages from new generation; retained old media remains inspectable as earlier-version artwork.

Build the scene brief from that message, its story's character/persona snapshots, established appearance, fictional scene/time and a bounded relevant context. Review this brief before submission. Exclude unrelated stories and future turns. Text-to-prompt assistance is optional and explicit; it must not silently make another ChatGPT request. Start with deterministic assembly and manual editing.

| Image controls | Video controls |
| --- | --- |
| Editable brief, style, aspect ratio, supported size and quality, optional reference image | Editable brief, supported duration, aspect ratio, resolution/quality, sound on/off when supported, optional starting image |

Do not hardcode purported provider choices such as a fixed duration/resolution list before verification. Sound means generated audio where available, not guaranteed spoken dialogue or voice cloning. Show unsupported controls as unavailable with a reason. Never silently substitute requested settings or add a separate audio service. Confirm transmitted text/reference files and any known external cost before Generate; unknown cost is labelled unknown rather than estimated as free.

Show durable queued/running/completed/failed/interrupted/unknown states and cancellation where actually supported. Return to chat immediately while the job runs. Results appear below the source message as thumbnails or click-to-play clips, with full-screen preview, download, delete and Generate another version. No autoplay sound. Each regeneration is an explicit new job; retain the prior result until deletion. A story gallery is a view of these same assets, not another storage copy.

If generation is unconfigured, provide uploads and prompt export with a clear connection notice. Do not show fake output as real generation or present provider configuration as a paid feature tier.

## Architecture and integrity

- Keep binary files in a dedicated private media volume, separate from SQLite and provider keys; SQLite stores asset metadata, ownership, references and jobs. Add a configurable capacity limit and usage display.
- Asset records: opaque ID, kind, validated MIME/container, byte size, dimensions/duration/audio metadata, checksum, created timestamp, thumbnail reference and lifecycle state. Preserve original filename only as sanitized display metadata, never a path.
- Association records link assets to character versions or story/message IDs and source revisions. Job records persist request/idempotency key, immutable source snapshot/hash, edited brief, requested/effective settings, provider identifier/job ID, asset IDs and bounded safe error. Keep secrets and signed download URLs out of ordinary logs and browser bundles.
- Adapter contract: capabilities(), submit(request), status(providerJobId), downloadResult(), optional cancel(). Capabilities describe actual accepted sizes/durations/audio/reference modes and concurrency, not marketing model names. Validate every request server-side against the chosen adapter.
- Use a small durable SQLite-backed job queue with bounded concurrency (initially one media job), backpressure, deadlines and explicit retry. No Redis or recurring model work is required initially. Status polling only follows owner-created jobs.
- On restart resume provider status checks where supported. An ambiguous submission must not auto-resubmit or charge twice: preserve unknown state and require reconciliation/user action. Cancellation is best effort and may not prevent provider cost.
- Capture source revision at submission. Editing/regenerating a chat message must never attach a late result to a new message or apply narrative state. Mark the asset as an earlier revision if the source changed. Generated images/video do not establish facts, complete promises, advance fictional time or alter relationship state.
- Character consistency uses approved reference assets and a stable appearance/style brief where supported; treat resemblance as a quality target, not a guarantee.

## Privacy, storage and recovery

- Require owner authentication on upload, metadata, thumbnails, full content and byte-range video requests. Enforce story boundaries on every lookup. No public bucket, predictable static uploads directory or unauthenticated signed links.
- Validate file signatures as well as extension/MIME, dimensions/pixel count, duration and byte limits. Initially allow a small verified raster-image/video format set; reject active SVG/HTML and arbitrary archives. Decode/transcode in a constrained worker with time/resource limits; strip location/EXIF metadata from served images. Pick decoding/transcoding dependencies during implementation review.
- Do not fetch arbitrary user-supplied URLs. Provider downloads must use adapter-controlled destinations, bounded redirects/bytes/time and private-network protections. Do not execute text, filenames or model output as commands.
- Media deletion removes its association first; remove binaries/thumbnails only when no retained reference needs them. Story/character deletion and in-flight completion must not resurrect removed content. Explicit asset deletion cancels or tombstones relevant jobs. Explain that backups/provider copies are separate from local deletion.
- Extend backup manifests with media checksums and a consistent database/media snapshot. Keep the current JSON-only export clearly labelled text-only until a versioned media-aware export is available. Import rejects path traversal, excessive expansion, missing/checksum-mismatched assets and collisions atomically; account for orphan cleanup after crashes.
- Use additive database migrations, preserve pre-media stories, document rollback constraints and protect the new Docker volume. Do not change production routes or infrastructure automatically. All examples and fixtures remain synthetic and generic; private screenshots are not published or copied into assets.

## Delivery stages and acceptance

### 4A — media foundation and covers

Implement authenticated storage, validation/thumbnails, character cover selection/versioning, removal/reference counting, migration and media-aware backup/restore. Accept when covers survive restart/replacement, old stories keep snapshots, invalid/oversized files fail safely, unauthorized media reads fail, shared references survive deletion, and isolated restore recovers matching checksums. Verify Android upload/crop/readability. No real generation provider is needed.

### 4B — scene images

Implement source-linked attachments/gallery, editable scene briefs, capability UI and durable fake media jobs, then integrate a verified owner-approved image backend. Accept when source revision/isolation, explicit submissions, duplicate/retry protection, interruption recovery, limits, failure handling and deletion suppression pass deterministic tests. Real integration additionally needs a bounded authorized generation proving image delivery and reference consistency; fake tests do not complete that gate. Manual prompt export/import remains usable if automatic access is unresolved.

### 4C — short video and optional sound

Integrate a verified video adapter with duration/resolution/audio capability discovery, poster thumbnails, seeking/range delivery and no-autoplay playback. Accept when supported choices are honored, unavailable choices are explained, cancellation/ambiguous submissions do not silently duplicate jobs, restart/background recovery works, storage limits are enforced, and one bounded authorized video is delivered. Test sound off/on only where actually supported. Android codec/playback and real provider checks remain separate acceptance evidence.

Recommended roles: Product/Architecture Planner maintains provider and scope decisions; Model Integration Engineer validates media access; Story/Memory Engineer owns immutable scene/source contracts; Android Experience Developer owns covers/dialogs/gallery/playback; Self-hosting/Security Engineer owns storage, upload workers and recovery; Quality Tester independently verifies lifecycle, isolation and device criteria. Agree schema/API contracts and file ownership before parallel implementation.

## Decisions to resolve before real generation

1. Image and video access route: manual import, a self-hosted endpoint, or an explicitly approved external API. Research does not authorize charges.
2. If self-hosted: available GPU/memory and supported model/runtime, without publishing private hardware/network topology.
3. Storage/job limits, preferred visual style and initial default aspect ratio; use conservative implementation proposals until selected.
4. Sound expectations: ambient effects/music versus authored dialogue, and whether the chosen provider supports them. Do not imply real-person voice cloning.

This plan authorizes no implementation or provider activity by itself. The next implementation request should cover 4A only. Provider evaluation and stages 4B/4C remain shelved until the owner reopens them; they do not block uploaded character covers.


Implementation update (2026-10-31): active local-character/cover/localization scope implemented with synthetic verification; see project.md for evidence and pending Android acceptance. Earlier proposals describe the design baseline, not proof of device acceptance. External retrieval, private character trial and generation remain deferred.
