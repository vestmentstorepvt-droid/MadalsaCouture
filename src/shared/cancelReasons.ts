/**
 * Why a customer cancels an order. Shared by the "Cancel order" sheet (storefront) and the cancel
 * endpoint (server), which accepts only these ids. "other" needs a short note.
 */
export const CANCEL_REASONS = [
  { id: "ordered_by_mistake", label: "Ordered by mistake" },
  { id: "changed_mind", label: "Changed my mind" },
  { id: "size_or_colour", label: "Want a different size or colour" },
  { id: "change_address", label: "Want to change the delivery address" },
  { id: "delivery_too_slow", label: "Delivery is taking too long" },
  { id: "better_price", label: "Found a better price elsewhere" },
  { id: "other", label: "Other" },
] as const;

export type CancelReasonId = (typeof CANCEL_REASONS)[number]["id"];

export const CANCEL_NOTE_MAX = 300;

export const cancelReasonLabel = (id: string | null | undefined) =>
  CANCEL_REASONS.find((r) => r.id === id)?.label ?? null;

/** Statuses a customer may cancel from (a courier must also not be assigned yet). */
export const CUSTOMER_CANCELLABLE_STATUSES = ["Created", "Pending", "Paid", "Processing", "Packed", "ReadyToShip"];
