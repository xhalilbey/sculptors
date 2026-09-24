import type { OrganizationId } from '@/types/ids';
import type { CommerceSource } from '../application/ports';
import { segmentOf, type Customer } from '../domain/customers';
import { ORDER_STAGES, type Order, type OrderStage } from '../domain/orders';
import type { Product, ProductCategory, ProductShape } from '../domain/products';

/**
 * Demo products, customers and orders for a store until its own arrive
 * through its syncs. Deterministic per organization -- the same store sees
 * the same catalog on every visit, another store a different one -- and the
 * orders move with the clock: one comes in about every twenty minutes and
 * each walks its five steps within about half a day, so the board is alive.
 */

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const CUSTOMER_COUNT = 48;
/** At or above this lifetime spend a returning customer is a VIP. */
const VIP_SPEND = 1500;
const SLOT_MINUTES = 20;
const ORDER_CHANCE = 0.85;
/** How far back the board looks for orders: a little over five days of slots. */
const SLOTS_BACK = 400;

const TEMPLATES: ReadonlyArray<{ name: string; category: ProductCategory; shape: ProductShape; price: number }> = [
  { name: 'Stoneware Mug', category: 'home', shape: 'mug', price: 24 },
  { name: 'Linen Table Lamp', category: 'home', shape: 'lamp', price: 89 },
  { name: 'Cedar Soy Candle', category: 'home', shape: 'candle', price: 32 },
  { name: 'Ceramic Planter', category: 'home', shape: 'plant', price: 38 },
  { name: 'Walnut Desk Lamp', category: 'home', shape: 'lamp', price: 129 },
  { name: 'Espresso Cup Set', category: 'home', shape: 'mug', price: 42 },
  { name: 'Heavyweight Tee', category: 'apparel', shape: 'tee', price: 35 },
  { name: 'Oxford Shirt', category: 'apparel', shape: 'shirt', price: 78 },
  { name: 'Merino Crew Tee', category: 'apparel', shape: 'tee', price: 64 },
  { name: 'Everyday Runner', category: 'apparel', shape: 'sneaker', price: 120 },
  { name: 'Canvas Low Top', category: 'apparel', shape: 'sneaker', price: 85 },
  { name: 'Linen Overshirt', category: 'apparel', shape: 'shirt', price: 96 },
  { name: 'Leather Tote', category: 'accessories', shape: 'bag', price: 145 },
  { name: 'Roll-top Backpack', category: 'accessories', shape: 'backpack', price: 118 },
  { name: 'Round Sunglasses', category: 'accessories', shape: 'glasses', price: 69 },
  { name: 'Field Watch', category: 'accessories', shape: 'watch', price: 189 },
  { name: 'Crossbody Bag', category: 'accessories', shape: 'bag', price: 72 },
  { name: 'Weekend Holdall', category: 'accessories', shape: 'bag', price: 165 },
  { name: 'Wireless Headphones', category: 'tech', shape: 'headphones', price: 199 },
  { name: 'Pocket Speaker', category: 'tech', shape: 'speaker', price: 79 },
  { name: 'Instant Camera', category: 'tech', shape: 'camera', price: 139 },
  { name: 'Studio Headphones', category: 'tech', shape: 'headphones', price: 249 },
  { name: 'Bookshelf Speaker', category: 'tech', shape: 'speaker', price: 229 },
  { name: 'Travel Camera', category: 'tech', shape: 'camera', price: 319 },
  { name: 'Vitamin C Serum', category: 'beauty', shape: 'dropper', price: 48 },
  { name: 'Hydrating Face Oil', category: 'beauty', shape: 'dropper', price: 36 },
  { name: 'Calming Night Serum', category: 'beauty', shape: 'dropper', price: 54 },
  { name: 'Fig Bath Candle', category: 'beauty', shape: 'candle', price: 28 },
  { name: 'Hand Cream Duo', category: 'beauty', shape: 'bottle', price: 22 },
  { name: 'Skin Rituals Book', category: 'beauty', shape: 'book', price: 26 },
  { name: 'Two-person Tent', category: 'outdoors', shape: 'tent', price: 329 },
  { name: 'Steel Water Bottle', category: 'outdoors', shape: 'bottle', price: 34 },
  { name: 'Trail Daypack', category: 'outdoors', shape: 'backpack', price: 98 },
  { name: 'Commuter Bike', category: 'outdoors', shape: 'bike', price: 890 },
  { name: 'Trail Guidebook', category: 'outdoors', shape: 'book', price: 24 },
  { name: 'Camp Lantern', category: 'outdoors', shape: 'lamp', price: 49 },
];

const CATEGORY_CODES: Record<ProductCategory, string> = {
  home: 'HOM',
  apparel: 'APP',
  accessories: 'ACC',
  tech: 'TEC',
  beauty: 'BEA',
  outdoors: 'OUT',
};

