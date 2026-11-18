// @ts-nocheck — ported from the Express backend (modules/orders/orders.stateMachine.js); logic unchanged.
import __imp0 from "@/server/constants/orderStates";

/**
 * Order State Machine
 *
 * Canonical module-level re-export of the order state transitions.
 * The source of truth lives in src/constants/orderStates.js — this file
 * re-exports from there so the orders module is self-contained without
 * duplicating logic.
 */

const { ORDER_STATES, TRANSITIONS, isValidTransition } = __imp0;

const __exports: any = { ORDER_STATES, TRANSITIONS, isValidTransition };

export default __exports;
