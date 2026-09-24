import Link from 'next/link';
import { ErrorScene } from '@/components/errors/error-scene';

/**
 * Any address nothing answers. The way out is "/", which sends a signed-in
 * visitor on to the app and anyone else to the landing page.
 */
export default function NotFound() {
  return (
    <ErrorScene
      code="404"
      eyebrow="Error 404"
      title="Nothing lives at this address."
      body="The link may be out of date, or the page has moved. Everything else is where you left it."
      actions={
        <Link href="/" className="btn-brand">
          Back home
        </Link>
      }
    />
  );
}
