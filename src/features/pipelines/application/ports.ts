import type { Pipeline } from '../domain/pipeline';

/**
 * Where an organization's pipelines are kept. The browser keeps them for
 * the demo; an API replaces the adapter when pipelines run for real.
 */
export interface PipelineStore {
  /** The kept list, the same array until it changes. */
  load(): readonly Pipeline[];
  save(items: readonly Pipeline[]): void;
  /** Calls back when the list changes, here or in another tab. Returns the unsubscribe. */
  subscribe(onChange: () => void): () => void;
}
