import {
  Backpack,
  Bike,
  BookOpen,
  Camera,
  Coffee,
  Droplet,
  Flame,
  Footprints,
  Glasses,
  Headphones,
  Lamp,
  Milk,
  Shirt,
  ShoppingBag,
  Speaker,
  Sprout,
  Tent,
  Watch,
  type LucideIcon,
} from 'lucide-react';
import type { Tone } from '@/components/charts/verdict';
import { cn } from '@/lib/utils';
import type { ProductShape } from '../domain/products';

const SHAPES: Record<ProductShape, LucideIcon> = {
  mug: Coffee,
  lamp: Lamp,
  candle: Flame,
  plant: Sprout,
  tee: Shirt,
  shirt: Shirt,
  sneaker: Footprints,
  bag: ShoppingBag,
  backpack: Backpack,
  glasses: Glasses,
  watch: Watch,
  headphones: Headphones,
  speaker: Speaker,
  camera: Camera,
  dropper: Droplet,
  bottle: Milk,
  tent: Tent,
  bike: Bike,
  book: BookOpen,
};

const FLOOR: Record<Tone, string> = {
  dark: 'bg-[radial-gradient(closest-side,rgba(0,0,0,0.55),transparent)]',
  light: 'bg-[radial-gradient(closest-side,rgba(0,0,0,0.14),transparent)]',
};

const GROUND: Record<Tone, string> = {
  dark: 'bg-[linear-gradient(160deg,#27272b_0%,#1b1b1e_100%)]',
  light: 'bg-[linear-gradient(160deg,#f4f4f2_0%,#e9e9e6_100%)]',
};

/**
 * A product's picture until the store's own photos arrive with its sync:
 * the product drawn in one quiet line on a soft ground, standing on a faint
 * shadow like a studio shot -- one tone, so a grid of them stays calm
 * (owner's direction, 23 Sep 2026: not too colourful).
 */
export function ProductArt({ shape, tone, className }: { shape: ProductShape; tone: Tone; className?: string }) {
  const Icon = SHAPES[shape];

  return (
    <div className={cn('relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[14px]', GROUND[tone], className)}>
      {/* The floor shadow is a radial gradient, not a blur. */}
      <span className={cn('absolute bottom-[21%] h-4 w-[42%] rounded-[50%]', FLOOR[tone])} aria-hidden="true" />
      <Icon className="relative h-[34%] w-[34%] text-[var(--card-text-soft)]" strokeWidth={1.1} aria-hidden="true" />
    </div>
  );
}
