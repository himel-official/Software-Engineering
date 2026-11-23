import { fmtSize } from "../utils";

const ICON = { pdf: "📄", document: "📝", video: "🎬", image: "🖼️" };
const LABEL = { pdf: "PDF", document: "Document", video: "Video", image: "Picture" };

// Shows attached files: pictures and videos directly, PDFs and documents as download links.
//   files: [{id, kind, mime, size, name?}]      urlFor(file) -> address of the file
//   inline=false -> only links (used where opening a file is written to the audit log, e.g. admin chat view)
//   compact -> small version for map pop-ups
export default function Attachments({ files, urlFor, inline = true, compact = false }) {
  if (!files || files.length === 0) return null;
  const media = inline ? files.filter((f) => f.kind === "image" || f.kind === "video") : [];
  const links = files.filter((f) => !media.includes(f));

  return (
    <div className={"attachments" + (compact ? " compact" : "")}>
      {media.length > 0 && (
        <div className="media-grid">
          {media.map((f) =>
            f.kind === "image" ? (
              <a key={f.id} href={urlFor(f)} target="_blank" rel="noreferrer" title="Open full size">
                <img src={urlFor(f)} alt={f.name || "Attached picture"} loading="lazy" />
              </a>
            ) : (
              <video key={f.id} src={urlFor(f)} controls preload="metadata" />
            )
          )}
        </div>
      )}
      {links.map((f) => (
        <a key={f.id} className="file-link" href={urlFor(f)} target="_blank" rel="noreferrer">
          <span>{ICON[f.kind]}</span>
          <span className="grow">{f.name || `${LABEL[f.kind]} attachment`}</span>
          <small>{fmtSize(f.size)}</small>
        </a>
      ))}
    </div>
  );
}
