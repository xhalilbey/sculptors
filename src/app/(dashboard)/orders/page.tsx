import type { Metadata } from 'next';
import { OrdersScreen } from '@/features/commerce';

export const metadata: Metadata = {
  title: 'Orders | Sculptors',
};

export default function OrdersPage() {
  return <OrdersScreen />;
}
