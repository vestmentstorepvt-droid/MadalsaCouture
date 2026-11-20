import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { ShopFacets } from '../../../services/productsApi';
import { formatINR } from '../../ui/ProductCard';
import type { ShopFilterState } from './useShopFilters';

/** Jewel palette shared with the home page bands (CollectionBanner / Testimonials). */
export const JEWEL = { maroon: '#5e0d1d', maroonHover: '#741427', gold: '#e2c27a', ivory: '#f6ead2' } as const;

/** Thin gold scrollbar for the sidebar and the mobile sheet. */
export const THEMED_SCROLLBAR =
  '[scrollbar-width:thin] [scrollbar-color:#d9ccb4_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gold-muted hover:[&::-webkit-scrollbar-thumb]:bg-gold-deep';

interface FilterPanelProps {
  facets?: ShopFacets;
  state: ShopFilterState;
  update: (changes: Record<string, string | null>) => void;
  toggleInList: (key: 'cat' | 'size' | 'color', value: string) => void;
}

const PRICE_BANDS = [
  { label: 'Under ₹2,000', min: undefined, max: 1999 },
  { label: '₹2,000 – ₹4,000', min: 2000, max: 4000 },
  { label: '₹4,000 – ₹6,000', min: 4000, max: 6000 },
  { label: '₹6,000 & above', min: 6000, max: undefined },
] as const;

const Section: React.FC<{ title: string; count?: number; children: React.ReactNode }> = ({ title, count, children }) => (
  <details open className="group border-b border-gold-muted/70 py-5 last:border-b-0">
    <summary className="flex cursor-pointer list-none items-center justify-between rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5e0d1d] [&::-webkit-details-marker]:hidden">
      <span className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-[0.12em] text-ink">
        {title}
        {count ? (
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-sans text-xs font-medium tracking-normal tabular-nums"
            style={{ backgroundColor: JEWEL.maroon, color: JEWEL.ivory }}
          >
            {count}
          </span>
        ) : null}
      </span>
      <ChevronDown className="h-4 w-4 text-gold-deep transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
    </summary>
    <div className="mt-4">{children}</div>
  </details>
);

