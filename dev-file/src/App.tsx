//Currently using Prettier for code formatting: https://prettier.io/docs/

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";
import LocationPicker from "./LocationPicker";
import NightSky from "./NightSky";
import Papa from "papaparse";
import SunCalc from "suncalc";
import ReactMarkdown from "react-markdown";
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
  Area,
  AreaChart,
  BarChart,
} from "recharts";

import { GoogleGenAI } from "@google/genai";
type Screen = "location" | "nightSky" | "conditions";
type ChatButton = {
  label: string;
  target: string;
};

type Message = {
  sender: "user" | "bot";
  text: string;
  buttons?: ChatButton[];
};

//recharts values.
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
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hey there! My name is AstraBot and I can answer your stargazing questions! Remember, I am a chatbot and might make mistakes!",
    },
  ]);
  const [chatMessage, setChatMessage] = useState<string>("");
  const [weatherData, setWeatherData] = useState<any | null>(null);
  const [sunCalc, setSunCalc] = useState<any>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [focusedStarId, setFocusedStarId] = useState<string | null>(null);
  const [weatherSummary, setWeatherSummary] = useState<string | null>(null);

  //checks the browser cookies for the location
  useEffect(() => {
    const storedLocation = localStorage.getItem("userLocation");

    if (!storedLocation) {
      setActiveScreen("location");
      return;
    }

    setLocation(JSON.parse(storedLocation));
  }, []);

  /*---------------------------------    Value Initialisations    -------------------------------------*/

  //fetches the stars, location name, and the weather forecast.
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
      const moon = SunCalc.getMoonIllumination(new Date());
      const maxMag = 5.5 - 2 * moon.fraction;

      const filtered = data.filter((star: any) => {
        return star.mag <= maxMag;
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

  //browser geolocation API
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

  /*---------------------------------    Chatbot   -------------------------------------*/

  const [botLoading, setBotLoading] = useState<boolean>(false);
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API });
  const handleSendMessage = async () => {
    const userMsg = chatMessage.trim();
    if (!userMsg) return;
    setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setChatMessage("");
    setBotLoading(true);
    //takes the past 6 messages (user, and the bot) and formats it as such:
    //User: Yo. Hook me up?
    //Bot: Sure boss. Here's the stars.
    const contextString = messages
      .slice(-6)
      .map((m) => `${m.sender === "user" ? "User" : "Bot"}: ${m.text}`)
      .join("\n");

    //Makes the context for weather readable for context.
    const formattedForecast = formatWeatherForecast(weatherData);

    try {
      const prompt = `
You're an astronomy chatbot named AstraBot for a night sky app using Three.js.

Any time you mention specific stars in your response, you must also return them as interactive buttons.
This button will be used so that the camera will focus on the star.
If you mention any stars, describe why briefly.
Match the tone of the user.

Respond in strict JSON (markdown) with the back ticks using this format, and for the target. STRICTLY USE HIP IDENTIFIER.:

{
  "needs_buttons": true,
  "description": "Your response here using **bold** and *italics* and bullet points",
  "buttons": [
    {
      "label": "Sirius",
      "target": "HIP 32349"
    }
  ]
}

If no stars are mentioned, just respond with:

{
  "needs_buttons": false,
  "description": "Your response with markdown formatting"
}

Location: ${cityName}, ${countryName} 
Date: ${new Date()}
Style: Short, casual, friendly. Use markdown formatting like **bold**, *italics*, and bullet points (- item).
Context so far: 
${contextString}


Weather Conditions from 7timer: ${formattedForecast}
Times Data: ${sunCalc}
Always keep both of these data in mind.

Dismiss unrelated to astronomy questions.

User Question: ${userMsg}
`;

      const res = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });

      const responseText = res.text ?? "{}"; //fallback

      // When sending that response, gemini reacts with using ```json [contents]```.
      // It's ok for markdown, but I cannot parse the buttons, so we need to get rid of it.
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith("```json")) {
        //:DDDD I love regex! :DD
        cleanedResponse = cleanedResponse
          .replace(/^```json\s*/, "") //replaces the starting line with empty (deleting it)
          .replace(/\s*```$/, ""); //replaces the ending line with empty
      } else if (cleanedResponse.startsWith("```")) {
        cleanedResponse = cleanedResponse
          .replace(/^```\s*/, "")
          .replace(/\s*```$/, "");
      }

      let parsed;
      //this block checks if the parsing is valid
      try {
        //I'm practically betting that the bot will actually pump out decent responses :sob:
        parsed = JSON.parse(cleanedResponse);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: responseText,
          },
        ]);
        return;
      }

      if (parsed.needs_buttons) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: parsed.description,
            buttons: parsed.buttons,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: parsed.description ?? "...",
          },
        ]);
      }
    } catch (error) {
      console.error("AI Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Something went wrong, please try again later.",
        },
      ]);
    } finally {
      setBotLoading(false);
    }
  };

  function formatWeatherForecast(weather: any): string {
    //how 7timer forecasts works, is there's a init value which is something like "2025053106"
    //And each timepoint is every three hours. ;(

    const init = weather.init;
    const year = parseInt(init.slice(0, 4), 10);
    const month = parseInt(init.slice(4, 6), 10) - 1; //js months are 0 based
    const day = parseInt(init.slice(6, 8), 10);
    const hour = parseInt(init.slice(8, 10), 10);
    const initDate = new Date(Date.UTC(year, month, day, hour));

    return weather.dataseries
      .slice(0, 15)
      .map((entry: any) => {
        const forecastDate = new Date(
          initDate.getTime() + entry.timepoint * 60 * 60 * 1000
        );

        //surely this will work :thumbs_up:
        const forecastTimeStr =
          forecastDate.toISOString().replace("T", " ").slice(0, 16) + " UTC";

        return `Forecast at (${forecastTimeStr}):
- Cloud Cover: ${entry.cloudcover} (1–9)
- Seeing: ${entry.seeing} (1–8)
- Transparency: ${entry.transparency} (1–8)
- Lifted Index: ${entry.lifted_index}
- 2m Temperature: ${entry.temp2m}°C
- 2m Relative Humidity: ${entry.rh2m}
- Precipitation Type: ${entry.prec_type ?? "none"}
`;
      })
      .join("\n");
  }

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

  //processes the data got from 7timer
  const processWeatherData = (weatherData: any, init: string) => {
    const year = parseInt(init.slice(0, 4));
    const month = parseInt(init.slice(4, 6)) - 1; //js months are 0 based
    const day = parseInt(init.slice(6, 8));
    const hour = parseInt(init.slice(8, 10));

    const initDate = new Date(Date.UTC(year, month, day, hour));

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
  /*---------------------------------    Star Information Panel   -------------------------------------*/

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
        extract: `We couldn't find a Wikipedia summary for ${starId}. Try pressing 'Find out more' to take you to a google search.`,
        url: `https://www.google.com/search?q=${encodeURIComponent(starId)}`,
      });
    } finally {
      setShowStarInfo(true);
      setIsOpen(false);
      setShowCalendar(false);
      setSelectedStarId(null);
    }
  };

  /*---------------------------------    Initial Dialog   -------------------------------------*/

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

  /*---------------------------------    Scoring The Weather   -------------------------------------*/

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

    //finding out the time from the weather forecast.
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


    //These are mostly opionionated and probably is wrong 90% of the time :D
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

  /*---------------------------------    Generating the Weather Summary   -------------------------------------*/

  const getWeatherSummary = async (weather: any) => {
    const formattedForecast = formatWeatherForecast(weather);

    const prompt = `
You're summarising a weather data for stargazing to a beginner. 
On the starting sentence, just say 'Here is the summary for ${cityName}, ${countryName}'

Ignore forecasts before user time: ${new Date()}
Forecast:
${formattedForecast}

Extra Data:
Sunrise: ${sunCalc.sunrise.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}  
Sunset: ${sunCalc.sunset.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}  
Moon Illumination: ${(sunCalc.moon.fraction * 100).toFixed(1)}%  
Moon Phase: ${getMoonPhaseName(sunCalc.moon.phase)}


Keep a friendly tone.
At the end, give the user a clear time period where stargazing is optimal.
Translate UTC to the user timezone.
With this format: **Best Stargazing Time:**
`;

    const res = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return res.text ?? null;
  };

  //waits until the data is prepared for the summary data :D
  useEffect(() => {
    if (weatherData && cityName && countryName) {
      (async () => {
        const summary = await getWeatherSummary(weatherData);
        setWeatherSummary(summary);
      })();
    }
  }, [weatherData, cityName, countryName]);

  return (
    <>
      {/*---------------------------------   Wrapped for the transitions   -------------------------------------*/}
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

          {/*---------------------------------   Location Screen   -------------------------------------*/}

          {activeScreen === "location" && (
            <div className="locationScreen">
              <button onClick={getLocation} className="locationBtn">
                {isLoading ? "Loading..." : "Use Current Location"}
              </button>
              <p>Or click the map to select your location:</p>
              <LocationPicker onLocationSelect={handleLocationSelect} />
            </div>
          )}

          {/*---------------------------------   Night Sky Screen   -------------------------------------*/}

          {activeScreen === "nightSky" && (
            <main className="screen">

              {/*---------------------------------   Information Panel  -------------------------------------*/}

              <AnimatePresence>
                {showStarInfo && starInfo && (
                  <motion.div
                    className="starOverlay"
                    style={{ left: "50%" }}
                    animate={{ opacity: 1, y: 0, x: "-50%" }}
                    initial={{ opacity: 0, y: 20, x: "-50%" }}
                    exit={{ opacity: 0, y: 20, x: "-50%" }}
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

              {/*---------------------------------   Stargazing Score and Location Toggles  -------------------------------------*/}

              <div className="locationInfo">
                <div className="overlay">
                  <p className="headerLocation locationInfoHeaders">
                    {cityName}, {countryName}
                  </p>
                  <button
                    className="buttonScreenChange"
                    onClick={() => setActiveScreen("location")}
                  >
                    [Change]
                  </button>
                </div>
                <div style={{ textAlign: "right" }} className="overlay">
                  <p className="scoreLabel locationInfoHeaders">
                    Stargazing Score:{" "}
                    {weatherData && weatherData.dataseries?.length && sunCalc
                      ? rateConditions(weatherData, sunCalc, skyTime)
                      : "Calculating..."}
                  </p>
                  <button
                    className="buttonScreenChange"
                    onClick={() => {
                      setActiveScreen("conditions");
                    }}
                    disabled={!weatherSummary}
                  >
                    [Find out more]
                  </button>
                </div>
              </div>

              <div className="bottomRow">
                {/*---------------------------------   Chatbot Toggle Button  -------------------------------------*/}

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

                {/*---------------------------------   Time Slider  -------------------------------------*/}

                {!isOpen && !showStarInfo && !showCalendar && (
                  <div className="overlay wrapperTimeSlider">
                    <p>
                      {skyTime.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <div className="timeSliderBorder">
                      <input
                        className="timeSlider"
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
                    </div>
                  </div>
                )}

                {/*---------------------------------   Events Toggle Button   -------------------------------------*/}

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
              </div>

              {/*---------------------------------   Chatbot Panel   -------------------------------------*/}

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
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                        {msg.buttons && msg.buttons.length > 0 && (
                          <div className="message-buttons">
                            {msg.buttons.map((button, buttonIndex) => (
                              <button
                                key={buttonIndex}
                                className="button-primary"
                                onClick={() => {
                                  setSelectedStarId(button.target);
                                  setFocusedStarId(button.target);
                                  setIsOpen(false);
                                }}
                              >
                                {button.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {botLoading && (
                      <motion.div
                        className="message bot"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                      >
                        <span>AstraBot is thinking...</span>
                      </motion.div>
                    )}
                  </div>

                  {!botLoading && (
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
                  )}
                </div>
              </div>

              {/*---------------------------------   Events Calendar Panel  -------------------------------------*/}

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

              {/*---------------------------------   Star Field   -------------------------------------*/}

              <div id="nightSky">
                {location && (
                  <div id="nightSky">
                    <NightSky
                      stars={starData}
                      time={skyTime}
                      lat={location.lat}
                      lng={location.lng}
                      onStarClick={(id) => setSelectedStarId(id)}
                      focusedStarId={focusedStarId}
                      setFocusedStarId={setFocusedStarId}
                    />
                  </div>
                )}
              </div>
            </main>
          )}

          {/*---------------------------------   Conditions Screen   -------------------------------------*/}

          {activeScreen === "conditions" && (
            <div key="weatherScreen" className="screen">
              {/*---------------------------------   Summary   -------------------------------------*/}

              <div className="conditionsLayout">
                <div className="weatherPanel">
                  <button
                    className="locationBtn"
                    onClick={() => setActiveScreen("nightSky")}
                  >
                    Go back
                  </button>
                  <div className="weatherSummary">
                    <div>
                      <h2>
                        Astronomical Conditions for {cityName}, {countryName}
                      </h2>
                      {weatherSummary === null ? (
                        <p>Summarising weather...</p>
                      ) : (
                        <ReactMarkdown>{weatherSummary}</ReactMarkdown>
                      )}
                    </div>

                    {/*---------------------------------   Time Panel   -------------------------------------*/}

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
                  </div>

                  {/*---------------------------------   Charts   -------------------------------------*/}

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
                          ></p>
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
