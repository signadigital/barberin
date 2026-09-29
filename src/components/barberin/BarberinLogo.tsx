import { cn } from "@/lib/utils";

export const BarberinLogo = ({
  className,
  size,
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | string;
}) => (
  <img
    src="/barberin-logo.png"
    alt="Logo BARBERIN"
    className={cn("h-8 w-8 object-contain", className)}
  />
);
