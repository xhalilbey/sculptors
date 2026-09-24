import { cn } from '@/lib/utils';

/**
 * The flame, as an inline SVG so it takes the current text colour. The PNG in
 * /public is black on transparent and disappears on a dark ground; this is
 * the same shape and paints in whatever colour the surface asks for.
 */
export function SculptorsMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn('h-6 w-6', className)}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.177 7.547 7.547 0 01-1.705-1.715.75.75 0 00-1.152-.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
