import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom(), { animate: true });
  }, [lat, lon, map]);
  return null;
}

function ClickHandler({ onSelect }: { onSelect: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      onSelect(
        Number(event.latlng.lat.toFixed(4)),
        Number(((((event.latlng.lng + 180) % 360) + 360) % 360 - 180).toFixed(4)),
      );
    },
  });
  return null;
}

export default function OceanMap({
  lat,
  lon,
  onSelect,
}: {
  lat: number;
  lon: number;
  onSelect: (lat: number, lon: number) => void;
}) {
  return (
    <MapContainer
      center={[lat, lon]}
      zoom={4}
      minZoom={2}
      worldCopyJump
      className="h-full w-full"
      attributionControl
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <CircleMarker
        center={[lat, lon]}
        radius={9}
        pathOptions={{ color: "#4ee3e0", weight: 2, fillColor: "#4ee3e0", fillOpacity: 0.35 }}
      />
      <Recenter lat={lat} lon={lon} />
      <ClickHandler onSelect={onSelect} />
    </MapContainer>
  );
}
