# Character explorer and covers: upgrade acceptance

The update adds local character exploration, expanded authored fields, private uploaded covers and English/German UI. External catalogues and media generation remain deferred. Automated acceptance is synthetic; Android Firefox acceptance is pending the owner.

## Upgrade through Portainer

1. Record the currently running image digest (container details) and retain the current stack configuration. Take a stopped-instance backup using the existing recovery guide before upgrading. Preserve story-data, provider-data and provider-key; never remove volumes while recreating.
2. Update the stack Compose from this repository, retaining existing private environment values and volume identities. Add `media-data:/var/lib/storychat/media` and `STORYCHAT_MEDIA_DIR=/var/lib/storychat/media` if using a pasted older Compose file. Repository Compose already includes them.
3. Select the published commit image or `ghcr.io/thomasjakli/storychat:latest`, then update/recreate with image re-pull enabled. Do not recreate existing named volumes under different names. No new sign-in should be needed when provider/key volumes are retained.
4. Check container health and sign in. Verify an existing story and its memories before creating test content. New data is migrated additively; existing transcripts are not rewritten.

Use the offline backup CLI described in running.md for lossless backups, with the application stopped. The in-app export is portable: it includes covers but omits regeneration audit history. Keep both private. A convenient pre-upgrade fallback is a host/volume snapshot taken while the application is stopped, including story/provider/key volumes; protect the credential-bearing volumes separately from portable exports.

## Rollback

Stop the upgraded application. Select the saved old image digest and restore the stopped **pre-upgrade** story snapshot/backup to fresh storage using the old version's recovery procedure. Retain the existing provider/key volumes unless credential recovery itself is required. Keep the new story/media storage separately so new content is not lost. Do not run an older image against upgraded data or import a new media envelope into old software. Recreate using the retained old stack configuration and verify health and the old story. Rolling back only the image is insufficient.

## Owner Android Firefox checks

- Fresh browser profile defaults to English. Switch to Deutsch; reload and log out/in. Another profile stays independent. Story text remains unchanged.
- Create a character without starting a story; set intro, opening, gender/pronouns, tags/category. Upload a JPEG/PNG/WebP; adjust focal point and inspect cards/details at narrow width and large text.
- Search/filter/favorite/sort; open details and return. Verify browser back, scroll position, keyboard and long text remain usable.
- Start two stories with the same character. Intro appears once before opening. Creating/browsing does not request a model reply. Continue opens the selected story rather than creating another.
- Edit the library definition/cover: old stories retain snapshots. Duplicate/archive/unarchive/delete without losing retained stories or shared artwork. Draft characters cannot start stories.
- Switch languages with an unsent draft and during an active reply; preserve draft and request recovery after background/reconnect.
- Restart/recreate and confirm fields/covers persist. Export with media, restore into an isolated empty instance with fake inference and check covers/content. Do not test restore over production data.

Remaining limitation: cover framing is non-destructive focal-point selection, not a freeform image editor. JPEG/PNG/WebP only, 8 MiB upload limit, default 256 MiB media capacity (`STORYCHAT_MEDIA_MAX_BYTES` can override). Unreferenced uploads count toward capacity until explicitly removed through authenticated media deletion. No external generation or migration was enabled.
