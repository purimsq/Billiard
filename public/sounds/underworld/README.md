# Underworld Dialogue Sound Effects

This folder contains the audio assets for the **Underworld Dialogue & Tombstone Cutscene** setting (`underworldDialogue: true`) triggered during live gameplay when scores cross the **-50 threshold**.

---

## Sound Effects Directory Structure

| Filename | Type / Event | Description & Tone | Trigger Point |
| :--- | :--- | :--- | :--- |
| `first_death.wav` | `first_death` | Low ominous bell toll (110Hz A2) decaying with haunting harmonics | Triggered when the first player drops to or below **-50 points** for the first time. |
| `companion_death.wav` | `companion_death` | Eerie tritone dissonance & underworld gates chime | Triggered when a second/third player falls past **-50** while another player is already in the underworld. |
| `resurrection.wav` | `resurrection` | Bright celestial ascending major arpeggio (C5-E5-G5-C6) with crystal shimmer | Triggered when a player in the underworld claws back up to **>-50 points** (e.g. -45). |
| `re_death.wav` | `re_death` | Subterranean pitch drop, noise burst, and heavy stone impact | Triggered when a previously resurrected player falls back down below **-50 points**. |
| `tombstone_slam.wav` | Impact / Slam | Heavy stone slab crash with low-frequency impact | Triggered on the tombstone cutscene drop or card fracture effect. |
| `glass-ball-broken.mp3` | Card Fracture | Realistic shattered glass impact and fracture shards | Triggered immediately when returning from death modal as the player's card shudders and cracks appear. |
| `card_repair.wav` | Card Restoration | Soft acoustic dreaming harp arpeggio (Dbmaj9) with delicate finger plucks and serene lingering warmth | Triggered when returning from resurrection modal as radiant light envelops the card and cracks dissolve. |
| `typewriter_click.wav` | Typewriter Key | Crisp, subtle 45ms mechanical typewriter tap | Triggered in cadence as the dialogue quote types across the screen. |

---

## Audio Format & Specifications

- **Format:** 16-bit PCM Linear WAV (`.wav`) or standard MP3 (`.mp3`)
- **Sample Rate:** 44,100 Hz (CD Quality)
- **Channels:** Mono or Stereo
- **Web Safe:** Served statically from Next.js `/public/sounds/underworld/` at `/sounds/underworld/<filename>`.

---

## Replacing with Custom Sound Files

You can replace any of the `.wav` files with your own custom audio tracks (or `.mp3` equivalents) by keeping the exact same filenames:

1. Copy your audio files into `public/sounds/underworld/`.
2. Ensure the filename matches (e.g. `first_death.wav`, `resurrection.wav`, etc.).
3. Recommended length: 1.5s to 3.0s for scene stingers, and ~40ms for the typewriter click.
