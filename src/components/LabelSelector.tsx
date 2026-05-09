import type { Label } from "../types";
import { labelText } from "../format";
import { useI18n } from "../i18n";

export default function LabelSelector({
  labels,
  selected,
  onChange,
  compact = false
}: {
  labels: Label[];
  selected: string[];
  onChange: (selected: string[]) => void;
  compact?: boolean;
}) {
  const { language } = useI18n();
  function toggle(code: string) {
    if (selected.includes(code)) {
      onChange(selected.filter((item) => item !== code));
    } else {
      onChange([...selected, code]);
    }
  }

  return (
    <div className={compact ? "label-selector compact" : "label-selector"}>
      {labels.map((label) => (
        <label className="form-check form-check-inline" key={label.code}>
          <input
            className="form-check-input"
            type="checkbox"
            checked={selected.includes(label.code)}
            onChange={() => toggle(label.code)}
          />
          <span className="form-check-label">{labelText(label, language)}</span>
        </label>
      ))}
    </div>
  );
}
