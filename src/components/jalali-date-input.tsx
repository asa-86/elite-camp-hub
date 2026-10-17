import { JALALI_MONTHS, isoToJalaliParts, jalaliMonthLength, jalaliToIso, toFaDigits, todayIso } from "@/lib/jalali";
import { selectCls } from "@/components/ui-kit";

/** Jalali date picker; value/onChange use ISO (Gregorian) strings for storage. */
export function JalaliDateInput({ value, onChange, id }: { value: string; onChange: (iso: string) => void; id?: string }) {
  const p = isoToJalaliParts(value || todayIso());
  const thisYear = isoToJalaliParts(todayIso()).jy;
  const years = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2];
  const days = jalaliMonthLength(p.jy, p.jm);
  const set = (jy: number, jm: number, jd: number) => onChange(jalaliToIso(jy, jm, Math.min(jd, jalaliMonthLength(jy, jm))));
  return (
    <div className="grid grid-cols-3 gap-2" id={id}>
      <select aria-label="روز" className={selectCls} value={p.jd} onChange={(e) => set(p.jy, p.jm, +e.target.value)}>
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{toFaDigits(d)}</option>)}
      </select>
      <select aria-label="ماه" className={selectCls} value={p.jm} onChange={(e) => set(p.jy, +e.target.value, p.jd)}>
        {JALALI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select aria-label="سال" className={selectCls} value={p.jy} onChange={(e) => set(+e.target.value, p.jm, p.jd)}>
        {years.map((y) => <option key={y} value={y}>{toFaDigits(y)}</option>)}
      </select>
    </div>
  );
}
