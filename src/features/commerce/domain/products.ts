/**
 * The store's products as the Products page shows them (owner's direction,
 * 23 Sep 2026): each with its picture, its price and stock, and what it has
 * done -- units sold and times viewed -- with a search and the filters the
 * data itself suggests (category, stock) and a sort.
 */

export const PRODUCT_CATEGORIES = ['home', 'apparel', 'accessories', 'tech', 'beauty', 'outdoors'] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  home: 'Home',
  apparel: 'Apparel',
  accessories: 'Accessories',
  tech: 'Tech',
  beauty: 'Beauty',
  outdoors: 'Outdoors',
};

/** What the picture shows; the page draws each as a quiet line drawing. */
export const PRODUCT_SHAPES = [
  'mug',
  'lamp',
  'candle',
  'plant',
  'tee',
  'shirt',
  'sneaker',
  'bag',
  'backpack',
  'glasses',
  'watch',
  'headphones',
  'speaker',
  'camera',
  'dropper',
  'bottle',
  'tent',
  'bike',
  'book',
] as const;

export type ProductShape = (typeof PRODUCT_SHAPES)[number];

export type StockLevel = 'in-stock' | 'low' | 'out';

export const STOCK_LABELS: Record<StockLevel, string> = { 'in-stock': 'In stock', low: 'Low stock', out: 'Out of stock' };

/** At or under this many left, stock is low. */
export const LOW_STOCK = 12;

export function stockLevel(stock: number): StockLevel {
  if (stock <= 0) return 'out';

  return stock <= LOW_STOCK ? 'low' : 'in-stock';
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  shape: ProductShape;
  /** In the store's currency, cents included. */
  price: number;
  stock: number;
  /** The last 30 days. */
  sold: number;
  views: number;
}

export const PRODUCT_SORTS = ['best-selling', 'most-viewed', 'price-low', 'price-high', 'conversion'] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  'best-selling': 'Best selling',
  'most-viewed': 'Most viewed',
  'price-low': 'Price: low to high',
  'price-high': 'Price: high to low',
  conversion: 'Best conversion',
};

export interface ProductFilters {
  query: string;
  category: ProductCategory | 'all';
  stock: StockLevel | 'all';
  sort: ProductSort;
}

export const DEFAULT_PRODUCT_FILTERS: ProductFilters = { query: '', category: 'all', stock: 'all', sort: 'best-selling' };

/** Views that became a sale. */
export function conversionOf(product: Pick<Product, 'sold' | 'views'>): number {
  return product.views === 0 ? 0 : product.sold / product.views;
}

export function filterProducts(products: readonly Product[], filters: ProductFilters): Product[] {
  const query = filters.query.trim().toLowerCase();
  const kept = products.filter(
    (product) =>
      (query.length === 0 || product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query)) &&
      (filters.category === 'all' || product.category === filters.category) &&
      (filters.stock === 'all' || stockLevel(product.stock) === filters.stock)
  );
  const by: Record<ProductSort, (a: Product, b: Product) => number> = {
    'best-selling': (a, b) => b.sold - a.sold,
    'most-viewed': (a, b) => b.views - a.views,
    'price-low': (a, b) => a.price - b.price,
    'price-high': (a, b) => b.price - a.price,
    conversion: (a, b) => conversionOf(b) - conversionOf(a),
  };

  return kept.sort((a, b) => by[filters.sort](a, b) || a.name.localeCompare(b.name));
}
