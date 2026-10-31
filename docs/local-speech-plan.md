# Local speech recognition: feasibility and delivery plan

Status: planning only, 2026-10-31. Owner strongly prefers recognition to remain local and requires support for both Android Firefox and Android Chrome. This supersedes the browser-service proposal in narration-and-dictation-plan.md. Target phone-local recognition; no automatic cloud, browser-service or Docker-server transcription fallback. A LAN-hosted engine would still transmit microphone audio and requires a separate owner decision if phone-local performance fails. No software/model downloads, microphone capture, deployment or inference are authorized by this planning entry alone.

## Recommended approach

Prove a bundled browser inference engine on real Android Firefox and Android Chrome before promising integrated dictation. Both are release targets, not primary/optional browsers. Serve pinned JavaScript/WASM and selected model files from the authenticated Storychat origin; inference runs in a dedicated browser Worker. Do not rely on native SpeechRecognition for local guarantees. WebGPU is an optional later Chrome acceleration path, never the shared baseline or a prerequisite. Start with WASM CPU and single-thread execution; investigate multithreading/COOP/COEP only with measured need and proxy/auth compatibility review.

Shortlist (research, not verified on owner device):

| Candidate | Benefit | Cost / uncertainty |
| --- | --- | --- |
| Transformers.js, multilingual quantized Whisper tiny | Shared EN/DE model, maintained documented local-model configuration | Published model tree lists quantized encoder10.1MB + merged decoder30.7MB (about41MB weights only); runtime/tokenizer/config add more. Decode latency and peak phone memory unknown; test short clips first |
| Vosk with browser WASM wrapper, small EN and DE models | Offline streaming-oriented option, smaller language-specific models | Official model list EN40MB / DE45MB archives; each language needs a model. Browser wrapper is third-party and needs maintenance/security review; published demo code is not proof of current Android Firefox support |

Proposed sequence: try quantized multilingual Whisper tiny first in an isolated spike; evaluate Vosk only if measured CPU latency/memory makes Whisper unsuitable. The production selection remains conditional on measurements and licensing/dependency review. Do not ship both engines/models merely to avoid deciding. Download size is not runtime memory. Verify exact model revision, required file manifest, license/attribution and total transferred bytes before packaging. No general model-hub download or CDN runtime fetch on the phone.

