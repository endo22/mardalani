import { cn } from "@/lib/utils";
import { SelectHTMLAttributes, forwardRef } from "react";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-11 w-full cursor-pointer appearance-none rounded-[var(--radius-md)] bg-white bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat px-3.5 pr-10 text-charcoal ring-1 ring-forest/15 transition-[box-shadow,ring-color] hover:ring-forest/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-60",
      className,
    )}
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23173D35' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    }}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
