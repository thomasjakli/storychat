# Next update: character exploration and expanded character model

Status: planning only, 2026-10-30. Coordinate with [cover uploads](media-plan.md), [character fields/private migration](character-migration-plan.md) and [English/German interface](interface-language-plan.md). No application implementation, catalogue import, new network integration or production change is authorized by this plan alone. Message-based media generation remains shelved.

## Product direction

Provide a separate **Characters / Charaktere** exploration page and **Stories / Geschichten** notebook. Characters are reusable definitions; stories are independent ongoing conversations with snapshots and memories. Opening a character does not silently resume or create a story. Start new story and Continue existing story are distinct actions.

The initial explorer browses the owner's locally created or explicitly imported characters. It is not a public marketplace, social feed or automatic mirror of a third-party service. An offline import-preview browser for an owner-supplied catalogue may follow, but importing its characters or fetching artwork requires explicit selection. Do not display the private research catalogue as bundled product content or make ordinary browsing depend on undocumented remote endpoints.

## Current model gaps

Code inspection: Store definitions currently contain id, name, definition, opening, version, createdAt and optional updatedAt/archived. Name is limited to 100 characters, definition to 8,000 and opening to 4,000. The library endpoint returns full character/persona definitions and story summaries together, without pagination. The current character editor is a management dialog inside the story notebook rather than a dedicated exploration surface.

| Data/function | Current state | Proposed expansion |
| --- | --- | --- |
| Name and subtitle | One name field | Independent name and optional subtitle; never automatically split names at punctuation during import |
| Intro and opening | Opening only | Separate intro/premise and opening, preserving source paragraphs and safe emphasis; typed intro shown before opening in new chats |
| Behavioral definition | One required free-text field | Retain as the primary authored behavior field; explicitly distinguish a complete definition from an incomplete imported draft |
| Gender/pronouns | Absent | Optional explicit gender metadata and independently optional pronouns; no inference from image/name |
| Cover/artwork | Absent | Managed cover asset ID and focal point; optionally retain distinct portrait/background roles when uploaded rather than conflating all source URLs |
| Category/tags | Absent | Optional local category and bounded normalized tags for search/filtering; source labels retained separately where necessary |
| Favorites | Absent | Owner-only favorite flag, not a public popularity count |
| Attribution/origin | Absent | Optional source system, source record ID, original author credit, source locale and import timestamp; metadata remains private runtime content |
| Browse status | Archive exists | Active/archived and ready/draft distinction; archive remains recoverable; draft can be browsed/edited but needs validation before starting a story |
| Usage metadata | Derived from stories only | Local last-used/story count derived from owner activity; never reuse remote likes/chats as local measurements |
| Query/pagination | One full-library payload | Dedicated small character-card summaries and stable server-side pagination/filter/search; full content requested for details only |

The inspected catalogue contains presentation, taxonomy, artwork references and source/social metadata. It does not establish access to a complete hidden personality prompt: empty source configuration is not a definition. Do not synthesize an unknown behavioral definition from an intro without an explicit owner-reviewed authoring step. Public sample data remains synthetic.

## Proposed data boundaries

1. **Versioned character content:** name, subtitle, definition, intro, opening, gender/pronouns and managed cover references. Story creation snapshots these fields. Existing story snapshots and retained intro/opening messages do not change when the library is edited.
2. **Owner library preferences:** favorite, archive/draft state and last-used view. Favoriting or sorting should not create a new story-content version or alter context. Resolve migration from the current archived-in-definition representation explicitly.
3. **Origin/attribution metadata:** source identifier, source record ID, author credit, source language, import date and selected source artwork roles. External IDs are provenance, not internal primary keys or ownership. Strip URL query secrets; do not use third-party signed URLs as durable local asset identity.
4. **Asset registry:** authenticated local media, checksums and reference counting shared with the media plan. A duplicate may share an asset until edited; deleting one character cannot break old story snapshots or another reference.

Proposed bounds: subtitle 200, intro 4,000, opening 12,000, definition 8,000 characters; category 80, up to 20 tags of 60 characters, with normalized stable comparison and deduplication. These are implementation proposals requiring budget review, not copied service limits. Import exceeding a limit must produce a preview error rather than truncate. Unspecified source fields migrate to empty/default values. Per-device UI locale is independent of character source language and story language.

## Interface and navigation

