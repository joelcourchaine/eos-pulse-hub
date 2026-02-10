import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onKeyDown, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Prevent arrow keys from changing number input values
      if (type === "number" && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
      }
      onKeyDown?.(e);
    };

    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      if (type === "number") {
        e.currentTarget.blur();
      }
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
