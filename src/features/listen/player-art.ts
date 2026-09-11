import { bannerArtwork } from "@/features/course-pack/banners";

/**
 * The player's own artwork.
 *
 * Two project illustrations, drawn for this player and delivered by the user:
 * a wide cover for the card on screen and a square mark for the lock screen and
 * the notification shade. Neither is per-track, so the earlier reasoning that
 * kept the card's language mark as the only mark — "an image per track would be
 * bytes the offline bundle carries and a licence nobody has checked" — does not
 * apply to them: there are two files for the whole feature, the licence is the
 * project's own, and the bytes are precached once.
 *
 * Both are **decorative**. The card's heading, its language mark and its
 * transport all already say what is playing and what state it is in, so every
 * consumer renders them with empty alt text and hides them from assistive
 * technology (`alt=""`), and no information lives in the pictures.
 */

/** The wide cover on the player card. Delivered at 1280x714, shipped at 800x449. */
export const PLAYER_COVER = {
  url: "/brand/player-card.jpg",
  width: 800,
  height: 449,
} as const;

/** The square mark for lock screens. Delivered and shipped at 1024x1024. */
export const PLAYER_SQUARE = {
  url: "/brand/player-lock.jpg",
  width: 1024,
  height: 1024,
} as const;

/**
 * Every file this feature needs at runtime, in one place.
 *
 * The service worker precaches these (the player is the whole point of the
 * offline edition) and the portable builder embeds them (a single file that
 * resolves media at runtime has to carry what it renders). Both read this list
 * rather than naming the files again — a hand-kept second list is how the German
 * banner went missing from the portable build once already.
 */
export const PLAYER_ART_URLS = [PLAYER_COVER.url, PLAYER_SQUARE.url] as const;

/**
 * The lock-screen artwork for a track.
 *
 * Both URLs arrive **already resolved** by the edition that owns the player: a
 * plain path hosted and downloaded, an embedded blob in the portable single
 * file. Resolving here instead would hand the portable edition a path it cannot
 * fetch, which is the failure `tests/ListenCover.test.tsx` exists to catch.
 *
 * The square goes first because the slot is small and square and this image is
 * drawn for exactly that. The course banner follows it, so a wider surface can
 * still show which course is playing — and a platform that takes only the first
 * entry takes the picture that fits.
 */
export const playerArtwork = (squareUrl: string, courseBannerUrl?: string) => [
  {
    src: squareUrl,
    sizes: `${PLAYER_SQUARE.width}x${PLAYER_SQUARE.height}`,
    type: "image/jpeg",
  },
  ...(courseBannerUrl ? bannerArtwork(courseBannerUrl) : []),
];
