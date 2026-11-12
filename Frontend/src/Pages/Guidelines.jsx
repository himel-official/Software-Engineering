// src/Pages/Guidelines.jsx
import React, { useEffect, useState } from "react";
import { BookOpenText, RefreshCw, Lightbulb } from "lucide-react";
import api, { extractErrorMessage } from "../api/client";

export default function Guidelines() {
  const [guidelines, setGuidelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/guidelines/");
      setGuidelines(data.data || []);
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not load safety guidelines."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="w-full mt-20 min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <BookOpenText size={24} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Safety Guidelines
            </h1>
            <p className="text-gray-600 mt-1">
              Practical steps you can take to stay safe, prepared and able to
              report an incident effectively.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              type="button"
              onClick={load}
              className="flex items-center gap-1 text-sm font-semibold text-red-700 hover:text-red-900"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl border border-gray-200 p-7 animate-pulse"
              >
                <div className="h-6 w-56 bg-gray-200 rounded mb-3" />
                <div className="h-4 w-full bg-gray-100 rounded mb-2" />
                <div className="h-4 w-3/4 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : guidelines.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
            No safety guidelines have been published yet.
          </div>
        ) : (
          <div className="space-y-5">
            {guidelines.map((guideline) => (
              <article
                key={guideline.id}
                className="bg-white rounded-2xl border border-gray-200 p-7 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <Lightbulb size={18} className="text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-gray-900">
                      {guideline.title}
                    </h2>
                    <p className="mt-2 text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {guideline.content}
                    </p>
                    <p className="mt-3 text-xs text-gray-400">
                      Last updated{" "}
                      {new Date(guideline.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
