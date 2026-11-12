import React from "react";

export default function ProblemOfSilence() {
  return (
    <section className="py-24 bg-gray-50 border-t border-gray-200">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-indigo-600 text-center mb-4">
            The Problem of Silence
          </h2>
          <p className="mt-4 text-gray-500 max-w-2xl mx-auto">
            Women and girls face harassment in public spaces every single day. Most incidents go unreported due to fear, exhaustion, or normalization.
          </p>
        </div>

        {/* Content Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Awareness Card */}
          <Card
            title="Awareness"
            description="Most incidents go unreported because they feel invisible or fear judgment. Awareness is the first step to change."
            bgColor="bg-red-100"
            iconColor="text-red-600"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 12v.01M12 16v.01M12 20v.01" />
              </svg>
            }
          />

          {/* Reporting Card */}
          <Card
            title="Anonymous Reporting"
            description="Our platform allows users to report incidents in seconds without revealing their identity, empowering more people to speak up."
            bgColor="bg-pink-100"
            iconColor="text-pink-600"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M5 6h14l-1.5 12h-11L5 6z" />
              </svg>
            }
          />

          {/* Prevention Card */}
          <Card
            title="Preventive Action"
            description="Heatmaps and safety scores allow NGOs and police to identify hotspots and take action, preventing further incidents."
            bgColor="bg-indigo-100"
            iconColor="text-indigo-600"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        {/* Highlighted Quote */}
        <div className="mt-16 text-center max-w-3xl mx-auto">
          <blockquote className="text-4xl font-bold text-indigo-600 text-center mb-4">
            “The problem isn’t just the harassment — it’s the lack of visibility.”
          </blockquote>
        </div>
      </div>
    </section>
  );
}

// Reusable Card Component
function Card({ title, description, icon, bgColor, iconColor }) {
  return (
    <div className="bg-white shadow-xl rounded-2xl p-6 flex flex-col justify-between hover:scale-[1.02] transition-transform">
      <div className="mb-4">
        <div className={`w-12 h-12 flex items-center justify-center ${bgColor} rounded-full mb-4`}>
          <div className={iconColor}>{icon}</div>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
      </div>
    </div>
  );
}
