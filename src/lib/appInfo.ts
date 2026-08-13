/**
 * Identity of the running build: what version it is, which release channel it
 * follows, and where its releases live.
 *
 * The version comes from package.json at build time (see vite.config.ts), which
 * is the same value `scripts/version.mjs` writes into tauri.conf.json and
 * Cargo.toml — so the About panel, the installer and the updater's notion of
 * "current version" cannot drift apart.
 */
import { channelForVersion, type ReleaseChannel } from '@/features/updates/updateModel'

export const APP_VERSION: string = __APP_VERSION__

/**
 * A prerelease version (`0.2.0-preview.3`) means this copy was installed from
 * the preview channel and will keep following it. The channel is baked into the
 * artifact because the Tauri updater reads its endpoint from the compiled
 * config — see docs/adr/0001-release-channels-and-updates.md.
 */
export const RELEASE_CHANNEL: ReleaseChannel = channelForVersion(APP_VERSION)

export const REPOSITORY_URL = 'https://github.com/contact773/parchment'
export const RELEASES_URL = `${REPOSITORY_URL}/releases`

/** Human label for the channel, used in Settings and About. */
export const CHANNEL_LABEL: Record<ReleaseChannel, string> = {
  stable: 'Stable',
  preview: 'Preview',
}
