import React from "react";
import { Megaphone } from "lucide-react";

const Hero = () => {
  return (
    <section
      className="relative w-full h-screen flex items-center overflow-hidden"
      style={{
        backgroundImage: "url('/hero-safety.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black/80 z-0"></div>

      {/* Hero Content */}
      <div className="relative z-10 w-full px-6 sm:px-10 md:px-16 lg:px-24 max-w-5xl flex flex-col justify-center h-full">
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-tight">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-pink-500 to-purple-500">
            Illuminate
          </span>{" "}
          the Unsafe.
        </h1>

        <h2 className="mt-3 sm:mt-4 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-snug">
          Reclaim Your Space.
        </h2>

        <p className="mt-5 sm:mt-6 text-base sm:text-lg md:text-xl text-gray-200 max-w-2xl">
          Anonymously report public harassment. View live safety heatmaps and
          navigate your city with confidence.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row gap-4">
          <a
            href="/report"
            className="inline-flex items-center bg-gradient-to-r from-red-500 to-pink-600 text-white font-bold px-6 sm:px-8 py-3 sm:py-4 rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-red-400/50"
          >
            <Megaphone size={20} className="mr-2" />
            Report an Incident
          </a>
          <a
            href="#how-it-works"
            className="inline-block px-6 sm:px-8 py-3 sm:py-4 rounded-2xl border border-gray-600 bg-gray-800/70 text-white font-semibold shadow hover:bg-gray-700/80 hover:scale-105 transition-all duration-300"
          >
            Learn How It Works
          </a>
        </div>
      </div>

      {/* Scroll-down indicator */}
      <div className="absolute bottom-5 sm:bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce">
        <span className="block w-3 h-3 sm:w-4 sm:h-4 border-b-2 border-r-2 border-white rotate-45 mb-1"></span>
        <span className="block w-3 h-3 sm:w-4 sm:h-4 border-b-2 border-r-2 border-white rotate-45"></span>
      </div>
    </section>
  );
};

export default Hero;
