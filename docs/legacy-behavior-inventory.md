# Legacy behavior inventory

Source reviewed: `C:\Users\benve\OneDrive\Documents\Dev\turbo-bard`, branch `redesign-may-2024` at commit `4a3d291`.

This is the starting contract for characterization tests. It records behavior to preserve before making deliberate improvements.

## Data and external services

- User environments are stored in browser `localStorage` under the `groups` key.
- Loading stored environments stops every sound and disables eager loading to prevent autoplay and memory spikes.
- Older stored data is upgraded in place when `combatTracks`, `icon`, or `iconColour` is missing.
- The sound catalog is provided by Firebase cloud functions backed by Firestore collections for packs, tracks, and a search index.
- Sound files are loaded from Google Cloud Storage, preferring WebM when the browser reports support and otherwise using MP3.
- Environment icons are searched through an external API.

The rebuild will model sound-catalog and icon-catalog access as replaceable external dependencies. Firebase and the icon API are intentionally not ported into this repository in the first parity release.

## Environment and editing

- Users can create, rename, delete, expand, and collapse environments.
- Users can choose an icon and icon color for an environment.
- Users can add an individual sound or an entire pack from search results.
- Search can filter Everything, Music, or Ambiance.
- Sounds can be placed in the ordinary section or the Combat section.
- Users can remove sounds, adjust per-sound volume, and adjust environment volume.
- One-shots expose timing controls and a manual Play now action.
- Source information is available for sounds.

## Playback

- Playing an environment stops every other environment.
- A normal environment starts its ordinary sounds.
- Combat mode stops ordinary music, starts Combat music, keeps ordinary ambiance active, and adds Combat ambiance.
- Turning Combat mode off restores the ordinary playback selection.
- Loop players repeat continuously and fade over two seconds when removed or stopped through lifecycle cleanup.
- Loop loading is deferred until a sound is needed or actively playing.
- One-shots select a random loaded variation and restart it from the beginning when fired.
- Automatic one-shot playback starts a timer when the sound is active, chooses an inclusive randomized interval between configured minimum and maximum seconds, then restarts the timer after firing.
- Manual one-shot playback uses separate audio instances and remains audible even when the environment is stopped.
- Audio instances are faded and unloaded when their sound source is removed.
- An iOS-specific unmute/background-playback workaround is used by the legacy Howler adapter.

## Known characterization gaps

The legacy branch has only a minimal scaffold test and no meaningful automated coverage for these behaviors. The rebuild should add characterization tests before replacing the corresponding implementation. Browser tests must cover audio-policy constraints that cannot be proven with fake audio ports.
