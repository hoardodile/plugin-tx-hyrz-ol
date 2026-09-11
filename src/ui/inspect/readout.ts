/**
 * Shared width for the live numeric readout in the bottom control bar.
 *
 * The frame counter ticks every animation frame, so both its digit count and
 * its millisecond value change constantly. The readout therefore sits in a slot
 * of fixed width with tabular figures: a value that widens never moves the
 * controls beside it. The text inside the slot stays plain — no border, no
 * padding — and the row centres it.
 */
export const READOUT_SLOT = "w-44"
