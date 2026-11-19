/**
 * Scroll motion for the storefront (GSAP + ScrollTrigger).
 *
 * The story, top to bottom: the hero settles in and drifts slower than the page; each collection
 * banner opens like a shop window (see CollectionBanner); everything else fades up quietly in
 * small batches as it arrives. Nothing animates for people who ask for reduced motion.
 */
import type { DependencyList, RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };

/** Animations only run inside this media query. */
export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

let refreshTimer: number | undefined;
/**
 * Home rows load their data at different times, which moves everything below them.
 * Recompute trigger positions shortly after any section changes size (coalesced).
 */
export const refreshScrollSoon = () => {
  if (typeof window === 'undefined') return;
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
};

/**
 * Fade-up for every `[data-reveal]` element inside `scope`, revealed in staggered batches as they
 * enter the viewport. Elements already scrolled past when the page loads are revealed at once.
 */
export function useScrollReveal(scope: RefObject<HTMLElement | null>, dependencies: DependencyList = []) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const items = gsap.utils.toArray<HTMLElement>('[data-reveal]', scope.current);
        if (!items.length) return;
        gsap.set(items, { autoAlpha: 0, y: 36 });
        const reveal = (batch: Element[]) =>
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.09, overwrite: true });
        ScrollTrigger.batch(items, {
          start: 'top 90%',
          interval: 0.1,
          batchMax: 6,
          onEnter: reveal,
          onEnterBack: reveal,
          onLeave: reveal,
        });
      });
      refreshScrollSoon();
      return () => mm.revert();
    },
    { scope, dependencies: [...dependencies], revertOnUpdate: true },
  );
}
