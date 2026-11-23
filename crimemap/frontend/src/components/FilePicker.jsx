import { useRef } from "react";
import { ACCEPT, MAX_FILE_MB, fmtSize } from "../utils";

// Choose files to attach. files = array of File objects, onChange(newArray). max = how many files are allowed.
export default function FilePicker({ files, onChange, max = 5, onError, label = "📎 Add files", disabled = false }) {
  const input = useRef(null);

  function add(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = ""; // allows choosing the same file again
    const next = [...files];
    for (const f of picked) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        onError?.(`"${f.name}" is bigger than ${MAX_FILE_MB} MB`);
        continue;
      }
      if (next.length >= max) {
        onError?.(`You can attach at most ${max} file${max === 1 ? "" : "s"}`);
        break;
      }
      next.push(f);
    }
    onChange(next);
  }

  return (
    <div className="filepicker">
      <input ref={input} type="file" accept={ACCEPT} multiple={max > 1} hidden onChange={add} />
      <button type="button" className="secondary small" disabled={disabled || files.length >= max} onClick={() => input.current?.click()}>
        {label}
      </button>
      {files.map((f, i) => (
        <span key={i} className="chip">
          {f.name} <small>({fmtSize(f.size)})</small>
          <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))}>×</button>
        </span>
      ))}
    </div>
  );
}
