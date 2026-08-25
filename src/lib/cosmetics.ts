// Locker catalogue. Prices, availability and ownership come from the database
// (`cosmetics` / `user_cosmetics`); this file only holds how an item is drawn.
//
// Item names are proper nouns and stay identical in every language, so the catalogue
// needs no dictionary: only the page copy around it is translated.

export type CosmeticKind = 'name_style' | 'avatar';

export interface Cosmetic {
  id: number;
  slug: string;
  kind: CosmeticKind;
  price: number;
  sortOrder: number;
}

export const COSMETIC_NAMES: Record<string, string> = {
  default: 'Standard',
  blaze: 'Blaze',
  tundra: 'Tundra',
  circuit: 'Circuit',
  shadow: 'Shadow',
  aurora: 'Aurora',
  royale: 'Royale',
  storm: 'Storm',
  victory: 'Victory',
  legendary: 'Legendary',
};

export const cosmeticName = (slug: string) => COSMETIC_NAMES[slug] || slug;

// Server rows arrive snake_case from PostgREST.
export const mapCosmetic = (row: { id:number; slug:string; kind:string; price:number; sort_order:number }): Cosmetic =>
  ({ id: row.id, slug: row.slug, kind: row.kind as CosmeticKind, price: row.price, sortOrder: row.sort_order });
