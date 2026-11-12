// src/Pages/EmergencyContacts.jsx
import React, { useEffect, useState } from "react";
import { PhoneCall, ShieldAlert, RefreshCw } from "lucide-react";
import api, { extractErrorMessage } from "../api/client";

export default function EmergencyContacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/emergency-contacts/");
      setContacts(data.data || []);
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not load emergency contacts."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="w-full mt-20 min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <ShieldAlert size={24} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Emergency Contacts
            </h1>
            <p className="text-gray-600 mt-1">
              If you are in immediate danger, call the relevant service right
              away. These numbers are available to everyone, no sign-in needed.
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse"
              >
                <div className="h-5 w-32 bg-gray-200 rounded mb-3" />
                <div className="h-8 w-24 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
            No emergency contacts have been published yet.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-bold text-gray-900">
                    {contact.name}
                  </h2>
                  <PhoneCall size={18} className="text-red-500 shrink-0 mt-1" />
                </div>

                <a
                  href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                  className="block mt-3 text-3xl font-bold text-red-600 tracking-wide hover:underline"
                >
                  {contact.phone}
                </a>

                {contact.description && (
                  <p className="mt-3 text-sm text-gray-600">{contact.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
