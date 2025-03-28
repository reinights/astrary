import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";
import LocationPicker from "./LocationPicker";
import NightSky from "./NightSky";
import { supabase } from "./api/supabase";
import Papa from "papaparse";

interface Coordinates {
  lat: number;
  lng: number;
}

function App() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [cityName, setCityName] = useState<string | null>(null);
  const [countryName, setCountryName] = useState<string | null>(null);
  const [starData, setStarData] = useState<any[]>([]);
  const [skyTime, setSkyTime] = useState<Date>(new Date());

  useEffect(() => {
    const fetchCityInfo = async () => {
      if (location) {
        //get nearest city is a custom function in supabase that returns the city details based on lat and lons (not 100% accurate, mostly an estimation).
        const { data, error } = await supabase.rpc("get_nearest_city", {
          lat_input: location.lat,
          lng_input: location.lng,
        });
  
        if (error) {
          console.error("Error fetching city:", error);
          setCityName(null);
          setCountryName(null);
        } else if (data && data.length > 0) {
          setCityName(data[0].city);
          setCountryName(data[0].country);
        }
      }
    };
    
    //trimmed hipporacus is 5.2 mb with 100000 items, should be better than using an public database.
    const fetchStars = async () => {
      const res = await fetch("/stars.csv");
      const csvText = await res.text();
      const { data } = Papa.parse(csvText, { header: true, dynamicTyping: true });
    
      const filtered = data.filter((star: any) => {
        return (
          star.mag <= 6.5
        );
      });
    
      setStarData(filtered);
    };
  
    fetchCityInfo();
    fetchStars();
  }, [location]);
  
  useEffect(() => {
    const fetchCityInfo = async () => {
      if (!location) return;
  
      const { data: cityData, error: cityError } = await supabase.rpc("get_nearest_city", {
        lat_input: location.lat,
        lng_input: location.lng,
      });
  
      if (cityError) {
        console.error("Error fetching city:", cityError);
        setCityName(null);
        setCountryName(null);
      } else if (cityData && cityData.length > 0) {
        setCityName(cityData[0].city);
        setCountryName(cityData[0].country);
      }
  

    };
  
    fetchCityInfo();
  }, [location]);
  

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
            <div className="locationDisplay overlay">
            <h2>
              {cityName}, {countryName}
            </h2>

              <button onClick={() => setLocation(null)}>Change Location</button>
            </div>

            <button className="chatToggle overlay" onClick={() => setIsOpen(true)}>
              ☰
            </button>

            <div className={`chatbot ${isOpen ? "open" : ""}`}>
              <div className="chatHeader">
                Chatbot Header
                <button className="buttonClose" onClick={() => setIsOpen(false)}>✖</button>
              </div>
              <div className="chatBody">Chatbot Messages & Input</div>
            </div>

            <div id="nightSky">
              <NightSky stars={starData}/>            
            </div>

            <div className="overlay timeSlider">
              <input
                type="range"
                min={0}
                max={23}
                step={1}
                value={skyTime.getUTCHours()}
                onChange={(e) => {
                  const hour = parseInt(e.target.value);
                  const today = new Date();
                  const newTime = new Date(Date.UTC(
                    today.getUTCFullYear(),
                    today.getUTCMonth(),
                    today.getUTCDate(),
                    hour,
                    0,
                    0,
                    0
                  ));
                  setSkyTime(newTime);
                }}
              />
              <p>{skyTime.toUTCString()}</p>
            </div>
          </motion.main>
        )}
      </AnimatePresence>
    </>
  );
}

export default App;
