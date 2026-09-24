import type { Metadata } from 'next';
import { CustomersScreen } from '@/features/commerce';

export const metadata: Metadata = {
  title: 'Customers | Sculptors',
};

export default function CustomersPage() {
  return <CustomersScreen />;
}
