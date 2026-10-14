import type { ReadProduct } from '@huishouden/pwa-kit/product-photo';
import { guessCategory } from './categorize';
import { ALL_CATEGORIES, CATEGORIES, type Category, type ListIcon, type ListItem, type Staple } from './model';
import { sameProduct } from '@huishouden/pwa-kit/product-photo-core';

/**
 * The aisle a product read from a photo starts in (Add by photo; the person can change it): the
 * household's own choice for that name (a staple), else the section the model chose, else the
 * barcode's Open Food Facts categories through the word list, else the word list on the name.
 */
export function photoCategory(product: ReadProduct, staples: readonly Staple[], listIcon?: ListIcon): Category {
  const staple = staples.find((s) => s.displayName.trim().toLowerCase() === product.name.trim().toLowerCase());
  if (staple) return staple.category;
  if (product.category && ALL_CATEGORIES.includes(product.category as Category) && product.category !== CATEGORIES.OTHER) return product.category as Category;
  for (const hint of product.hints ?? []) {
    const found = guessCategory(hint, listIcon);
    if (found !== CATEGORIES.OTHER) return found;
  }
  return guessCategory(product.name, listIcon);
}

/** Whether a product read from a photo is already to buy on the list (an open item with the same name, or one inside the other). */
export const alreadyListed = (name: string, items: readonly ListItem[], listId: string): boolean =>
  items.some((i) => i.listId === listId && !i.completed && sameProduct(i.name, name));
