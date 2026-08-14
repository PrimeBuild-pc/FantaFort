// CC BY-SA requires the author, a licence link and an indication of changes, given
// "in any reasonable manner based on the medium". A credits page linked from every
// footer is the form the licence itself allows (4.0 §3(a)(2)) and is the only one
// that also covers the small in-app cards; the public profile credits inline too.
//
// ponytail: author and licenceUrl stay null until each Liquipedia file page is read.
// Guessing them would be worse than the site-level credit the page falls back to.
export const PHOTO_SOURCE = {
  name: 'Liquipedia Fortnite',
  url: 'https://liquipedia.net/fortnite/',
  licence: 'CC BY-SA 3.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  snapshot: 'July 2026',
} as const;

export type PhotoCredit = { author:string|null; sourceUrl:string|null };

export const PHOTO_CREDITS: Record<string, PhotoCredit> = {
  peterbot: { author:null, sourceUrl:null },
  pollo: { author:null, sourceUrl:null },
  cold: { author:null, sourceUrl:null },
  thomas: { author:null, sourceUrl:null },
  veno: { author:null, sourceUrl:null },
  mongraal: { author:null, sourceUrl:null },
  clix: { author:null, sourceUrl:null },
  bugha: { author:null, sourceUrl:null },
};

/** Attribution line for one photo. Falls back to the site-level source credit. */
export function photoCredit(playerId:string) {
  const credit = PHOTO_CREDITS[playerId];
  return {
    author: credit?.author || null,
    sourceUrl: credit?.sourceUrl || PHOTO_SOURCE.url,
    text: credit?.author
      ? `Photo: ${credit.author} via ${PHOTO_SOURCE.name} · ${PHOTO_SOURCE.licence}`
      : `Photo: ${PHOTO_SOURCE.name} · ${PHOTO_SOURCE.licence}`,
  };
}

/** Images are resized and converted to WebP: CC BY-SA asks that this is stated. */
export const PHOTO_MODIFICATIONS = 'Images were cropped, resized and converted to WebP for delivery. No other changes were made.';
