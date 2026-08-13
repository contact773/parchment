# Installing and updating Parchment

## Installing

1. Open [the releases page](https://github.com/contact773/parchment/releases/latest).
2. Download `Parchment_<version>_x64-setup.exe`.
3. Run it. Parchment installs for your user account only, so it does not ask for
   an administrator password.

Windows may show a SmartScreen warning the first time, because the installer is
new and not yet widely downloaded. *More info → Run anyway*.

Parchment needs the Microsoft Edge WebView2 runtime. It is already present on
current Windows 10 and 11; the installer fetches it if it is missing.

## Where your work is stored

Your projects live in a local database belonging to the application, under

```
%LOCALAPPDATA%\com.grinmedia.parchment\
```

They are **not** stored in the folder Parchment is installed into. Installing an
update, reinstalling, or uninstalling the application does not touch them.

That also means they are not backed up anywhere by default. Use
**Settings → Data & Backup → Export all** regularly and keep the file somewhere
you actually back up.

## Updating

Parchment checks for updates a few seconds after it starts, and at most once
every six hours. When a new version is available a small card appears in the
corner — you can read about the update, dismiss it, or skip that version
entirely. Nothing is downloaded or installed until you say so.

You can also check whenever you like:

- **Settings → Updates → Check now**, or
- **Help → Check for Updates…** in the menu bar.

When you choose to install, Parchment saves your open document and map first,
then installs and restarts. If anything cannot be saved, the update is cancelled
and nothing changes.

Every update must be signed by Parchment's publisher. An artifact that fails its
signature check is rejected and never installed.

### Turning automatic checks off

**Settings → Updates → Check for updates on launch.** You can still check by
hand at any time.

## Update channels

| Channel | What it is |
|---|---|
| **Stable** | Normal releases. This is what the installer above gives you. |
| **Preview** | Unfinished builds from the development branch, for testing. Clearly marked as prereleases. |

Which channel a copy follows is decided by the build you installed. To try
previews, install a preview build from the releases page. To go back to stable,
install the next stable release — it takes precedence over any preview and
installs over the top.

Back up your projects before installing a preview.

## If an update fails

Your installed copy is never modified until an update has downloaded and
verified, so a failed update always leaves Parchment working exactly as it was.

| What you see | What to do |
|---|---|
| "Could not reach the update server" | You are offline, or a firewall is blocking github.com. Try again later. |
| "The update server took too long to answer" | Transient. Try again in a moment. |
| "This update failed its signature check" | Do not install anything downloaded elsewhere. Report it — the artifact does not match Parchment's publisher key. |
| "This build has no update channel configured" | Reinstall from the releases page. |
| Nothing happens at all | Settings → Updates → **Copy diagnostic details**, and include that text in your report. It contains no part of your writing. |

You can always install the latest version by hand from the releases page. Your
projects stay where they are.

## Uninstalling

Windows Settings → Apps → Parchment → Uninstall.

This removes the application. It does **not** remove your projects — that is
deliberate, so that reinstalling brings your work back. To remove them too,
delete `%LOCALAPPDATA%\com.grinmedia.parchment\` after exporting a backup you
want to keep.
