# Milestone 2 verification

Historical milestone evidence: statements about pending deployment/device work below describe that stage. All three milestones are now complete; current acceptance and deferred recovery checks are recorded in project.md and docs/milestone-3-verification.md.
Reviewed 2026-10-30 by the Quality and Continuity Tester role.

## Scope

Independent review covers original synthetic continuity scenarios, SQLite persistence, context selection, state correction, story isolation, strict output validation, owner authentication, and failure recovery. It does not access the real credential vault or make live model requests. Browser/device evidence is reported separately by the coordinator.

Use bundled Node 24.22.1 or another supported Node 24 runtime:

```powershell
node app/test.mjs
```

The suite uses built-in experimental `node:sqlite`, generated temporary databases, scripted/fake provider responses, local HTTP listeners, and child Node processes. The managed sandbox cannot open the required local listeners; execution outside that sandbox was approved. No permissions were weakened and no external infrastructure was changed.

## Independent scenarios

| Scenario | Evidence and practical limit |
| --- | --- |
| Durable relationship state | An original lighthouse story establishes a fact, accepted compass promise, trust event, fictional thought, and scene, each linked to source messages. A separate Node process reads the same SQLite database. |
| Recall outside recent context | Seven intervening turns remove the original source from the six-message recent window. Persisted memory, summary, plan and source references remain in context; the explicitly fake adapter uses the saved fact in its reply. This proves software wiring, not model recall quality. |
| Fictional versus real time | The fresh process simulates seven real days passing; new message timestamps advance while the saved fictional evening and pending promise remain unchanged. |
| Independent writing controls | Tone, detail and length survive the separate-process read alongside unchanged memory, scene and relationship state. No model selection is attached to these store controls. Provider tests cover request context transport. |
| Correction and deletion | Correcting the home address and removing a ribbon fact must prune old copies from derived state and summary; later scripted extraction attempts cannot resurrect those facts. Corrections and pins remain authoritative. |
| Plans, events and conflicts | An accepted promise remains pending until an explicit scripted delivery event. Conflicting home facts stay visible until owner reconciliation, then one corrected fact remains. |
| Story isolation | A second story reusing the same character and persona has no memory, summary, relationship or plan from the first. It cannot apply output citing the first story's source IDs. |
| Atomic failure and recovery | An output containing a valid first mutation and invalid final source commits neither. A separate-process startup marks the pending generation interrupted; late completion cannot apply stale state. |
| Unauthorized access | Unauthenticated requests using a known story UUID cannot read/delete it, change controls, or start a turn. No provider call occurs. Existing HTTP tests also verify logout, wrong passwords, cross-origin writes and Host rebinding protection. |

## Findings

Independent QA found a correction bug: the list of original memory objects retained mutable references. Changing the selected memory text before pruning derived state caused the prior address to remain in relationships, thoughts, open threads, scene and summary. The memory engineer fixed this by copying original records before mutation. Both the independent correction/deletion scenario and a dedicated all-categories regression now pass.

Final startup review also found that the listener's asynchronous error was not connected to its startup promise. An occupied port could terminate the process before cleanup, leaving a stale database lock. The coordinator connected the server error to promise rejection and added a real occupied-port child-process regression. The test verifies safe failure, removal of the database lock, and readable SQLite data afterward.

Suppression enforces stable keys and normalized text matching; it is not a semantic paraphrase detector. A model could express a removed fact using a different key and substantially different wording. Source validation proves that cited IDs belong to the permitted context; it does not prove their content supports a generated claim. Those quality limits require bounded live-model evaluations and further design if observed in practice.

## Acceptance limits

The automated checks can establish persistence, deterministic context plumbing, transaction safety, and failure handling. They cannot establish believable live relationships, reliable semantic extraction, or Android usability. No real Android device, Android installation, keyboard/background behavior, Cloudflare route, Docker deployment, or live full-memory output has been tested by this reviewer. The coordinator subsequently supplied bounded full-memory live evidence below; it remains separate from this independent offline review.

Do not mark Android or live continuity acceptance complete from deterministic test results. Keep real account authorization, credential handoff, deployment tests, and device checks explicitly separate from the fake demonstration.

## Final run

**27 tests passed, 0 failures, 0 skipped**, using `node app/test.mjs` with bundled Node 24.22.1 after the correction and startup cleanup fixes. The tests include five independent QA acceptance scenarios in `app/tests/continuity.test.mjs`, ten store tests, seven provider tests, and five HTTP/startup tests. No actual provider vault was opened and no live request was made by this reviewer. Node reports `node:sqlite` as experimental; the implementation is tied to the documented Node 24 runtime at this stage.

## Coordinator-supplied live evaluation — 2026-10-30

The coordinator reports five authorized subscription requests in total: an initial one-request run failed its assertion because an authored fictional thought was absent; the provider prompt was clarified, then a complete four-request run passed. This reviewer inspected the bounded evaluation script but did not repeat the live calls or inspect its private database or credentials.

The passing run checked initial facts, an accepted promise, an event, relationship content, authored thought and scene; recall after seven deterministic filler turns and SQLite close/reopen with the source outside the recent six messages; use of a corrected/pinned preference with deleted home detail absent from active state and summary; and an explicit next-morning delivery becoming a completed promise and event. Seven filler turns did not incur additional inference calls. The script validates source IDs through the store, checks expected text patterns, and rejects reintroduced suppressed details in active state. Its fictional-time checks use `dusk` and `morning` patterns, not exact natural-language equivalence.

The first failure and subsequent passing sample show why deterministic tests are separate from live narrative quality. This sample supports the tested scenario and prompt; it does not prove reliable extraction, deletion semantics under every paraphrase, or believable relationships across arbitrary stories. The optional script requires `STORYCHAT_LIVE_EVAL=yes`, permits at most four requests per invocation, stops on the first failure, and is excluded from ordinary test discovery. It adds no paid fallback or recurring workload.

Actual Android acceptance remains pending a reachable owner-approved route. Desktop preview, narrow viewport inspection, and automated HTTP tests must not be recorded as real Android operation. Docker, Cloudflare ingress, secure host handoff, browser keyboard/background behavior, and installed PWA acceptance require separate evidence.

The owner explicitly deferred the device check on 2026-10-30 and requested milestone 2 remain pending. After the usage-limit interruption, the coordinator reran both suites: application 27/27 and provider spike 48/48, no failures or skipped checks. No additional live inference was needed.

A final real server startup with the fake provider passed health, owner login/logout and static-asset checks. The existing synthetic story restored its corrected pinned memory and saved writing controls after restart. This smoke check made no model requests and does not replace the pending Android check.

## Owner-reported acceptance — 2026-10-30

The owner reports the deployed app working on PC and Android Firefox, connected ChatGPT replies and successful completion of the requested continuity, memory editing, writing controls, reopen/restart persistence, story isolation, phone usability and logout checks. Milestone 2 is complete on that basis. These checks were reported by the owner; agents did not observe the device. Milestone 3 device/installation groups were subsequently reported passed; only remaining manual recovery checks were deferred.
