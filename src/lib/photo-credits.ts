// CC BY-SA requires the author, a licence link and an indication of changes, given
// "in any reasonable manner based on the medium". A credits page linked from every
// footer is the form the licence itself allows (4.0 §3(a)(2)) and is the only one
// that also covers the small in-app cards; the public profile credits inline too.
//
// A photograph is published here only when its licence permits redistribution by a
// third party. Liquipedia hosting a file proves nothing: several player images are
// "all rights reserved, permission granted to Liquipedia", which is a licence to
// Liquipedia and not to us. Those are removed rather than credited.
export const PHOTO_SOURCE = {
  name: 'Liquipedia Fortnite',
  url: 'https://liquipedia.net/fortnite/',
  licence: 'CC BY-SA 3.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  snapshot: 'July 2026',
} as const;

export type PhotoCredit = { author:string|null };

export const PHOTO_CREDITS: Record<string, PhotoCredit> = {
  peterbot: { author:'Michal Konkol' },
  pollo: { author:'Michal Konkol' },
  cold: { author:'Michal Konkol' },
  veno: { author:'Michal Konkol' },
  clix: { author:'Michal Konkol' },
  // ponytail: author unread — the credits page falls back to the source-level line.
  thomas: { author:null },
};

/** Attribution line for one photo. Falls back to the site-level source credit. */
export function photoCredit(playerId:string) {
  const credit = PHOTO_CREDITS[playerId];
  return {
    author: credit?.author || null,
    sourceUrl: PHOTO_SOURCE.url,
    text: credit?.author
      ? `Photo: ${credit.author} via ${PHOTO_SOURCE.name} · ${PHOTO_SOURCE.licence}`
      : `Photo: ${PHOTO_SOURCE.name} · ${PHOTO_SOURCE.licence}`,
  };
}

/** Images are resized and converted to WebP: CC BY-SA asks that this is stated. */
export const PHOTO_MODIFICATIONS = 'Images were cropped, resized and converted to WebP for delivery. No other changes were made.';

/**
 * Removed after checking their file pages: neither is redistributable by us.
 * Kept here so the decision is visible instead of looking like an oversight.
 */
export const PHOTO_REMOVALS = [
  { player:'Bugha', reason:'Copyright Sentinels, all rights reserved. Liquipedia holds permission for its own educational and reference use; that permission does not extend to third parties.' },
  { player:'Mongraal', reason:'Sourced from the Red Bull Content Pool, which licenses editorial use under its own terms to registered users. Not a CC BY-SA file and not covered by any licence FantaFort holds.' },
];
