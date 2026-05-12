'use client';

import { useMemo, useRef } from 'react';

/**
 * One entry in the stable-keyed reference image list.
 *
 * - `id` is a client-side React key only; it is never persisted and
 *   never sent to the server.
 * - `data` is the original base64 / data URL / remote URL string the
 *   parent passed in. The shape of `data` is intentionally unchanged so
 *   existing callers keep working with `string[]`.
 */
export interface KeyedImage {
  id: string;
  data: string;
}

/**
 * Maps a parent-owned `string[]` of image data into a stable
 * `KeyedImage[]` for React rendering.
 *
 * Why this exists: previously the reference image lists rendered with
 * `key={index}`. When the user removed a middle item, React reused the
 * surviving DOM nodes for the wrong images (the entry that shifted into
 * the removed slot inherited the previous occupant's <img> element and
 * its decoded bitmap), producing a brief but visible misrender.
 *
 * Strategy: keep a ref-tracked list of IDs across renders. On every
 * call, walk the new `images` array left-to-right and consume IDs from
 * the previous list by *data equality*, falling back to a fresh
 * `crypto.randomUUID()` for any data value we have not seen before.
 * Matching by data value (not position) is what makes removal correct:
 * deleting index 1 of `[A, B, C]` yields `[A, C]` with `[id_A, id_C]`,
 * not `[id_A, id_B]`.
 *
 * Duplicate data values are handled by consuming previous IDs in order
 * (FIFO per data value) so two visually-identical entries still get
 * distinct stable keys.
 *
 * The hook is safe to call only on the client. `crypto.randomUUID()`
 * is available in modern browsers and Node 18+; both consumers are
 * `'use client'` components, so SSR never executes this code.
 */
export function useStableImageKeys(images: string[]): KeyedImage[] {
  const previousRef = useRef<KeyedImage[]>([]);

  return useMemo(() => {
    // Build a FIFO lookup of unused IDs from the previous render keyed
    // by their data value. We pop from each queue as we match so that
    // duplicates are assigned distinct IDs in the same order they
    // appeared before.
    const available = new Map<string, string[]>();
    for (const previous of previousRef.current) {
      const queue = available.get(previous.data);
      if (queue) {
        queue.push(previous.id);
      } else {
        available.set(previous.data, [previous.id]);
      }
    }

    const next: KeyedImage[] = images.map((data) => {
      const queue = available.get(data);
      const reusedId = queue?.shift();
      return {
        id: reusedId ?? crypto.randomUUID(),
        data,
      };
    });

    previousRef.current = next;
    return next;
  }, [images]);
}
