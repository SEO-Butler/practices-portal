import { Fragment } from "react";
import { FlaggedBp, FlaggedValue } from "@/components/flagged-value";

interface VitalsLike {
  systolic?: number | null;
  diastolic?: number | null;
  heartRate?: number | null;
  respiratoryRate?: number | null;
  temperatureC?: number | null;
  oxygenSat?: number | null;
  painLevel?: number | null;
}

/** One-line vitals summary with abnormal values flagged (color + arrow). */
export function VitalsSummary({ v }: { v: VitalsLike }) {
  const parts: React.ReactNode[] = [];
  if (v.systolic != null) {
    parts.push(<FlaggedBp key="bp" systolic={v.systolic} diastolic={v.diastolic ?? null} />);
  }
  if (v.heartRate != null) {
    parts.push(
      <FlaggedValue key="hr" metric="heartRate" value={v.heartRate} text={`HR ${v.heartRate}`} />,
    );
  }
  if (v.respiratoryRate != null) {
    parts.push(
      <FlaggedValue
        key="rr"
        metric="respiratoryRate"
        value={v.respiratoryRate}
        text={`RR ${v.respiratoryRate}`}
      />,
    );
  }
  if (v.temperatureC != null) {
    parts.push(
      <FlaggedValue
        key="temp"
        metric="temperatureC"
        value={v.temperatureC}
        text={`${v.temperatureC}°C`}
      />,
    );
  }
  if (v.oxygenSat != null) {
    parts.push(
      <FlaggedValue
        key="spo2"
        metric="oxygenSat"
        value={v.oxygenSat}
        text={`SpO₂ ${v.oxygenSat}%`}
      />,
    );
  }
  if (v.painLevel != null) {
    parts.push(
      <FlaggedValue
        key="pain"
        metric="painLevel"
        value={v.painLevel}
        text={`Pain ${v.painLevel}/10`}
      />,
    );
  }
  if (parts.length === 0) return <span className="text-slate-500">notes only</span>;
  return (
    <span className="text-slate-600">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-slate-300"> · </span>}
          {part}
        </Fragment>
      ))}
    </span>
  );
}
