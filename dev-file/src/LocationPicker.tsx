import { useState } from "react";
import { MapContainer, TileLayer, useMapEvents, Marker } from "react-leaflet";
import "./Components.css";

interface Coordinates {
  lat: number;
  lng: number;
}

const defaultPosition: Coordinates = { lat: 51.505, lng: -0.09 }; //defaults at london.

function LocationPicker({ onLocationSelect }: { onLocationSelect: (coords: Coordinates) => void }) {
  const [position, setPosition] = useState<Coordinates>(defaultPosition);

  function MapClickHandler() {
    useMapEvents({
      click: (e) => {
        setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
      },
    });
    return null;
  }

  return (
    <div className="mapContainer">
      <MapContainer center={position} zoom={6} className="leafletContainer">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        <Marker position={position} />

        <MapClickHandler />
      </MapContainer>

      <button onClick={() => onLocationSelect(position)} className="buttonLocationSave">
        Save Location
      </button>
    </div>
  );
}

export default LocationPicker;
