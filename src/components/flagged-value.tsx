import { flagValue } from "@/lib/vitals-flags";

// Abnormal-value display: color + direction arrow + accessible label, so the
// flag is never carried by color alone.
export function FlaggedValue({
  metric,
  value,
  text,
}: {
  metric: string;
  value: number;
  text: string;
}) {
  const flag = flagValue(metric, value);
  if (flag.level === "normal") return <span>{text}</span>;
  const arrow = flag.direction === "high" ? "▲" : "▼";
  const label = `${flag.level === "critical" ? "critically" : ""} ${flag.direction}`.trim();
  return (
    <span
      title={`${text} — ${label}`}
      className={
        flag.level === "critical"
          ? "font-semibold text-rose-700"
          : "font-semibold text-amber-700"
      }
    >
      {text} {arrow}
      <span className="sr-only"> ({label})</span>
    </span>
  );
}

/** BP pair flagged by the worse of systolic/diastolic. */
export function FlaggedBp({
  systolic,
  diastolic,
}: {
  systolic: number;
  diastolic: number | null;
}) {
  const sys = flagValue("systolic", systolic);
  const dia = diastolic !== null ? flagValue("diastolic", diastolic) : null;
  const worse =
    dia && (dia.level === "critical" || (dia.level === "warn" && sys.level === "normal"))
      ? { metric: "diastolic", value: diastolic! }
      : { metric: "systolic", value: systolic };
  return (
    <FlaggedValue
      metric={worse.metric}
      value={worse.value}
      text={`BP ${systolic}/${diastolic ?? "–"}`}
    />
  );
}
