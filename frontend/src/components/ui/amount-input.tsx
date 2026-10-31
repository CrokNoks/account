import * as React from "react"

import { Input } from "@/components/ui/input"

/**
 * Text field for a money amount typed by the user (convert with parseAmountToCents / toCents).
 *
 * Not type="number" and not inputMode="decimal"/"numeric": on mobile those keypads
 * (iOS in particular) have no "-" key, so a negative amount could not be typed.
 * inputMode="text" gives the full keyboard, whose symbols row has "-".
 * Never add pattern="[0-9]*": iOS would switch back to the numeric keypad.
 */
function AmountInput(props: Omit<React.ComponentProps<"input">, "type" | "inputMode">) {
  return <Input autoComplete="off" {...props} type="text" inputMode="text" />
}

export { AmountInput }
