import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";
import LocationPicker from "./LocationPicker";
import NightSky from "./NightSky";
import Papa from "papaparse";

interface Coordinates {
  lat: number;
  lng: number;
}

const fillerText = "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Doloremque assumenda, repellat quis itaque delectus nemo possimus, repellendus iure explicabo modi neque nostrum commodi placeat nisi, cupiditate distinctio aperiam. Quos repellat molestiae tempore? Saepe ea esse sit praesentium! At, quis hic!"

function App() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [cityName, setCityName] = useState<string | null>(null);
  const [countryName, setCountryName] = useState<string | null>(null);
  const [starData, setStarData] = useState<any[]>([]);
  const [skyTime, setSkyTime] = useState<Date>(new Date());
  const [messages, setMessages] = useState<{ sender: "user" | "bot"; text: string }[]>([]);
  const [chatMessage, setChatMessage] = useState<string>("");

  useEffect(() => {
    const fetchCityInfo = async () => {
      if (!location) return;
        
      const response = await fetch("/cities_rows.csv");
      const csvText = await response.text();
    
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
      });
    
      const cities = parsed.data as {
        city: string;
        country: string;
        lat: number;
        lng: number;
      }[];

      console.log(cities)
    
      let nearest = null;

      //stores the current smallest distance, gets replaced if it finds a smaller one
      let minDistance = Infinity;
    
      for (const city of cities) {
        //essentially pythagoras, but we don't need to sqrt as we're only doing comparisons.
        const distance = Math.pow(city.lat - location.lat, 2) + Math.pow(city.lng - location.lng, 2);
    
        if (distance < minDistance) {
          minDistance = distance;
          nearest = city;
        }
      }
    
      if (nearest) {
        setCityName(nearest.city);
        setCountryName(nearest.country);
      } else {
        setCityName(null);
        setCountryName(null);
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
  
    setIsLoading(true)
    fetchCityInfo();
    fetchStars();
    setIsLoading(false)
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
          setLocation(coords);
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
    setLocation(coords);
  };

  const handleSendMessage = () => {
    const userMsg = chatMessage.trim();
  
    // stores the user message
    setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setChatMessage("");
  
    // Simulate bot response with lorem text
    setTimeout(() => {
      const fillerWords = fillerText.split(" ");

      //randomises the length of the bot for simulation purposes
      const randomLength = Math.floor(Math.random() * 20) + 5;
      const botMsg = fillerWords.slice(0, randomLength).join(" ");
  
      setMessages((prev) => [...prev, { sender: "bot", text: botMsg }]);
    }, 500); // lil delay for realism
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
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960" fill="var(--text)"><path d="M240-400h320v-80H240zm0-120h480v-80H240zm0-120h480v-80H240zM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240zm126-240h594v-480H160v525zm-46 0v-480z"/></svg>
            </button>

            <div className={`chatbot ${isOpen ? "open" : ""}`}>
              <div className="chatHeader">
                Chatbot Header
                <button className="buttonClose" onClick={() => setIsOpen(false)}>✖</button>
              </div>
              <div className="chatBody">
                <div className="chatContent">
                  {messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.sender}`}>
                      {msg.text}
                    </div>
                  ))}
                </div>
                <div className="chatInput">
                  <input 
                    type="text" 
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && chatMessage.trim()) {
                        handleSendMessage();
                      }
                    }}
                  />
                  </div>

              </div>
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
