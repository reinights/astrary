import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";
import LocationPicker from "./LocationPicker";

interface Coordinates {
  lat: number;
  lng: number;
}

function App() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const storedLocation = localStorage.getItem("userLocation");
    if (storedLocation) {
      setLocation(JSON.parse(storedLocation) as Coordinates);
    }
  }, []);

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: Coordinates = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          localStorage.setItem("userLocation", JSON.stringify(coords));
          setIsLoading(true); //Mainly for testing, will change with three.js loading.
          setTimeout(() => {
            setLocation(coords);
            setIsLoading(false);
          }, 500);
        },
        () => {
          alert("Could not get location. Please use the map.");
        }
      );
    } else {
      alert("Geolocation is not supported in this browser.");
    }
  };

  const handleLocationSelect = (coords: Coordinates) => {
    localStorage.setItem("userLocation", JSON.stringify(coords));
    setIsLoading(true); //Mainly for testing, will change with three.js loading.
    setTimeout(() => {
      setLocation(coords);
      setIsLoading(false);
    }, 500);
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {!location && (
          <motion.div
            key="locationScreen"
            className="locationScreen"
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <button onClick={getLocation} className="locationBtn">
              {isLoading ? "Loading..." : "Use My Current Location"}
            </button>
            <p>Or move the map to select your location:</p>
            <LocationPicker onLocationSelect={handleLocationSelect} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {location && (
          <motion.main
            key="mainScreen"
            className="screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="locationDisplay">
              <h2>
                Saved Location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </h2>
              <button onClick={() => setLocation(null)}>Change Location</button>
            </div>

            <button className="chatToggle" onClick={() => setIsOpen(true)}>
              ☰
            </button>

            <div className={`chatbot ${isOpen ? "open" : ""}`}>
              <div className="chatHeader">
                Chatbot Header
                <button className="buttonClose" onClick={() => setIsOpen(false)}>✖</button>
              </div>
              <div className="chatBody">Chatbot Messages & Input</div>
            </div>

            {isOpen && <div className="overlay" onClick={() => setIsOpen(false)}></div>}

            <div className="mode">Modes</div>
          </motion.main>
        )}
      </AnimatePresence>
    </>
  );
}

export default App;
