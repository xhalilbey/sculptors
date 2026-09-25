import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Modal } from './modal';

/**
 * The dialog is named after its own title. The id used to be a fixed
 * 'modal-title', so two modals on one page shared it and a screen reader
 * named both after whichever title came first.
 */

function labelledByAndTitleIds(html: string) {
  return {
    labelledBy: [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map(match => match[1]),
    titleIds: [...html.matchAll(/<h2 id="([^"]+)"/g)].map(match => match[1]),
  };
}

describe('Modal', () => {
  it('points aria-labelledby at its own title', () => {
    const html = renderToStaticMarkup(
      <Modal open onClose={() => undefined} title="New pipeline">
        body
      </Modal>
    );
    const { labelledBy, titleIds } = labelledByAndTitleIds(html);

    expect(labelledBy).toHaveLength(1);
    expect(titleIds).toEqual(labelledBy);
  });

  it('gives each modal on a page a title id of its own', () => {
    const html = renderToStaticMarkup(
      <>
        <Modal open onClose={() => undefined} title="First">
          one
        </Modal>
        <Modal open onClose={() => undefined} title="Second">
          two
        </Modal>
      </>
    );
    const { labelledBy, titleIds } = labelledByAndTitleIds(html);

    expect(titleIds).toHaveLength(2);
    expect(new Set(titleIds).size).toBe(2);
    expect(labelledBy).toEqual(titleIds);
  });
});
