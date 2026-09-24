'use client';

import { useMemo, useState } from 'react';
import { darkCard, lightCard } from '@/components/ui/surfaces';
import { useDashboardTheme, type DashboardTheme } from '@/hooks/use-dashboard-theme';
import { useRemote } from '@/hooks/use-remote';
import { cn } from '@/lib/utils';
import { fetchProducts } from '../api/client';
import {
  CATEGORY_LABELS,
  conversionOf,
  DEFAULT_PRODUCT_FILTERS,
  filterProducts,
  PRODUCT_CATEGORIES,
  PRODUCT_SORT_LABELS,
  PRODUCT_SORTS,
  STOCK_LABELS,
  stockLevel,
  type Product,
  type ProductCategory,
  type ProductFilters,
  type StockLevel,
} from '../domain/products';
import { ProductArt } from './product-art';
import { FilterChips, LoadError, NoMatches, PickMenu, ResultCount, SearchField } from './toolbar';

/**
 * Products: every product as a quiet card -- its picture, its price and
 * stock, and what it did over the last 30 days: units sold and times viewed
 * (owner's direction, 23 Sep 2026). A search, and the filters the data
 * suggests: category and stock, with a sort.
 */

const counts = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('en-US');
const percent = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

const STOCK_OPTIONS: ReadonlyArray<{ value: StockLevel | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'in-stock', label: STOCK_LABELS['in-stock'] },
  { value: 'low', label: STOCK_LABELS.low },
  { value: 'out', label: STOCK_LABELS.out },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-[var(--card-text-faint)]">{label}</p>
      <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-[var(--card-text)]">{value}</p>
    </div>
  );
}

function ProductCard({ product, currency, tone }: { product: Product; currency: string; tone: DashboardTheme }) {
  const level = stockLevel(product.stock);
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency });

  return (
    <article className={cn(tone === 'dark' ? darkCard : lightCard, 'flex flex-col p-2.5')}>
      <ProductArt shape={product.shape} tone={tone} />
      <div className="flex flex-1 flex-col px-2 pb-1.5 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-[var(--card-text)]">{product.name}</h3>
            <p className="mt-0.5 truncate text-[12px] text-[var(--card-text-faint)]">
              {CATEGORY_LABELS[product.category]} · {product.sku}
            </p>
          </div>
          <p className="shrink-0 text-[15px] font-semibold tabular-nums text-[var(--card-text)]">{money.format(product.price)}</p>
        </div>

        <p
          className={cn(
            'mt-2 inline-flex items-center gap-1.5 text-[12px]',
            level === 'out' ? 'text-[var(--dashboard-danger)]' : 'text-[var(--card-text-muted)]'
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', level === 'in-stock' ? 'bg-[var(--card-text-faint)]' : 'bg-current')} aria-hidden="true" />
          {level === 'out' ? STOCK_LABELS.out : level === 'low' ? `Low stock · ${product.stock} left` : `${whole.format(product.stock)} in stock`}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--card-line)] pt-3">
          <Stat label="Sold · 30 days" value={whole.format(product.sold)} />
          <Stat label="Viewed · 30 days" value={counts.format(product.views)} />
        </div>
        <p className="mt-2 text-[12px] text-[var(--card-text-faint)]">{percent.format(conversionOf(product))} of views became a sale</p>
      </div>
    </article>
  );
}

export function ProductsScreen() {
  const theme = useDashboardTheme();
  const { data, error, retry } = useRemote(fetchProducts);
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_PRODUCT_FILTERS);
  const products = useMemo(() => data?.products ?? [], [data]);
  const shown = useMemo(() => filterProducts(products, filters), [products, filters]);
  const categoryOptions = useMemo(
    () => [
      { value: 'all' as const, label: 'All', count: products.length },
      ...PRODUCT_CATEGORIES.map((category: ProductCategory) => ({
        value: category,
        label: CATEGORY_LABELS[category],
        count: products.filter((product) => product.category === category).length,
      })),
    ],
    [products]
  );

  return (
    <section className="min-h-full px-6 pb-14 pt-8 text-[var(--dashboard-text)] lg:px-10">
      <h1 className="text-[32px] font-bold leading-10 tracking-[-0.025em]">Products</h1>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <SearchField value={filters.query} onChange={(query) => setFilters({ ...filters, query })} placeholder="Search products or SKU" />
        <PickMenu label="Stock" options={STOCK_OPTIONS} value={filters.stock} onChange={(stock) => setFilters({ ...filters, stock })} />
        <PickMenu
          label="Sort"
          options={PRODUCT_SORTS.map((sort) => ({ value: sort, label: PRODUCT_SORT_LABELS[sort] }))}
          value={filters.sort}
          onChange={(sort) => setFilters({ ...filters, sort })}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <FilterChips label="Category" options={categoryOptions} value={filters.category} onChange={(category) => setFilters({ ...filters, category })} />
        {data ? <ResultCount shown={shown.length} total={products.length} noun={['product', 'products']} /> : null}
      </div>

      {error && !data ? <LoadError message={error} onRetry={retry} /> : null}

      {data ? (
        shown.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {shown.map((product) => (
              <ProductCard key={product.id} product={product} currency={data.currency} tone={theme} />
            ))}
          </div>
        ) : (
          <NoMatches noun="products" onClear={() => setFilters(DEFAULT_PRODUCT_FILTERS)} />
        )
      ) : !error ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className={cn(theme === 'dark' ? darkCard : lightCard, 'h-[380px] animate-pulse')} />
          ))}
          <span className="sr-only">Loading products</span>
        </div>
      ) : null}
    </section>
  );
}
