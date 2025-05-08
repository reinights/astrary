//Currently using Prettier for code formatting: https://prettier.io/docs/

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";
import LocationPicker from "./LocationPicker";
import NightSky from "./NightSky";
import Papa from "papaparse";
import SunCalc from "suncalc";
interface Coordinates {
  lat: number;
  lng: number;
}
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
  BarChart,
} from "recharts";

type Screen = "location" | "nightSky" | "conditions";
import { GoogleGenAI } from "@google/genai";
const fillerText =
  "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Doloremque assumenda, repellat quis itaque delectus nemo possimus, repellendus iure explicabo modi neque nostrum commodi placeat nisi, cupiditate distinctio aperiam. Quos repellat molestiae tempore? Saepe ea esse sit praesentium! At, quis hic!";

const weatherVisualisers = [
  { key: "temp", name: "Temperature (°C)", color: "#ff7300", type: "line" },
  { key: "seeing", name: "Seeing", color: "#82ca9d", type: "area" },
  { key: "transparency", name: "Transparency", color: "#ffc658", type: "line" },
  { key: "cloudcover", name: "Cloud Cover", color: "#8884d8", type: "bar" },
];

function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>("location");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [cityName, setCityName] = useState<string | null>(null);
  const [countryName, setCountryName] = useState<string | null>(null);
  const [starData, setStarData] = useState<any[]>([]);
  const [skyTime, setSkyTime] = useState<Date>(new Date());
  const [messages, setMessages] = useState<
    { sender: "user" | "bot"; text: string }[]
  >([]);
  const [chatMessage, setChatMessage] = useState<string>("");
  const [weatherData, setWeatherData] = useState<any | null>(null);
  const [sunCalc, setSunCalc] = useState<any>(null);
  useEffect(() => {
    if (!location) {
      setActiveScreen("location");
      return;
    }

    const fetchCityInfo = async () => {
      if (!location) return;

      const response = await fetch("/cities_rows.csv");
      const csvText = await response.text();

      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
      });

      //the as is for typescript.
      const cities = parsed.data as {
        city: string;
        country: string;
        lat: number;
        lng: number;
      }[];

      console.log(cities);

      let nearest = null;

      //stores the current smallest distance, gets replaced if it finds a smaller one
      let minDistance = Infinity;

      for (const city of cities) {
        //essentially pythagoras, but we don't need to sqrt as we're only doing comparisons.
        const distance =
          Math.pow(city.lat - location.lat, 2) +
          Math.pow(city.lng - location.lng, 2);

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
      const { data } = Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
      });

      const filtered = data.filter((star: any) => {
        return star.mag <= 6.5;
      });

      setStarData(filtered);
    };

    const fetchWeather = async () => {
      if (!location) return;

      const res = await fetch(
        `https://www.7timer.info/bin/api.pl?lon=${location.lng}&lat=${location.lat}&product=astro&output=json`
      );
      const data = await res.json();

      //getting the sun and moon stuf from sun calc
      const sunTimes = SunCalc.getTimes(new Date(), location.lat, location.lng);
      const moon = SunCalc.getMoonIllumination(new Date());

      setSunCalc({ ...sunTimes, moon });
      setWeatherData(data);
    };

    setIsLoading(true);
    fetchCityInfo();
    fetchStars();
    fetchWeather();
    setIsLoading(false);
    setActiveScreen("nightSky");
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
    console.log(coords);
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

  function getMoonPhaseName(phase: number): string {
    if (phase < 0.03 || phase > 0.97) return "New Moon";
    if (phase < 0.22) return "Waxing Crescent";
    if (phase < 0.28) return "First Quarter";
    if (phase < 0.47) return "Waxing Gibbous";
    if (phase < 0.53) return "Full Moon";
    if (phase < 0.72) return "Waning Gibbous";
    if (phase < 0.78) return "Last Quarter";
    return "Waning Crescent";
  }

  const processWeatherData = (weatherData: any, init: string) => {
    const year = parseInt(init.slice(0, 4));
    const month = parseInt(init.slice(4, 6)) - 1; //js months are 0 based
    const day = parseInt(init.slice(6, 8));
    const hour = parseInt(init.slice(8, 10));

    const initDate = new Date(year, month, day, hour);

    return weatherData.dataseries
      .map((entry: any) => {
        const time = new Date(
          initDate.getTime() + entry.timepoint * 60 * 60 * 1000
        );

        return {
          time,
          cloudcover: entry.cloudcover,
          seeing: entry.seeing,
          transparency: entry.transparency,
          temp: entry.temp2m,
        };
      })
      .filter((entry: any) => {
        const delta = entry.time.getTime() - initDate.getTime();
        return delta <= 24 * 60 * 60 * 1000; // only next 24 hours
      });
  };

  //I am not a big fan of using multiple ternary lines as I find them to be unreadable
  const renderChartByType = (
    type: string,
    key: string,
    name: string,
    color: string,
    data: any[]
  ): any => {
    switch (type) {
      case "line":
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickFormatter={(time) =>
                new Date(time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }
            />
            <YAxis domain={["dataMin - 1", "dataMax + 1"]} />
            <Tooltip />
            <Line type="monotone" dataKey={key} stroke={color} name={name} />
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickFormatter={(time) =>
                new Date(time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }
            />
            <YAxis domain={["dataMin - 1", "dataMax + 1"]} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey={key}
              stroke={color}
              fill={color}
              fillOpacity={0.3}
              name={name}
            />
          </AreaChart>
        );
      case "bar":
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickFormatter={(time) =>
                new Date(time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }
            />
            <YAxis domain={["dataMin - 1", "dataMax + 1"]} />
            <Tooltip />
            <Bar dataKey={key} fill={color} name={name} />
          </BarChart>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeScreen}
          className="screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          {activeScreen === "location" && (
            <div className="locationScreen">
              <h2>Choose a Location to Begin</h2>
              <button onClick={getLocation} className="locationBtn">
                {isLoading ? "Loading..." : "Use Current Location"}
              </button>
              <p>Or click the map to select your location:</p>
              <LocationPicker onLocationSelect={handleLocationSelect} />
            </div>
          )}

          {activeScreen === "nightSky" && (
            <main className="screen">
              <div className="locationDisplay overlay">
                <h2 className="headerLocation">
                  {cityName}, {countryName}
                </h2>

                <button
                  className="btnLocationChange"
                  onClick={() => setActiveScreen("location")}
                >
                  [Change]
                </button>
              </div>

              <button
                className="chatToggle overlay"
                onClick={() => setIsOpen(true)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 -960 960 960"
                  fill="var(--text)"
                >
                  <path d="M240-400h320v-80H240zm0-120h480v-80H240zm0-120h480v-80H240zM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240zm126-240h594v-480H160v525zm-46 0v-480z" />
                </svg>
              </button>

              <div className={`chatbot ${isOpen ? "open" : ""}`}>
                <div className="chatHeader">
                  Chatbot Header
                  <button
                    className="buttonClose"
                    onClick={() => setIsOpen(false)}
                  >
                    ✖
                  </button>
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
              <button
                style={{ right: "90px" }}
                className="chatToggle overlay"
                onClick={() => setActiveScreen("conditions")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  className="bi bi-clouds"
                  viewBox="0 0 16 16"
                >
                  <path d="M16 7.5a2.5 2.5 0 0 1-1.456 2.272 3.5 3.5 0 0 0-.65-.824 1.5 1.5 0 0 0-.789-2.896.5.5 0 0 1-.627-.421 3 3 0 0 0-5.22-1.625 5.6 5.6 0 0 0-1.276.088 4.002 4.002 0 0 1 7.392.91A2.5 2.5 0 0 1 16 7.5" />
                  <path d="M7 5a4.5 4.5 0 0 1 4.473 4h.027a2.5 2.5 0 0 1 0 5H3a3 3 0 0 1-.247-5.99A4.5 4.5 0 0 1 7 5m3.5 4.5a3.5 3.5 0 0 0-6.89-.873.5.5 0 0 1-.51.375A2 2 0 1 0 3 13h8.5a1.5 1.5 0 1 0-.376-2.953.5.5 0 0 1-.624-.492z" />
                </svg>
              </button>
              <div id="nightSky">
                {location && (
                  <div id="nightSky">
                    <NightSky
                      stars={starData}
                      time={skyTime}
                      lat={location.lat}
                      lng={location.lng}
                    />
                  </div>
                )}
              </div>

              <div className="overlay timeSlider">
                <input
                  type="range"
                  min={0}
                  max={1439}
                  step={1}
                  value={skyTime.getHours() * 60 + skyTime.getMinutes()}
                  onChange={(e) => {
                    const totalMinutes = parseInt(e.target.value, 10);
                    const hour = Math.floor(totalMinutes / 60);
                    const minute = totalMinutes % 60;

                    const base = new Date(skyTime);
                    base.setHours(hour, minute, 0, 0);

                    setSkyTime(new Date(base));
                  }}
                />
                <p>
                  {skyTime.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  — {skyTime.toISOString()}
                </p>
              </div>
            </main>
          )}

          {activeScreen === "conditions" && (
            <div key="weatherScreen" className="screen">
              <div className="conditionsLayout">
                <div className="weatherPanel">
                  <h2>
                    Astronomical Conditions for {cityName}, {countryName}
                  </h2>
                  <div className="moonSunPanel">
                    {sunCalc ? (
                      <div>
                        <div>
                          <strong>Sunrise:</strong>{" "}
                          {sunCalc.sunrise.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div>
                          <strong>Sunset:</strong>{" "}
                          {sunCalc.sunset.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div>
                          <strong>Solar Noon:</strong>{" "}
                          {sunCalc.solarNoon.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div>
                          <strong>Dawn:</strong>{" "}
                          {sunCalc.dawn.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div>
                          <strong>Dusk:</strong>{" "}
                          {sunCalc.dusk.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div>
                          <strong>Moon Illumination:</strong>{" "}
                          {(sunCalc.moon.fraction * 100).toFixed(1)}%
                        </div>
                        <div>
                          <strong>Moon Phase:</strong>{" "}
                          {getMoonPhaseName(sunCalc.moon.phase)}
                        </div>
                      </div>
                    ) : (
                      <div>Loading sun, moon, and sky data...</div>
                    )}
                  </div>
                  {weatherData && (
                    <div style={{ width: "100%", marginTop: "1rem" }}>
                      {weatherVisualisers.map(({ key, name, color, type }) => (
                        <div
                          key={key}
                          style={{
                            marginBottom: "2rem",
                            padding: "0.5rem 0",
                            borderBottom: "1px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          <h3
                            style={{
                              fontSize: "1.2rem",
                              marginBottom: "0.5rem",
                            }}
                          >
                            {name}
                          </h3>
                          <div style={{ width: "100%", height: 120 }}>
                            <ResponsiveContainer>
                              {renderChartByType(
                                type,
                                key,
                                name,
                                color,
                                processWeatherData(
                                  weatherData,
                                  weatherData.init
                                )
                              )}
                            </ResponsiveContainer>
                          </div>
                          <p
                            style={{
                              fontSize: "0.85rem",
                              opacity: 0.7,
                            }}
                          >
                            {/* Possibly where the AI could go */}
                            {key === "temp" &&
                              "Temperatures peaked in the afternoon and fell at night."}
                            {key === "seeing" &&
                              "Seeing conditions best around midnight."}
                            {key === "transparency" &&
                              "Transparency remained stable."}
                            {key === "cloudcover" &&
                              "Clouds were light after midnight."}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="eventsPanel">
                  <h3>Upcoming Events</h3>
                  {/* Currently only shows in London. I believe atm it's unnecassry work to do further. */}
                  <iframe
                    style={{
                      border: "none",
                      width: "100%",
                      height: "759px",
                      overflow: "hidden",
                    }}
                    src="https://in-the-sky.org/widgets/newscal.php?skin=1&locale=1&town=2643743"
                  />
                </div>
              </div>

              <button
                className="chatToggle overlay"
                onClick={() => setIsOpen(true)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 -960 960 960"
                  fill="var(--text)"
                >
                  <path d="M240-400h320v-80H240zm0-120h480v-80H240zm0-120h480v-80H240zM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240zm126-240h594v-480H160v525zm-46 0v-480z" />
                </svg>
              </button>

              <div className={`chatbot ${isOpen ? "open" : ""}`}>
                <div className="chatHeader">
                  Chatbot Header
                  <button
                    className="buttonClose"
                    onClick={() => setIsOpen(false)}
                  >
                    ✖
                  </button>
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
              <button
                style={{ right: "90px" }}
                className="chatToggle overlay"
                onClick={() => setActiveScreen("nightSky")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  className="bi bi-clouds"
                  viewBox="0 0 16 16"
                >
                  <path d="M16 7.5a2.5 2.5 0 0 1-1.456 2.272 3.5 3.5 0 0 0-.65-.824 1.5 1.5 0 0 0-.789-2.896.5.5 0 0 1-.627-.421 3 3 0 0 0-5.22-1.625 5.6 5.6 0 0 0-1.276.088 4.002 4.002 0 0 1 7.392.91A2.5 2.5 0 0 1 16 7.5" />
                  <path d="M7 5a4.5 4.5 0 0 1 4.473 4h.027a2.5 2.5 0 0 1 0 5H3a3 3 0 0 1-.247-5.99A4.5 4.5 0 0 1 7 5m3.5 4.5a3.5 3.5 0 0 0-6.89-.873.5.5 0 0 1-.51.375A2 2 0 1 0 3 13h8.5a1.5 1.5 0 1 0-.376-2.953.5.5 0 0 1-.624-.492z" />
                </svg>
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

export default App;
