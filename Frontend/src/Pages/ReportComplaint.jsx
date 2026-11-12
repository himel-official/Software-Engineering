// src/Pages/ReportComplaint.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  Search,
  LocateFixed,
  Shield,
  ArrowLeft,
  ArrowRight,
  Check,
  List,
  Calendar,
  MapPin,
  FileText,
  Paperclip,
  Trash2,
  Copy,
  KeyRound,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Link } from "react-router";
import api, { extractErrorMessage } from "../api/client";
import { saveReport } from "../utils/savedReports";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const DEFAULT_CENTER = [23.81033, 90.412521];
const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
  "text/plain",
];

const useReverseGeocode = () => {
  const fetchAddress = useCallback(async (lat, lon) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
      );
      const data = await res.json();
      return data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    }
  }, []);

  return { fetchAddress };
};

function MapEvents({ setPosition, setAddress }) {
  const { fetchAddress } = useReverseGeocode();

  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      setAddress(await fetchAddress(lat, lng));
    },
  });
  return null;
}

function MapFlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, 15, { animate: true, duration: 1.3 });
  }, [position, map]);
  return null;
}

const Stepper = ({ currentStep }) => {
  const steps = useMemo(
    () => ["Incident Details", "Location & Time", "Evidence", "Review & Submit"],
    []
  );

  return (
    <div className="flex items-center w-full mb-10">
      {steps.map((label, idx) => {
        const isActive = currentStep === idx + 1;
        const isCompleted = currentStep > idx;

        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                  isCompleted
                    ? "bg-blue-600 text-white"
                    : isActive
                    ? "bg-blue-600 text-white ring-4 ring-blue-200"
                    : "bg-gray-100 border border-gray-300 text-gray-500"
                }`}
              >
                {isCompleted ? <Check size={24} /> : idx + 1}
              </div>
              <span
                className={`mt-2 text-xs font-semibold text-center ${
                  currentStep >= idx + 1 ? "text-blue-600" : "text-gray-500"
                }`}
              >
                {label}
              </span>
            </div>

            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-4 ${
                  currentStep > idx + 1 ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default function ReportComplaint() {
  const [coords, setCoords] = useState(DEFAULT_CENTER);
  const [searchQuery, setSearchQuery] = useState("");
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [result, setResult] = useState(null);

  const [categories, setCategories] = useState([]);
  const [files, setFiles] = useState([]);

  const [formData, setFormData] = useState({
    category_id: "",
    description: "",
    incident_datetime: "",
    location_text: "",
  });

  const stepVariants = {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 0, x: 0 },
    exit: { opacity: 0, x: -40 },
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/categories/");
        setCategories(data.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  const selectedCategory = categories.find(
    (category) => String(category.id) === String(formData.category_id)
  );

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}`
      );
      const data = await res.json();
      if (!data?.length) {
        setError("That location could not be found.");
        return;
      }
      const { lat, lon, display_name } = data[0];
      const newPos = [parseFloat(lat), parseFloat(lon)];
      setCoords(newPos);
      setFormData((prev) => ({ ...prev, location_text: display_name }));
      setError("");
    } catch {
      setError("Location search failed. Check your connection and try again.");
    }
  }, [searchQuery]);

  const goToCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Your browser does not support location services.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = [pos.coords.latitude, pos.coords.longitude];
        setCoords(newPos);
        setFormData((prev) => ({
          ...prev,
          location_text: `${newPos[0].toFixed(5)}, ${newPos[1].toFixed(5)}`,
        }));
        setError("");
      },
      () => setError("Unable to fetch your current location.")
    );
  };

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    const problems = [];

    for (const file of incoming) {
      if (file.size > MAX_EVIDENCE_BYTES) {
        problems.push(`"${file.name}" is larger than the 25 MB limit.`);
        continue;
      }
      if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
        problems.push(`"${file.name}" is not a supported file type.`);
        continue;
      }
    }

    if (problems.length) setError(problems.join(" "));
    else setError("");

    setFiles((prev) => {
      const existing = new Set(prev.map((file) => `${file.name}-${file.size}`));
      const fresh = incoming.filter(
        (file) =>
          file.size <= MAX_EVIDENCE_BYTES &&
          (!file.type || ACCEPTED_TYPES.includes(file.type)) &&
          !existing.has(`${file.name}-${file.size}`)
      );
      return [...prev, ...fresh];
    });
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const validateStep = (target) => {
    if (target === 1) {
      if (!formData.category_id) return "Please choose an incident type.";
      if (formData.description.trim().length < 20)
        return "Please describe the incident in at least 20 characters.";
    }
    if (target === 2) {
      if (!formData.incident_datetime) return "Please provide the date and time.";
      if (!formData.location_text.trim())
        return "Please provide a location for the incident.";
    }
    return "";
  };

  const nextStep = () => {
    const problem = validateStep(step);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setStep((s) => Math.min(s + 1, 4));
  };

  const prevStep = () => {
    setError("");
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    const problem = validateStep(1) || validateStep(2);
    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = new FormData();
      payload.append("category_id", formData.category_id);
      payload.append("description", formData.description.trim());
      payload.append("incident_datetime", new Date(formData.incident_datetime).toISOString());
      payload.append("location_text", formData.location_text.trim());
      payload.append("latitude", String(coords[0]));
      payload.append("longitude", String(coords[1]));
      files.forEach((file) => payload.append("evidence_files", file));

      const { data } = await api.post("/reports/", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const entry = {
        reference_number: data.reference_number,
        access_key: data.access_key,
        category: selectedCategory?.name || "",
        submitted_at: data.report?.submitted_at || new Date().toISOString(),
      };
      saveReport(entry);

      setResult(entry);
      setStep(5);
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "We could not submit your report. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const startAnother = () => {
    setResult(null);
    setFiles([]);
    setFormData({
      category_id: "",
      description: "",
      incident_datetime: "",
      location_text: "",
    });
    setCoords(DEFAULT_CENTER);
    setError("");
    setStep(1);
  };

  const copyToClipboard = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("Could not copy to the clipboard.");
    }
  };

  if (step === 5 && result) {
    return (
      <div className="w-full mt-20 min-h-screen p-4 md:p-8 bg-gray-50 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 md:p-12">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <Shield size={30} className="text-green-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Report Submitted</h1>
              <p className="text-gray-600">
                Your report was received anonymously. Save the details below.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 flex items-start gap-3">
            <Shield size={22} className="text-blue-600 mt-0.5 shrink-0" />
            <p className="text-blue-900 text-sm">
              These two values are the only way to open your report again. We
              have not stored any information that could identify you. Keep the
              access key somewhere private.
            </p>
          </div>

          <div className="space-y-4">
            <div className="border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Reference Number
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(result.reference_number, "ref")}
                  className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium"
                >
                  <Copy size={14} />
                  {copied === "ref" ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-2xl font-bold tracking-widest text-gray-900">
                {result.reference_number}
              </p>
            </div>

            <div className="border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1">
                  <KeyRound size={12} /> Access Key
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(result.access_key, "key")}
                  className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium"
                >
                  <Copy size={14} />
                  {copied === "key" ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-lg font-mono font-semibold text-gray-900 break-all">
                {result.access_key}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to={`/track?reference=${encodeURIComponent(result.reference_number)}`}
              className="flex-1 text-center px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
            >
              Track this report
            </Link>
            <button
              type="button"
              onClick={startAnother}
              className="flex-1 px-5 py-3 border border-gray-300 hover:bg-gray-50 rounded-lg font-semibold text-gray-700 transition"
            >
              Submit another report
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mt-20 min-h-screen p-4 md:p-8 bg-gray-50">
      {submitting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl px-8 py-6 shadow-2xl text-center">
            <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
            <p className="text-gray-800 font-semibold">Submitting your report...</p>
            <p className="text-xs text-gray-500 mt-1">Uploading evidence securely</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto flex flex-col-reverse lg:flex-row gap-8">
        {/* MAP */}
        <div className="w-full lg:w-3/5 h-[450px] lg:h-[80vh] rounded-2xl overflow-hidden shadow-xl">
          <MapContainer center={coords} zoom={13} scrollWheelZoom className="w-full h-full">
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={coords} />
            <MapEvents
              setPosition={setCoords}
              setAddress={(addr) => setFormData((f) => ({ ...f, location_text: addr }))}
            />
            <MapFlyTo position={coords} />
          </MapContainer>
        </div>

        {/* FORM */}
        <div className="w-full lg:w-2/5 flex flex-col gap-6">
          <div className="bg-white p-8 shadow-2xl rounded-2xl flex flex-col lg:h-[90vh]">
            <h1 className="text-3xl text-indigo-600 font-bold mb-2">Report an Incident</h1>
            <p className="text-gray-600 mb-8">Your report is 100% anonymous.</p>

            <Stepper currentStep={step} />

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-col flex-1">
              <AnimatePresence mode="wait">
                {/* STEP 1 */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    variants={stepVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-6"
                  >
                    <IconSelect
                      label="Incident Type"
                      name="category_id"
                      value={formData.category_id}
                      onChange={(e) =>
                        setFormData({ ...formData, category_id: e.target.value })
                      }
                      icon={<List size={18} />}
                    >
                      <option value="" disabled>
                        {categories.length ? "Select a type..." : "Loading categories..."}
                      </option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </IconSelect>

                    {selectedCategory?.description && (
                      <p className="text-xs text-gray-500 -mt-3">
                        {selectedCategory.description}
                      </p>
                    )}

                    <IconTextarea
                      label="Description"
                      name="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Describe what happened. Do not include your name or any detail that identifies you."
                      icon={<FileText size={18} />}
                    />

                    <p className="text-xs text-gray-500">
                      Minimum 20 characters. Avoid names, phone numbers and addresses
                      that belong to you.
                    </p>

                    <div className="mt-auto pt-6 border-t flex justify-end">
                      <button
                        type="button"
                        onClick={nextStep}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                      >
                        Next <ArrowRight size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    variants={stepVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-6"
                  >
                    <IconInput
                      label="Date & Time of Incident"
                      name="incident_datetime"
                      type="datetime-local"
                      value={formData.incident_datetime}
                      onChange={(e) =>
                        setFormData({ ...formData, incident_datetime: e.target.value })
                      }
                      icon={<Calendar size={18} />}
                    />

                    <div className="space-y-2">
                      <label className="block text-sm font-medium">Location</label>
                      <p className="text-xs text-gray-500">
                        Click the map, search for an address, or use your current location.
                      </p>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Search address..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                        <button
                          type="button"
                          onClick={handleSearch}
                          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg"
                        >
                          <Search size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={goToCurrentLocation}
                          className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg"
                        >
                          <LocateFixed size={18} />
                        </button>
                      </div>

                      <IconInput
                        name="location_text"
                        value={formData.location_text}
                        icon={<MapPin size={18} />}
                        readOnly
                        placeholder="Location will appear here"
                        isReadOnly
                      />
                    </div>

                    <div className="mt-auto pt-6 border-t flex justify-between">
                      <button
                        type="button"
                        onClick={prevStep}
                        className="px-5 py-2.5 rounded-lg flex items-center gap-2 border bg-white border-gray-300 hover:bg-gray-100"
                      >
                        <ArrowLeft size={16} /> Back
                      </button>
                      <button
                        type="button"
                        onClick={nextStep}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                      >
                        Next <ArrowRight size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3 */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    variants={stepVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-6"
                  >
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Attach Evidence (optional)
                      </label>
                      <p className="text-xs text-gray-500 mb-3">
                        Photos, videos or documents. Up to 25 MB each. Images and videos
                        are stored anonymously alongside your report.
                      </p>

                      <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl py-8 cursor-pointer transition">
                        <Paperclip size={28} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">
                          Choose files to upload
                        </span>
                        <span className="text-xs text-gray-400">
                          JPG, PNG, GIF, WEBP, MP4, MOV, WEBM, PDF or TXT
                        </span>
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*,application/pdf,text/plain"
                          className="hidden"
                          onChange={(e) => {
                            addFiles(e.target.files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>

                    {files.length > 0 && (
                      <ul className="space-y-2">
                        {files.map((file, index) => (
                          <li
                            key={`${file.name}-${file.size}`}
                            className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                          >
                            <Paperclip size={16} className="text-gray-400 shrink-0" />
                            <span className="text-sm text-gray-700 truncate flex-1">
                              {file.name}
                            </span>
                            <span className="text-xs text-gray-400 shrink-0">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="text-red-500 hover:text-red-700 shrink-0"
                              aria-label={`Remove ${file.name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-auto pt-6 border-t flex justify-between">
                      <button
                        type="button"
                        onClick={prevStep}
                        className="px-5 py-2.5 rounded-lg flex items-center gap-2 border bg-white border-gray-300 hover:bg-gray-100"
                      >
                        <ArrowLeft size={16} /> Back
                      </button>
                      <button
                        type="button"
                        onClick={nextStep}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                      >
                        Next <ArrowRight size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 4 */}
                {step === 4 && (
                  <motion.div
                    key="step4"
                    variants={stepVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-6"
                  >
                    <h3 className="text-xl font-semibold">Review Information</h3>

                    <div className="flex items-center gap-3 bg-blue-50 text-blue-800 p-4 rounded-lg border">
                      <Shield size={24} />
                      <span>Your report is anonymous. Please confirm the details.</span>
                    </div>

                    <dl className="space-y-4 border rounded-lg p-4 bg-gray-50">
                      <InfoRow label="Type" value={selectedCategory?.name || "N/A"} />
                      <InfoRow
                        label="Date/Time"
                        value={
                          formData.incident_datetime
                            ? new Date(formData.incident_datetime).toLocaleString()
                            : "N/A"
                        }
                      />
                      <InfoRow label="Location" value={formData.location_text || "N/A"} />
                      <InfoRow label="Evidence files" value={`${files.length}`} />

                      <div>
                        <dt className="font-medium text-gray-600">Description</dt>
                        <dd className="p-3 bg-white rounded whitespace-pre-wrap">
                          {formData.description || "N/A"}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-auto pt-6 border-t flex justify-between">
                      <button
                        type="button"
                        onClick={prevStep}
                        className="px-5 py-2.5 rounded-lg flex items-center gap-2 border bg-white border-gray-300 hover:bg-gray-100"
                      >
                        <ArrowLeft size={16} /> Back
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg flex items-center gap-2"
                      >
                        <Shield size={16} /> Submit
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between gap-4">
    <dt className="font-medium text-gray-600 shrink-0">{label}</dt>
    <dd className="text-gray-900 text-right truncate">{value}</dd>
  </div>
);

const IconInput = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  icon,
  isReadOnly,
}) => (
  <div>
    {label && <label className="block mb-1 text-sm">{label}</label>}
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        {icon}
      </span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        readOnly={isReadOnly}
        placeholder={placeholder}
        className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 ${
          isReadOnly ? "bg-gray-100" : "bg-white"
        }`}
      />
    </div>
  </div>
);

const IconSelect = ({ label, name, value, onChange, icon, children }) => (
  <div>
    <label className="block mb-1 text-sm">{label}</label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        {icon}
      </span>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        {children}
      </select>
    </div>
  </div>
);

const IconTextarea = ({ label, name, value, onChange, placeholder, icon }) => (
  <div>
    <label className="block mb-1 text-sm">{label}</label>
    <div className="relative">
      <span className="absolute left-3 top-3 text-gray-400">{icon}</span>
      <textarea
        rows="5"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>
  </div>
);
