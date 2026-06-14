import { Badge } from "@tourism/ui/components/custom/badge-custom";
import { mapBookingStatus, type BookingStatus, type BookingStatusTone } from "./status";

/**
 * Maps a semantic tone to a Badge variant. The theme has no dedicated
 * success/warning/info tokens, so tones reuse the existing primary/secondary/
 * muted/destructive scales while staying visually distinct. Label text (never
 * color alone) carries the status meaning for accessibility.
 */
const TONE_VARIANT: Record<
  BookingStatusTone,
  "default" | "secondary" | "outline" | "destructive"
> = {
  positive: "default",
  neutral: "secondary",
  muted: "outline",
  info: "destructive",
};

export function BookingStatusBadge({
  status,
  label,
}: {
  status: BookingStatus;
  /** Already-translated status label (parent resolves i18n). */
  label: string;
}) {
  const { tone } = mapBookingStatus(status);
  const variant = TONE_VARIANT[tone];
  return (
    <Badge
      variant={variant}
      className={tone === "muted" ? "text-muted-foreground" : undefined}
    >
      {label}
    </Badge>
  );
}
