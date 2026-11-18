// @ts-nocheck — ported from the Express backend (utils/stateMachine.js); logic unchanged.


/**
 * Generic state-machine helpers shared by any module that models a status
 * flow as a directed graph (Order, Exchange, ...).
 *
 * Why this exists:
 *   Several flows in this codebase (order payment confirmation, exchange QC)
 *   used to call a single-hop transition directly to a target status that
 *   was only reachable through one or more mandatory intermediate states
 *   (e.g. Created -> Paid, when the graph requires Created -> Pending -> Paid).
 *   Nothing in the codebase ever performed the intermediate hop, so the
 *   direct call always failed with INVALID_TRANSITION.
 *
 *   Rather than hunting down every call site and hand-wiring the missing
 *   hop, callers should resolve the full path once via `findPath` and walk
 *   it, applying each hop's side effects in order. This is the same pattern
 *   used by workflow engines (e.g. "advance to state X") and is resilient
 *   to future states being inserted into the graph.
 */

/**
 * Breadth-first search over a `{ state: [reachableState, ...] }` transition
 * graph. Returns the shortest sequence of hops from `from` to `to`
 * (exclusive of `from`, inclusive of `to`), or `null` if `to` is not
 * reachable from `from` at all.
 *
 * @param {Record<string, string[]>} transitions - Adjacency list.
 * @param {string} from - Starting state.
 * @param {string} to   - Target state.
 * @returns {string[]|null} Ordered list of hops, `[]` if already at `to`, or `null`.
 */
function findPath(transitions, from, to) {
  if (from === to) return [];

  const queue = [[from]];
  const visited = new Set([from]);

  while (queue.length > 0) {
    const path = queue.shift();
    const last = path[path.length - 1];
    const neighbors = transitions[last] || [];

    for (const next of neighbors) {
      if (next === to) {
        return [...path.slice(1), next];
      }
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }

  return null;
}

const __exports: any = { findPath };

export default __exports;