- Persistent authenticated navigation between Characters and Stories, with Settings for language/install/import/export. Proposed default after login: Stories, preserving current return-to-conversation behavior. No automatic switch of the owner's home preference.
- Characters page: responsive portrait-card grid with cover/placeholder, name, optional subtitle or short intro, local category/tags and favorite control. Keep overlay contrast readable, reserve image dimensions to avoid layout shift and lazy-load authenticated thumbnails. Two columns where readable on Android; one column where width or text scaling requires it.
- Search by name, subtitle, intro and tags; omit private full behavioral text from visible card summaries. Accent/case handling must work for English/German and preserve source text.
- Filter by category/tags, favorites and archive status; optionally gender only where explicitly stored. Counts reflect the owner's current local catalogue, never third-party population statistics. Clear filters and meaningful empty/no-results states.
- Sort by recently added, name and recently used, with a deterministic ID tie-breaker. Remember query, filters, sorting and scroll position when returning from details; any saved UI preferences are local to the device and contain no imported story text.
- Character detail page: large cover, name/subtitle, tags and local favorite, then clearly labelled Intro, Opening scene and Character details. Attribution appears only when present. Owner editing actions are available without crowding the reading view.
- Detail actions: Start new story (choose persona/title), Continue story (choose among this owner's related stories), Edit, Duplicate, Archive/unarchive and Delete. Show source-version differences when a library edit is newer than an existing story snapshot; never merge story memories.
- Link new stories through an explicit local library character ID alongside the immutable snapshot. Legacy stories can use their retained snapshot's local ID where available; never fuzzy-match by character name or assume an external source ID is a local library ID. A deleted library record leaves its old stories readable.
- Dedicated creation/edit flow usable without first starting a story. Expand current forms with localized labels, counters, cover preview and separate intro/opening fields. Safe text/limited emphasis only; no arbitrary HTML authoring.
- Preserve browser back behavior, focus return, drafts, in-flight request recovery and direct authenticated links. Unsupported/missing/deleted records get useful navigation rather than a blank page. Author names, character titles and narratives are content and are not automatically translated when switching UI language.

## Proposed API shape and migrations

Retain existing authenticated create/update/duplicate/archive/delete operations where compatible. Introduce GET /api/characters with validated search/filter/sort/page parameters returning lightweight items, total and a stable next-page cursor or documented offset. Proposed card page size: 24, configurable only within a small server bound; no need to copy a reference service's page size. GET /api/characters/:id supplies full detail. GET /api/stories may supply notebook summaries; deprecate full /api/library gradually so existing UI/tests keep working during rollout.

Planning tradeoff: a small library could initially filter locally, but paginated summaries are the recommended contract because selective catalogue imports can grow the library substantially. This is an implementation proposal; no external catalogue is imported to justify or test it. Use synthetic large-library fixtures.

Keep imported external IDs out of application route ownership checks. Search/filter query size and result counts are bounded. All routes and media remain owner-authenticated with the existing Host/Origin rules. Return only local data; no implicit remote search, arbitrary URL fetch or external requests on card display.

Apply additive, versioned migrations and strict server validation. Update create/update/duplicate, public serializers, historical story snapshots, generation contexts/baselines, portable export/import and lossless backup validators together. Back up before migration. Import old data without retroactively adding intro messages or modifying transcripts. Define both old-to-new import behavior and rollback constraints before release; do not drop unknown content silently to make a backup pass.

Existing duplicate IDs remain a hard conflict in ordinary story backup import. Character-source import should instead preview existing source IDs and offer skip or a new library copy; an explicit update creates a new library content version and cannot update existing stories. No bulk replacement or automatic source refresh.

## Delivery order

1. **Schema and compatibility:** agree field defaults, schema version, draft validation, content/preferences separation and transfer changes. Test upgrades from the current database and old backup fixtures.
2. **Covers and bilingual character forms:** deliver the already planned upload/security/storage work, intro/opening/gender and English/German support together. No media-generation dependencies.
3. **Explorer and detail pages:** implement local cards, server queries, search/filter/sort, details and explicit start/continue flows; keep the story notebook separate.
4. **Private selected-character trial:** use the isolated owner-selected source record/artwork only in private runtime. Preview mapping, missing fields, source language and attribution; require a usable owner-approved definition before beginning chat. Confirm appearance and narrative opening on Android. Do not import the whole research catalogue automatically.
5. **Later migration tooling:** only if requested, add offline catalogue preview/selective import and separately plan existing conversation migration from a complete available transcript/export. Source catalogue records do not contain the owner's chats or memory state.

## Acceptance and agent responsibilities

- Existing stories, corrections/pins/suppression and provider connection remain unchanged through migration. New stories snapshot all new content fields; two stories sharing one character remain isolated.
- Card/detail/search/filter/pagination results are consistent and bounded, with no missing/duplicate entries for a stable local dataset. Archived/draft records follow documented start rules. Empty catalogue and thousands of synthetic records remain usable without loading full definitions/media at once.
- Favorites and sorting never change story state or model context; creation/edit/duplicate/archive/delete preserve version and media-reference rules.
- Missing behavioral definitions, oversized fields, malformed tags/markup and media failures produce actionable errors without partial import or loss. Imported content cannot change server instructions, paths or permissions.
- Source attribution and language survive import/export/restore; no remote social counts masquerade as local activity. Synthetic backup restoration recovers new fields and managed media references/checksums.
- Android Firefox: cards at narrow widths/large text, image cropping, long-detail reading, keyboard/search, back/scroll/focus restoration, intro styling, start/continue story and language switching. Device checks are separately owner-reported; desktop emulation does not complete them.
- Public documentation/tests/images contain no downloaded character text, creator data, artwork or private domain. Do not expose or bundle the ignored research catalogue.

Product/Architecture owns schema/API contracts and scope; Story/Memory owns snapshot/context and legacy migration; Android Experience owns navigation/cards/details and bilingual forms; Self-hosting/Security owns uploads/media/reference-aware backups; Model Integration verifies no unintended model calls or provider changes; Quality independently verifies migration, query behavior, isolation and device evidence. Agree distinct ownership before implementation.

Open product proposals: exact navigation labels/default, category/tag vocabulary, maximum field sizes and draft editing experience. The separate explorer, covers, intro/opening/gender and English/German interface are requested scope; remote social features, automatic crawling, message-media generation and whole-story migration are not implied.


Implementation update (2026-10-31): active local-character/cover/localization scope implemented with synthetic verification; see project.md for evidence and pending Android acceptance. Earlier proposals describe the design baseline, not proof of device acceptance. External retrieval, private character trial and generation remain deferred.