Primary sources checked by research agents: [Transformers.js local models/runtime configuration](https://huggingface.co/docs/transformers.js/custom_usage), [WebGPU limitations](https://huggingface.co/docs/transformers.js/guides/webgpu), [Whisper tiny ONNX model files](https://huggingface.co/onnx-community/whisper-tiny/tree/main/onnx), [Vosk models and licenses](https://alphacephei.com/vosk/models), [Vosk browser wrapper](https://github.com/ccoreilly/vosk-browser). These establish available approaches, not device performance.

## Privacy, assets and browser storage

- HTTPS microphone capture starts only after an explicit tap and permission. AudioWorklet/resampling pipeline produces bounded mono PCM in memory; no app audio upload, audio logs, transcript telemetry or server transcription endpoint.
- All recognition input remains browser-memory data. Release microphone tracks, AudioContext, worker buffers and any object URLs on stop/cancel/navigation/lock/background; browser/OS memory erasure cannot be guaranteed. No persistent audio.
- Before first use show model size, model language and download/storage consent. Download static model files from this instance; disclose that first download requires a connection. First use and uncached startup are not offline-ready.
- Cache versioned model/runtime assets separately from private API responses; verify manifest hashes and completeness before ready. Reuse an intact model offline, expose remove/download-again and storage usage, and handle browser eviction/quota failure safely. Persistent storage requests are optional and never guarantee retention. Model assets are not conversation backups.
- Disable Transformers.js remote-model fetching, set localModelPath and WASM paths explicitly. No remote redirects/CDNs or service-recognition fallback. Initial CSP remains same-origin; add explicit worker-src self and only the WASM permission actually required. Do not add broad unsafe-eval/unsafe-inline or change external infrastructure to make the spike work.
- Test network request capture while recognizing: no audio or intermediate text leaves the browser. Application traffic can still exist; offline recognition means the speech engine works without a network, not that ChatGPT story replies become offline.

## Composer contract

Adapter states: unavailable / model-missing / downloading / ready / recording / transcribing / review / error. Methods: prepare(language), start(sessionId), stop(), cancel(), dispose(); expose bounded progress/final/error callbacks tagged with session and story IDs. Never automatically restart or download another model after failure.

Initial UX: explicit English/German language, short push-to-record clip (proposed30-second cap), Stop to transcribe, separate review area with Insert/Discard. Start with final results rather than promising live partial streaming. Insert once at saved selection only if draft/story revision is unchanged; otherwise retain the result for owner-directed insertion. Preserve stars, typed text and length limits; never truncate, auto-send or call ChatGPT. Discard stale callbacks after cancellation/story change/logout; background/send abort capture. Normal typing and narration toolbar remain usable.

Use localized accessible status, progress and errors. Unsupported devices keep typing available; keyboard dictation is optional owner-controlled OS functionality, not proof of local processing. No app button silently delegates to the keyboard's cloud service.

## Staged delivery and go/no-go

1. Isolated synthetic spike, fake story provider. Record actual device/browser version; cold/warm load time, transferred asset bytes, clip length, transcription time, UI responsiveness, observable memory pressure/crashes, thermal/battery symptoms and EN/DE accuracy. Use original synthetic sentences covering names, punctuation, corrections and surrounding narration. Do not automatically obtain private microphone recordings.
2. First proposed target: a10-second clip produces an editable result within10seconds after stop on the owner's actual phone, with responsive UI and no browser crash across five consecutive clips. These are proposed usability thresholds, not known results. A slow result is visible and cancellable; worker termination must recover cleanly. If unmet, test the alternative or report a blocker instead of enabling remote recognition.
3. Implement model cache lifecycle, bounded microphone pipeline and adapter; deterministic fake-engine tests cover download failures/hash mismatch/cache eviction, repeated/stale results, permission denial/cancel, concurrent user edits, limits, logout/background and zero inference/send.
4. Independent security QA checks no speech upload/third-party fetch; start from cached assets with network unavailable and verify recognition. Test browser restart and removed/evicted model behavior. Check ordinary app/auth/provider regressions.
5. UI screenshot review EN/DE at360/390px and desktop plus actual Android Firefox and Chrome microphone/selection/background behavior, in ordinary tabs and their available home-screen launch modes. Each browser/mode requires its own evidence; desktop or Chrome success does not complete Firefox acceptance.

Planner owns manifest/adapter contract and measured engine choice. Android Experience owns capture, Worker and review/insertion UI; Security owns pinned same-origin delivery/CSP/cache/privacy review; Quality independently verifies offline/network/failure evidence; Story/Memory ensures transcript insertion preserves text/source semantics; Model Integration preserves ChatGPT credentials and zero automatic requests. Assign non-overlapping files after the spike contract. No production deployment or separate billing.

Milestone status: feasibility pending real-device spike. Narration formatting can proceed independently. No new owner decision needed until measured evidence identifies a tradeoff; inability to meet local performance must be reported, not resolved through unapproved remote fallback.


## Dual-browser clarification (owner requirement, 2026-10-31)

The same local dictation feature must work in **Android Firefox and Android Chrome**. Neither browser is a fallback-only target. Same architecture and text insertion semantics; capability-based optimizations may differ. Unsupported hardware or browser failure must be reported rather than silently routing speech to another service. Device-independent guaranteed performance remains unverified.

### Shared baseline and differences

| Area | Shared implementation | Browser-specific verification |
| --- | --- | --- |
| Microphone/audio | HTTPS, explicit tap/permission, getUserMedia, AudioContext + AudioWorklet; actual-rate PCM resampling | Permission denial/revocation, suspended AudioContext resume, actual sample rate/channel constraints and Android microphone indicator |
| Local inference | Dedicated Worker, asynchronous WASM load, single-thread CPU baseline | Exact pinned model/runtime must load and transcribe in each browser; measure latency/memory separately |
| Accelerators | No WebGPU/WebNN dependency | Optional Chrome acceleration only after shared CPU route passes; identical privacy/output contract |
| Model storage | Explicit, checksummed versioned cache; quota/eviction recovery | Firefox and Chrome profiles have separate storage. Opening the other browser may require another model download. Do not promise shared cache or persistence based on installation |
| Installed launch | Same authenticated origin and app controller | Test ordinary tab plus actual available home-screen/standalone mode in each browser; installation itself does not grant microphone permission or offline app launch |
| Lifecycle | Abort capture on hidden/pagehide/logout/story switch; no background recording or restart | Screen lock, app switch, process eviction, navigation and relaunch may differ. Foreground must show cancelled/interrupted rather than resume recording |

AudioWorklet is established on both browser families according to [MDN compatibility data](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/AudioWorklet.json). Use AudioWorkletNode's established processor message port; do not depend on the newer experimental AudioWorklet.port property. [ONNX Runtime's supported-browser matrix](https://onnxruntime.ai/docs/get-started/with-javascript/web.html) lists WASM for Chrome Android and Firefox Windows, but does **not** explicitly list Firefox Android. This is a reason for a real Firefox Android compatibility gate, not evidence that it cannot work or that desktop Firefox proves support. [Storage quotas/eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) and [page visibility behavior](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) also require lifecycle handling rather than an installed-app assumption.

### Release matrix and go/no-go

Record device/Android version and browser version for four sessions: Firefox tab, Firefox home-screen launch where available, Chrome tab, Chrome installed/home-screen launch. For each, test EN/DE model download and eviction/reinstall, microphone permission/denial, 5/15/30-second clips, final review/insertion, draft edits while transcribing, cancellation, background/screen lock and restart. Reuse the same synthetic phrases and compare results; CPU/WASM should be tested in Chrome even if accelerated mode is available. Validate first-load download and warmed model use separately.

The proposed 10-second-clip/10-second-result target and five-consecutive-session stability test apply independently to **both browsers on the owner's target hardware**. No pass may be borrowed from another browser, an emulator or a desktop. If either fails, compare the alternative local engine using the same fixtures and revise limits with owner-visible evidence. Do not declare integrated dictation complete while Firefox is merely provided keyboard instructions. Keyboard dictation remains outside application privacy guarantees.

For both browser tabs and launch modes, after model readiness disable network and verify recording/transcription/review without any speech upload; separately inspect requests while online to distinguish static model fetches from prohibited audio/text transmission. Cold offline login/launch and ChatGPT story replies remain outside this recognition acceptance. At implementation time recheck pinned runtime support and keep source/DOM, desktop screenshots, synthetic engine tests and actual Android evidence distinct.
