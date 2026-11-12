import React from "react";
import Hero from "../components/Hero";
import MapView from "../components/MapView";
import HowItWorks from "../components/HowItWorks";
import ProblemOfSilence from "../components/ProblemOfSilence";

const HomePage = () => {
  return (
    <div className="bg-white text-indigo-600">
      <Hero />

      <MapView />

      <HowItWorks></HowItWorks>
      <ProblemOfSilence></ProblemOfSilence>
    </div>
  );
};

export default HomePage;
