import React from "react";
import { Megaphone, MapPin, Shield } from "lucide-react";

const FeatureCard = ({ step, icon, title, description }) => (
  <div className="relative bg-white p-8 rounded-xl shadow-xl border text-gray-900 border-gray-200 transform transition-transform hover:scale-105">
    

    <div className="absolute top-4 right-6 text-8xl font-bold text-gray-100 -z-0">
      {step}
    </div>
    

    <div className="relative z-10">
      <div className="mb-4 text-white bg-gradient-to-r from-red-500 to-pink-500 w-16 h-16 rounded-full flex items-center justify-center shadow-lg">
        {icon}
      </div>
      <h3 className="text-2xl font-bold mb-3">{title}</h3>
      <p className="text-gray-500">{description}</p>
    </div>
  </div>
);


const HowItWorks = () => {
  return (
    <section
      id="how-it-works"
      className="py-24 bg-gray-50 border-t border-b border-gray-200"
    >
      <div className="container mx-auto px-4">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold bg-clip-text text-indigo-600 ">
            A Simple Path to a Safer Community
          </h2>
          <p className="text-gray-600 mt-4 max-w-2xl mx-auto">
            Your voice is powerful. Here’s how you can make an immediate impact
            in just three simple steps.
          </p>
        </div>

   
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <FeatureCard
            step="01"
            icon={<Megaphone size={32} />}
            title="Speak Up, Anonymously"
            description="Report an incident in seconds. No names, no logins. Your voice is powerful and 100% private."
          />
          
          <FeatureCard
            step="02"
            icon={<MapPin size={32} />}
            title="Mark the Map, Instantly"
            description="Your report immediately adds to the live heatmap, alerting others to high-risk areas in real-time."
          />
          
          <FeatureCard
            step="03"
            icon={<Shield size={32} />}
            title="Build a Safer Community"
            description="See safety scores and patterns to plan safer routes. Together, we make these spaces visible and drive real change."
          />

        </div>
      </div>
    </section>
  );
};

export default HowItWorks;