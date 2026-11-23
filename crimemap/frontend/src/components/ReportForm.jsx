import { useState } from "react";
import CrimeMap from "./CrimeMap";
import FilePicker from "./FilePicker";
import Attachments from "./Attachments";
import { useMeta } from "../MetaContext";
import { MAX_FILE_MB } from "../utils";

const MAX_FILES = 5;
const toLocalInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

// Used for both "new report" and "edit report". onSubmit receives a FormData (fields + attached files).
export default function ReportForm({ initial, submitLabel, onSubmit, onCancel }) {
  const meta = useMeta();
  const [type, setType] = useState(initial?.type || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [occurredAt, setOccurredAt] = useState(toLocalInput(initial ? new Date(initial.occurred_at) : new Date()));
  const [pos, setPos] = useState(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [fly, setFly] = useState(null);
  const [newFiles, setNewFiles] = useState([]);
  const [removed, setRemoved] = useState([]); // ids of existing attachments to delete (edit only)
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const existing = (initial?.files || []).filter((f) => !removed.includes(f.id));
  const room = MAX_FILES - existing.length;

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(here);
        setFly([here.lat, here.lng]);
      },
      () => setError("Could not get your location. Click on the map instead.")
    );
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!pos) return setError("Click on the map to mark where it happened");
    const data = new FormData();
    data.append("type", type);
    data.append("description", description);
    data.append("lat", pos.lat);
    data.append("lng", pos.lng);
    data.append("occurredAt", new Date(occurredAt).toISOString());
    if (removed.length) data.append("removeFileIds", JSON.stringify(removed));
    newFiles.forEach((f) => data.append("files", f));
    setBusy(true);
    try {
      await onSubmit(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!meta) return <p>Loading...</p>;

  return (
    <form onSubmit={submit} className="stack">
      {error && <p className="error">{error}</p>}

      <label>
        Type of crime
        <select value={type} onChange={(e) => setType(e.target.value)} required>
          <option value="">Choose...</option>
          {meta.crimeTypes.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </label>

      <label>
        When did it happen?
        <input type="datetime-local" value={occurredAt} max={toLocalInput(new Date())} onChange={(e) => setOccurredAt(e.target.value)} required />
      </label>

      <label>
        What happened? <small>(10-1000 characters. Do not write names or personal details of anyone.)</small>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={1000} required />
      </label>

      <div>
        <div className="row between">
          <strong>Where did it happen?</strong>
          <button type="button" className="secondary small" onClick={useMyLocation}>📍 Use my location</button>
        </div>
        <small>Click the map to place the marker. The public map shows it only approximately (about 100 m).</small>
        <div className="picker"><CrimeMap meta={meta} onMapClick={setPos} picked={pos} flyTo={fly} /></div>
      </div>

      <div className="stack tight">
        <strong>Evidence <small className="muted">(optional: pictures, videos, PDFs, documents)</small></strong>
        {existing.length > 0 && (
          <div className="existing-files">
            {existing.map((f) => (
              <div key={f.id} className="row between">
                <div className="grow"><Attachments files={[f]} urlFor={(x) => `/api/reports/files/${x.id}`} compact /></div>
                <button type="button" className="danger small" onClick={() => setRemoved([...removed, f.id])}>Remove</button>
              </div>
            ))}
          </div>
        )}
        <FilePicker files={newFiles} onChange={setNewFiles} max={room} onError={setError} disabled={room <= 0} />
        <small className="muted">
          Up to {MAX_FILES} files, {MAX_FILE_MB} MB each. <strong>Everything you attach is visible to everyone</strong>, so do not show faces, number plates or
          documents with personal details. Location data is removed from photos automatically, but videos and documents are published exactly as you upload them.
        </small>
      </div>

      <div className="row">
        <button disabled={busy}>{busy ? "Saving..." : submitLabel}</button>
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
