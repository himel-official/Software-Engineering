// Verification badge for investigators
export default function Badge({ status, jobType }) {
  const job = jobType ? (jobType === "police" ? "Police" : "Journalist") : null;
  return (
    <span className="badges">
      {job && <span className="badge job">{job}</span>}
      {status === "verified" ? (
        <span className="badge verified">Verified ✓</span>
      ) : (
        <span className="badge unverified">Unverified</span>
      )}
    </span>
  );
}
