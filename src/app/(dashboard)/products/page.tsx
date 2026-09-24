import type { Metadata } from 'next';
import { ProductsScreen } from '@/features/commerce';

export const metadata: Metadata = {
  title: 'Products | Sculptors',
};

export default function ProductsPage() {
  return <ProductsScreen />;
}