/** Checkbox row; `round` draws a radio-style dot for single-choice lists. */
const CheckRow: React.FC<{ checked: boolean; label: string; count?: number; round?: boolean; onChange: () => void }> = ({
  checked,
  label,
  count,
  round,
  onChange,
}) => (
  <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm text-body transition-colors hover:text-ink">
    <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
    <span
      aria-hidden="true"
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#5e0d1d]/30 ${
        round ? 'rounded-full' : 'rounded-[5px]'
      } ${checked ? 'border-[#5e0d1d] bg-[#5e0d1d]' : 'border-hairline-strong bg-surface'}`}
    >
      {checked &&
        (round ? (
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: JEWEL.gold }} />
        ) : (
          <Check className="h-3 w-3" strokeWidth={3} style={{ color: JEWEL.gold }} />
        ))}
    </span>
    <span className={`flex-1 ${checked ? 'font-medium text-ink' : ''}`}>{label}</span>
    {count !== undefined && <span className="text-xs tabular-nums text-faint">{count}</span>}
  </label>
);

/** On/off switch for single yes/no filters. */
const Toggle: React.FC<{ checked: boolean; label: string; count?: number; onChange: () => void }> = ({ checked, label, count, onChange }) => (
  <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-body hover:text-ink">
    <span className={`flex-1 ${checked ? 'font-medium text-ink' : ''}`}>
      {label}
      {count !== undefined && <span className="ml-1.5 text-xs tabular-nums text-faint">{count}</span>}
    </span>
    <input type="checkbox" role="switch" checked={checked} onChange={onChange} className="peer sr-only" />
    <span
      aria-hidden="true"
      className={`relative h-6 w-10 shrink-0 rounded-full border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#5e0d1d]/30 ${
        checked ? 'border-[#5e0d1d] bg-[#5e0d1d]' : 'border-hairline-strong bg-hairline-soft'
      }`}
    >
      <span
        className={`absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full shadow-sm transition-[left] duration-200 motion-reduce:transition-none ${
          checked ? 'left-[18px]' : 'left-[2px] bg-surface'
        }`}
        style={checked ? { backgroundColor: JEWEL.gold } : undefined}
      />
    </span>
  </label>
);

export const FilterPanel: React.FC<FilterPanelProps> = ({ facets, state, update, toggleInList }) => {
  const priceKey = `${state.minPrice ?? ''}-${state.maxPrice ?? ''}`;
  const [minDraft, setMinDraft] = useState(state.minPrice?.toString() ?? '');
  const [maxDraft, setMaxDraft] = useState(state.maxPrice?.toString() ?? '');
  const [lastPriceKey, setLastPriceKey] = useState(priceKey);
  if (priceKey !== lastPriceKey) {
    // Keep the inputs in sync when price changes elsewhere (a band, a chip, "Clear all").
    setLastPriceKey(priceKey);
    setMinDraft(state.minPrice?.toString() ?? '');
    setMaxDraft(state.maxPrice?.toString() ?? '');
  }

  const applyPriceDrafts = () => {
    const toParam = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? null : String(Math.max(0, Math.round(Number(v)))));
    let min = toParam(minDraft);
    let max = toParam(maxDraft);
    if (min && max && Number(min) > Number(max)) [min, max] = [max, min];
    update({ min, max });
  };

  if (!facets) {
    return (
      <div className="space-y-7 py-5" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-4 w-24 animate-pulse rounded bg-gold-muted/40" />
            <div className="h-9 w-full animate-pulse rounded bg-hairline-soft" />
          </div>
        ))}
      </div>
    );
  }

  const priceBands = PRICE_BANDS.filter(
    (band) => (band.max === undefined || band.max >= facets.price.min) && (band.min === undefined || band.min <= facets.price.max),
  );
  const priceInputClass =
    'mt-1 h-10 w-full rounded-md border border-hairline-strong bg-surface px-2.5 text-base text-ink tabular-nums placeholder:text-faint focus:border-[#5e0d1d] focus:outline-none focus:ring-2 focus:ring-[#5e0d1d]/15 sm:text-sm';

  return (
    <div>
      {facets.categories.length > 0 && (
        <Section title="Category" count={state.categories.length}>
          {facets.categories.map((category) => (
            <CheckRow
              key={category.slug}
              label={category.name}
              count={category.count}
              checked={state.categories.includes(category.slug)}
              onChange={() => toggleInList('cat', category.slug)}
            />
          ))}
        </Section>
      )}

      {facets.sizes.length > 0 && (
        <Section title="Size" count={state.sizes.length}>
          <div className="grid grid-cols-5 gap-1.5">
            {facets.sizes.map((size) => {
              const selected = state.sizes.includes(size.value);
              const soldOut = size.inStockCount === 0;
              return (
                <button
                  key={size.value}
                  type="button"
                  aria-pressed={selected}
                  title={soldOut ? 'Currently sold out' : `${size.count} pieces`}
                  onClick={() => toggleInList('size', size.value)}
                  className={`h-10 rounded-md border text-sm font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5e0d1d] ${
                    selected
                      ? 'border-[#5e0d1d] bg-[#5e0d1d] text-[#f6ead2] shadow-[inset_0_0_0_1px_rgb(226_194_122/0.6)]'
                      : `border-hairline-strong bg-surface hover:border-[#5e0d1d] ${soldOut ? 'text-faint line-through' : 'text-ink'}`
                  }`}
                >
                  {size.value}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {facets.colors.length > 0 && (
        <Section title="Colour" count={state.colors.length}>
          <div className="grid grid-cols-5 gap-x-1 gap-y-3">
            {facets.colors.map((color) => {
              const selected = state.colors.includes(color.value);
              return (
                <button
                  key={color.value}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${color.label} (${color.count})`}
                  title={`${color.label} · ${color.count}`}
                  onClick={() => toggleInList('color', color.value)}
                  className="group/swatch flex flex-col items-center gap-1.5 rounded-md py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5e0d1d]"
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-shadow ${
                      selected
                        ? 'shadow-[0_0_0_2px_#fafafa,0_0_0_4px_#5e0d1d]'
                        : 'shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] group-hover/swatch:shadow-[0_0_0_2px_#fafafa,0_0_0_3px_#c9a24e]'
                    }`}
                    style={{ background: color.swatch }}
                  >
                    {selected && (
                      <Check
                        className="h-3.5 w-3.5"
                        strokeWidth={3}
                        style={{ color: ['white', 'beige', 'yellow', 'metallic'].includes(color.value) ? JEWEL.maroon : '#fff' }}
                      />
                    )}
                  </span>
                  <span className={`max-w-full truncate text-xs leading-none ${selected ? 'font-medium text-ink' : 'text-mute'}`}>
                    {color.label.split(' & ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Price" count={state.minPrice !== undefined || state.maxPrice !== undefined ? 1 : 0}>
        {priceBands.map((band) => {
          const selected = state.minPrice === band.min && state.maxPrice === band.max;
          return (
            <CheckRow
              key={band.label}
              round
              label={band.label}
              checked={selected}
              onChange={() =>
                update(selected ? { min: null, max: null } : { min: band.min?.toString() ?? null, max: band.max?.toString() ?? null })
              }
            />
          );
        })}
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            applyPriceDrafts();
          }}
        >
          <label className="flex-1 text-xs text-mute">
            Min
            <input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder={formatINR(facets.price.min)}
              value={minDraft}
              onChange={(e) => setMinDraft(e.target.value)}
              onBlur={applyPriceDrafts}
              className={priceInputClass}
            />
          </label>
          <span className="pb-2.5 text-gold-deep" aria-hidden="true">–</span>
          <label className="flex-1 text-xs text-mute">
            Max
            <input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder={formatINR(facets.price.max)}
              value={maxDraft}
              onChange={(e) => setMaxDraft(e.target.value)}
              onBlur={applyPriceDrafts}
              className={priceInputClass}
            />
          </label>
          <button type="submit" className="sr-only">Apply price</button>
        </form>
      </Section>

      <Section title="Availability" count={(state.inStock ? 1 : 0) + (state.onSale ? 1 : 0)}>
        <Toggle label="In stock only" count={facets.inStockCount} checked={state.inStock} onChange={() => update({ stock: state.inStock ? null : '1' })} />
        <Toggle label="On sale" count={facets.onSaleCount} checked={state.onSale} onChange={() => update({ sale: state.onSale ? null : '1' })} />
      </Section>
    </div>
  );
};

export default FilterPanel;
