//Currently using Prettier for code formatting: https://prettier.io/docs/

import { useState, useEffect, useRef } from "react";
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

  const [botLoading, setBotLoading] = useState<boolean>(false);
  //follow this guide: https://blog.lancedb.com/create-llm-apps-using-rag/
  // const handleSendMessage = async () => {
  //   // const userMsg = chatMessage.trim();
  //   // if (!userMsg) return;
  //   // setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
  //   // setChatMessage("");
  //   // setBotLoading(true);
  //   // try {
  //   //   const res = await ai.models.generateContent({
  //   //     model: "gemini-2.0-flash",
  //   //     contents: userMsg,
  //   //   });
  //   //   console.log(res)
  //   //   console.log(res.text);
  //   //   setMessages((prev) => [...prev, { sender: "bot", text: res.text ?? "..."  }]);
  //   // } catch (error) {
  //   //   console.error("AI Error:", error);
  //   //   setMessages((prev) => [
  //   //     ...prev,
  //   //     { sender: "bot", text: "Something went wrong, please try again later." },
  //   //   ]);
  //   // }
  //   // finally {
  //   //   setBotLoading(false);
  //   // }
  // };

  const handleSendMessage = () => {
    const userMsg = chatMessage.trim();
    const fillerText =
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Doloremque assumenda, repellat quis itaque delectus nemo possimus, repellendus iure explicabo modi neque nostrum commodi placeat nisi, cupiditate distinctio aperiam. Quos repellat molestiae tempore? Saepe ea esse sit praesentium! At, quis hic!";

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

  //processes the data got from
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

  //for the info when clicking. It uses wikipedia.
  const [selectedStarId, setSelectedStarId] = useState<string | null>(null);
  const [showStarInfo, setShowStarInfo] = useState<boolean>(false);
  const [starInfo, setStarInfo] = useState<{
    title: string;
    description: string;
    extract: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    if (selectedStarId) {
      console.log("You clicked on star:", selectedStarId);
      searchStar(selectedStarId);
    }
  }, [selectedStarId]);
  const searchStar = async (starId: string) => {
    try {
      //wiki fetch.
      const wikiRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
          starId
        )}`
      );

      if (!wikiRes.ok) {
        throw new Error("Not found");
      }

      const wikiInfo = await wikiRes.json();

      setStarInfo({
        title: wikiInfo.title,
        description: wikiInfo.description,
        extract: wikiInfo.extract,
        url: wikiInfo.content_urls.desktop.page,
      });
    } catch (err) {
      console.error("Wiki Summary Error:", err);
      setStarInfo({
        title: starId,
        description: "",
        extract: `No Wikipedia summary available for ${starId}. Try pressing 'Find out more' to take you to a google search.`,
        url: `https://www.google.com/search?q=${encodeURIComponent(starId)}`,
      });
    } finally {
      setShowStarInfo(true);
      setIsOpen(false);
      setShowCalendar(false);
    }
  };

  //initial dialogue.
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const initialDialog = localStorage.getItem("initialDialog");
    if (!initialDialog) {
      dialogRef.current?.showModal();
    }
  }, []);
  const closeDialog = () => {
    dialogRef.current?.close();
    localStorage.setItem("initialDialog", "true");
  };
  function rateConditions(data: any, sunCalc: any, time: Date): string {
    //daytime
    if (sunCalc.sunrise && sunCalc.sunset) {
      if (time > sunCalc.sunrise && time < sunCalc.sunset) {
        return "Daytime";
      }
    }
    const init = weatherData.init;
    const year = parseInt(init.slice(0, 4));
    const month = parseInt(init.slice(4, 6)) - 1;
    const day = parseInt(init.slice(6, 8));
    const hour = parseInt(init.slice(8, 10));
    const initDate = new Date(year, month, day, hour);

    let closest = null;
    let minDiff = Infinity;

    for (const entry of weatherData.dataseries) {
      const entryTime = new Date(
        initDate.getTime() + entry.timepoint * 60 * 60 * 1000
      );
      const diff = Math.abs(entryTime.getTime() - time.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closest = entry;
      }
    }

    if (!closest) return "No matching weather data";
    let score = 0;

    //cloud cover
    if (data.cloudcover <= 2) score += 2;
    else if (data.cloudcover <= 5) score += 1;
    else if (data.cloudcover <= 7) score += 0;
    else score -= 1;

    //seeing
    if (data.seeing >= 5) score += 2;
    else if (data.seeing >= 3) score += 1;
    else score += 0;

    //transparency
    if (data.transparency >= 5) score += 2;
    else if (data.transparency >= 3) score += 1;

    //precipitation
    if (data.prec_type && data.prec_type !== "none") {
      score -= 2;
    }

    //moon illumination
    const moonIllum = sunCalc?.moon?.fraction || 0;
    if (moonIllum > 0.9) score -= 1;
    else if (moonIllum > 0.6) score -= 0.5;

    if (score >= 6) return "Excellent";
    if (score >= 4) return "Good";
    if (score >= 2) return "Decent";
    if (score >= 0) return "Meh";
    return "Poor";
  }

  const [showCalendar, setShowCalendar] = useState(false);
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
          <dialog ref={dialogRef}>
            <h2>Welcome to Astrary!</h2>
            <p>
              Just a heads up, the star identifier used within the site is HIP
              (Hipparcos).
            </p>
            <form method="dialog">
              <button onClick={closeDialog} className="button-primary">
                OK
              </button>
            </form>
          </dialog>
          {activeScreen === "location" && (
            <div className="locationScreen">
              <button onClick={getLocation} className="locationBtn">
                {isLoading ? "Loading..." : "Use Current Location"}
              </button>
              <p>Or click the map to select your location:</p>
              <LocationPicker onLocationSelect={handleLocationSelect} />
            </div>
          )}

          {activeScreen === "nightSky" && (
            <main className="screen">
              <AnimatePresence>
                {showStarInfo && starInfo && (
                  <motion.div
                    className="starOverlay"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div className="starInfoHeader">
                      <h3 className="starInfoTitle">{starInfo.title}</h3>
                      <button
                        className="starInfoClose"
                        onClick={() => setShowStarInfo(false)}
                      >
                        ✖
                      </button>
                    </div>
                    <div className="starInfoBody">
                      <p>{starInfo.description}</p>
                      <p>{starInfo.extract}</p>
                      <a href={starInfo.url} target="_blank">
                        Find out more
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="locationInfo">
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
                <div className="overlay scoreDisplay">
                  <p className="scoreLabel">
                    Stargazing Score:{" "}
                    {weatherData && weatherData.dataseries?.length && sunCalc
                      ? rateConditions(weatherData, sunCalc, skyTime)
                      : "Calculating..."}
                  </p>
                  <button
                    className="btnLocationChange"
                    onClick={() => setActiveScreen("conditions")}
                  >
                    [Find out more]
                  </button>
                </div>
              </div>
              {!isOpen && !showStarInfo && !showCalendar && (
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
              )}

              {!isOpen && !showStarInfo && !showCalendar && (
                <button
                  className="calendarToggle overlay"
                  onClick={() => setShowCalendar(true)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M8 2v4" />
                    <path d="M16 2v4" />
                    <rect width="18" height="18" x="3" y="4" rx="2" />
                    <path d="M3 10h18" />
                    <path d="M8 14h.01" />
                    <path d="M12 14h.01" />
                    <path d="M16 14h.01" />
                    <path d="M8 18h.01" />
                    <path d="M12 18h.01" />
                    <path d="M16 18h.01" />
                  </svg>
                </button>
              )}

              <div className={`chatbot ${isOpen ? "open" : ""}`}>
                <div className="chatHeader">
                  <p className="chatbotHeader">AstraBot</p>
                  <button
                    className="buttonClose buttonChatbotClose"
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
                    {botLoading && (
                      <motion.div
                        className="message bot"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                      >
                        <span>Astrary is thinking...</span>
                      </motion.div>
                    )}
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
              {showCalendar && (
                <motion.div
                  className="eventsOverlay"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  <div className="starInfoHeader">
                    <h3 className="starInfoTitle">Upcoming Events</h3>
                    <button
                      className="starInfoClose"
                      onClick={() => setShowCalendar(false)}
                    >
                      ✖
                    </button>
                  </div>
                  {/* Currently only shows in London. I believe atm it's unnecassry work to do further. */}
                  <iframe
                    style={{
                      border: "none",
                      width: "100%",
                      height: "100%",
                      overflow: "hidden",
                    }}
                    src="https://in-the-sky.org/widgets/newscal.php?skin=1&locale=1&town=2643743"
                  />
                </motion.div>
              )}

              <div id="nightSky">
                {location && (
                  <div id="nightSky">
                    <NightSky
                      stars={starData}
                      time={skyTime}
                      lat={location.lat}
                      lng={location.lng}
                      onStarClick={(id) => setSelectedStarId(id)}
                    />
                  </div>
                )}
              </div>
              {!isOpen && !showStarInfo && !showCalendar && (
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
                    })}
                  </p>
                </div>
              )}
            </main>
          )}

          {activeScreen === "conditions" && (
            <div key="weatherScreen" className="screen">
              <div className="conditionsLayout">
                <div className="weatherPanel">
                  <button
                    className="locationBtn"
                    onClick={() => setActiveScreen("nightSky")}
                  >
                    Go back
                  </button>
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
                    <div
                      className="chartDiv"
                      style={{ width: "100%", marginTop: "1rem" }}
                    >
                      {weatherVisualisers.map(({ key, name, color, type }) => (
                        <div
                          key={key}
                          style={{
                            marginBottom: "2rem",
                            padding: "0.5rem 0",
                            borderBottom: "1px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          <h3 className="chartHeading">{name}</h3>
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
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

export default App;

//I am not a big fan of using multiple ternary lines as I find them to be unreadable
export const renderChartByType = (
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
