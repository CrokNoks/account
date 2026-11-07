import * as React from "react"

import { Input } from "@/components/ui/input"

type AmountInputProps = Omit<React.ComponentProps<"input">, "type" | "inputMode"> & {
  /**
   * "signed" (default): the user may type a "-". "unsigned": the sign comes from elsewhere
   * (Dépense/Revenu button), no "-" needed, so the native decimal keypad is used.
   */
  variant?: "signed" | "unsigned"
}

/**
 * Text field for a money amount typed by the user (convert with parseAmountToCents / toCents).
 *
 * Not type="number". "signed": never inputMode="decimal"/"numeric" either: on mobile those keypads
 * (iOS in particular) have no "-" key, so a negative amount could not be typed;
 * inputMode="text" gives the full keyboard, whose symbols row has "-".
 * "unsigned" only: inputMode="decimal" (the iOS decimal keypad does not always have a comma
 * depending on the language, hence the tolerant reader that also accepts a dot; not tested on a device).
 * Never add pattern="[0-9]*": iOS would switch back to the numeric keypad.
 */
function AmountInput({ variant = "signed", ...props }: AmountInputProps) {
  return (
    <Input
      autoComplete="off"
      {...props}
      type="text"
      inputMode={variant === "unsigned" ? "decimal" : "text"}
    />
  )
}

export { AmountInput }