/** Where customers live, each place with names its people carry. */
const PLACES: ReadonlyArray<{ city: string; country: string; first: readonly string[]; last: readonly string[] }> = [
  { city: 'Istanbul', country: 'Türkiye', first: ['Elif', 'Mert', 'Ayşe', 'Can', 'Zeynep', 'Emre'], last: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Aydın'] },
  { city: 'Berlin', country: 'Germany', first: ['Lena', 'Jonas', 'Mia', 'Felix'], last: ['Müller', 'Schmidt', 'Weber', 'Fischer'] },
  { city: 'Amsterdam', country: 'Netherlands', first: ['Sanne', 'Daan', 'Emma', 'Luuk'], last: ['de Vries', 'Jansen', 'Bakker', 'Visser'] },
  { city: 'Paris', country: 'France', first: ['Chloé', 'Hugo', 'Léa', 'Louis'], last: ['Martin', 'Dubois', 'Moreau', 'Laurent'] },
  { city: 'London', country: 'United Kingdom', first: ['Olivia', 'Oliver', 'Amelia', 'Harry'], last: ['Smith', 'Taylor', 'Brown', 'Wilson'] },
  { city: 'Madrid', country: 'Spain', first: ['Lucía', 'Mateo', 'Sofía', 'Pablo'], last: ['García', 'López', 'Martín', 'Sánchez'] },
  { city: 'Milan', country: 'Italy', first: ['Giulia', 'Marco', 'Sara', 'Luca'], last: ['Rossi', 'Bianchi', 'Romano', 'Colombo'] },
  { city: 'Warsaw', country: 'Poland', first: ['Zofia', 'Jakub', 'Maja', 'Antoni'], last: ['Nowak', 'Wójcik', 'Kowalczyk', 'Mazur'] },
  { city: 'Stockholm', country: 'Sweden', first: ['Astrid', 'Erik', 'Elsa', 'Lars'], last: ['Andersson', 'Johansson', 'Karlsson', 'Nilsson'] },
  { city: 'Seoul', country: 'South Korea', first: ['Ji-woo', 'Min-jun', 'Seo-yeon', 'Do-yun'], last: ['Kim', 'Lee', 'Park', 'Choi'] },
  { city: 'Tokyo', country: 'Japan', first: ['Yuki', 'Haruto', 'Aoi', 'Ren'], last: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka'] },
  { city: 'Singapore', country: 'Singapore', first: ['Wei Ling', 'Jun Jie', 'Hui Min', 'Kai'], last: ['Tan', 'Lim', 'Lee', 'Ng'] },
  { city: 'Jakarta', country: 'Indonesia', first: ['Siti', 'Rizky', 'Putri', 'Budi'], last: ['Wijaya', 'Santoso', 'Hidayat', 'Pratama'] },
  { city: 'Bangkok', country: 'Thailand', first: ['Anong', 'Somchai', 'Malee', 'Niran'], last: ['Srisuk', 'Chaiyaporn', 'Wongsa', 'Boonmee'] },
];

const CARRIERS: ReadonlyArray<{ name: string; prefix: string }> = [
  { name: 'DHL Express', prefix: 'JD01' },
  { name: 'UPS', prefix: '1Z' },
  { name: 'FedEx', prefix: '77' },
  { name: 'DPD', prefix: '05' },
  { name: 'GLS', prefix: 'GL' },
];

const WAREHOUSES = ['Amsterdam', 'Istanbul', 'Berlin'] as const;

/** FNV-1a: an organization's id as a 32-bit seed. */
function hashOf(text: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/** A repeatable number in [0, 1) for a seed and two channels. */
function unit(seed: number, a: number, b = 0): number {
  let x = (seed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca77)) >>> 0;

  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;

  return (x >>> 0) / 4_294_967_296;
}

function pick<T>(items: readonly T[], draw: number): T {
  const item = items[Math.min(items.length - 1, Math.floor(draw * items.length))];

  if (item === undefined) throw new Error('pick from an empty list');

  return item;
}

/** A name as an email's local part: no accents, no dotless i, no spaces. */
function asciiOf(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

const cents = (value: number) => Math.round(value * 100) / 100;

function productsOf(seed: number): Product[] {
  return TEMPLATES.map((template, index) => {
    const draw = (channel: number) => unit(seed, index, channel);
    const views = Math.round(600 + draw(1) ** 2 * 26_000);
    const conversion = 0.008 + draw(2) * 0.07;
    const stockDraw = draw(3);

    return {
      id: `prod_${String(index + 1).padStart(3, '0')}`,
      sku: `${CATEGORY_CODES[template.category]}-${1000 + ((index * 37 + (seed % 97)) % 9000)}`,
      name: template.name,
      category: template.category,
      shape: template.shape,
      price: Math.max(9, Math.round(template.price * (0.9 + draw(4) * 0.25))) - 0.01,
      stock: stockDraw < 0.08 ? 0 : stockDraw < 0.24 ? 1 + Math.floor(draw(5) * 12) : 13 + Math.floor(draw(5) * 228),
      sold: Math.round(views * conversion),
      views,
    };
  });
}

function customersOf(seed: number, now: Date): Customer[] {
  return Array.from({ length: CUSTOMER_COUNT }, (_, index) => {
    const draw = (channel: number) => unit(seed, 1000 + index, channel);
    const place = pick(PLACES, draw(1));
    const first = pick(place.first, draw(2));
    const last = pick(place.last, draw(3));
    const orders = 1 + Math.floor(draw(4) ** 1.8 * 24);
    const spent = cents(orders * (38 + draw(5) * 140));

    return {
      id: `cus_${String(index + 1).padStart(3, '0')}`,
      name: `${first} ${last}`,
      email: `${asciiOf(first)}.${asciiOf(last)}@example.com`,
      city: place.city,
      country: place.country,
      segment: segmentOf({ orders, spent }, VIP_SPEND),
      orders,
      spent,
      views: Math.round(8 + draw(6) ** 1.5 * 640),
      lastSeen: new Date(now.getTime() - Math.floor(draw(7) ** 2 * 30 * DAY_MS)).toISOString(),
    };
  });
}

/**
 * Minutes after the order when each step happens: packed within the hour,
 * at the door within about half a day -- quick enough that the latest
 * orders on the board stand at every step, delivered included. Each step
 * waits on the one before it, so none can come early.
 */
function planOf(seed: number, slot: number): Record<OrderStage, number> {
  const packed = 15 + unit(seed, slot, 3) * 30;
  const shipped = packed + 60 + unit(seed, slot, 4) * 120;
  const out = shipped + 180 + unit(seed, slot, 5) * 180;

  return { placed: 0, packed, shipped, 'out-for-delivery': out, delivered: out + 45 + unit(seed, slot, 6) * 150 };
}

function ordersOf(seed: number, products: readonly Product[], customers: readonly Customer[], now: Date, limit: number): Order[] {
  const nowMs = now.getTime();
  const slotMs = SLOT_MINUTES * MINUTE_MS;
  const lastSlot = Math.floor(nowMs / slotMs);
  const warehouse = pick(WAREHOUSES, unit(seed, 7));
  const orders: Order[] = [];

  for (let slot = lastSlot; orders.length < limit && slot > lastSlot - SLOTS_BACK; slot -= 1) {
    if (unit(seed, slot, 1) >= ORDER_CHANCE) continue;

    const placedAt = slot * slotMs + Math.floor(unit(seed, slot, 2) * slotMs);

    // This slot's order has not come in yet.
    if (placedAt > nowMs) continue;

    const plan = planOf(seed, slot);
    const customer = pick(customers, unit(seed, slot, 7));
    const items = 1 + Math.floor(unit(seed, slot, 8) ** 2 * 4);
    const carrier = pick(CARRIERS, unit(seed, slot, 9));
    const total = Array.from({ length: items }, (_, item) => pick(products, unit(seed, slot, 10 + item)).price).reduce(
      (sum, price) => sum + price,
      0
    );

    orders.push({
      id: `SC-${10_000 + (slot % 90_000)}`,
      customer: { name: customer.name, city: customer.city, country: customer.country },
      items,
      total: cents(total),
      carrier: carrier.name,
      tracking: `${carrier.prefix}${String(Math.floor(unit(seed, slot, 20) * 1e10)).padStart(10, '0')}`,
      from: warehouse,
      reached: ORDER_STAGES.filter((stage) => placedAt + plan[stage] * MINUTE_MS <= nowMs).map((stage) => ({
        stage,
        at: new Date(placedAt + Math.round(plan[stage] * MINUTE_MS)).toISOString(),
      })),
      eta: new Date(placedAt + Math.round(plan.delivered * MINUTE_MS)).toISOString(),
    });
  }

  return orders;
}

/** Products do not move with the clock; each store's are made once. */
const productCache = new Map<number, Product[]>();

function productsFor(organizationId: OrganizationId): { seed: number; products: Product[] } {
  const seed = hashOf(organizationId);
  let products = productCache.get(seed);

  if (!products) {
    if (productCache.size > 500) productCache.clear();
    products = productsOf(seed);
    productCache.set(seed, products);
  }

  return { seed, products };
}

export function createDemoCommerceSource(): CommerceSource {
  return {
    kind: 'demo',

    products({ organizationId }) {
      return Promise.resolve(productsFor(organizationId).products);
    },

    customers({ organizationId, now }) {
      return Promise.resolve(customersOf(hashOf(organizationId), now));
    },

    orders({ organizationId, now, limit }) {
      const { seed, products } = productsFor(organizationId);

      return Promise.resolve(ordersOf(seed, products, customersOf(seed, now), now, limit));
    },
  };
}
