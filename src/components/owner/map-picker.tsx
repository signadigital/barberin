import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Navigation,
  Compass,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  Crosshair,
  Loader2,
} from "lucide-react";
import type L from "leaflet";

export type MapLocation = {
  latitude: number;
  longitude: number;
  address?: string;
};

interface MapPickerProps {
  value: MapLocation;
  onChange: (loc: MapLocation) => void;
  error?: string | null;
}

const PRESET_CITIES = [
  { name: "Jakarta", lat: -6.2088, lng: 106.8456 },
  { name: "Bandung", lat: -6.9175, lng: 107.6191 },
  { name: "Surabaya", lat: -7.2575, lng: 112.7521 },
  { name: "Yogyakarta", lat: -7.7956, lng: 110.3695 },
  { name: "Semarang", lat: -6.9667, lng: 110.4167 },
  { name: "Medan", lat: 3.5952, lng: 98.6722 },
  { name: "Bali", lat: -8.6705, lng: 115.2126 },
  { name: "Purbalingga", lat: -7.3892, lng: 109.3639 },
];

export function MapPicker({ value, onChange, error }: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerInstanceRef = useRef<L.Marker | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Search address state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  const isValidCoord =
    !isNaN(value.latitude) &&
    !isNaN(value.longitude) &&
    value.latitude !== 0 &&
    value.longitude !== 0 &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    value.longitude >= -180 &&
    value.longitude <= 180;

  // Inisialisasi Peta Leaflet secara aman di client-side
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isSubscribed = true;

    import("leaflet").then((leafletModule) => {
      if (!isSubscribed || !mapContainerRef.current) return;
      const L = leafletModule.default || leafletModule;

      // Jika map sudah ada, jangan re-create
      if (mapInstanceRef.current) return;

      const initialLat = isValidCoord ? value.latitude : -6.2088;
      const initialLng = isValidCoord ? value.longitude : 106.8456;

      // Inisialisasi peta
      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      mapInstanceRef.current = map;

      // Pasang Tile Layer OpenStreetMap resmi
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
        subdomains: ["a", "b", "c"],
        maxZoom: 19,
      }).addTo(map);

      // Custom SVG Marker Icon BARBERIN
      const customPinIcon = L.divIcon({
        className: "barberin-leaflet-pin",
        html: `
          <div style="position: relative; width: 34px; height: 42px; display: flex; flex-direction: column; align-items: center; cursor: grab;">
            <div style="width: 32px; height: 32px; border-radius: 50% 50% 50% 0; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); transform: rotate(-45deg); border: 2.5px solid #FFFFFF; box-shadow: 0 8px 20px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;">
              <div style="width: 10px; height: 10px; border-radius: 50%; background: #FFFFFF; transform: rotate(45deg);"></div>
            </div>
            <div style="width: 12px; height: 3px; background: rgba(0,0,0,0.4); border-radius: 50%; margin-top: 3px; filter: blur(1px);"></div>
          </div>
        `,
        iconSize: [34, 42],
        iconAnchor: [17, 42],
      });

      // Buat Marker yang dapat di-drag
      const marker = L.marker([initialLat, initialLng], {
        draggable: true,
        icon: customPinIcon,
        title: "Titik Lokasi Barbershop (Geser untuk memindahkan)",
      }).addTo(map);

      markerInstanceRef.current = marker;

      // Event: Drag Marker
      marker.on("dragend", () => {
        const latLng = marker.getLatLng();
        onChange({
          ...value,
          latitude: Number(latLng.lat.toFixed(7)),
          longitude: Number(latLng.lng.toFixed(7)),
        });
      });

      // Event: Klik Peta untuk memindahkan Marker
      map.on("click", (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        onChange({
          ...value,
          latitude: Number(e.latlng.lat.toFixed(7)),
          longitude: Number(e.latlng.lng.toFixed(7)),
        });
      });

      // Trigger resize agar tile termuat utuh
      setTimeout(() => {
        map.invalidateSize();
        setMapReady(true);
      }, 250);
    });

    return () => {
      isSubscribed = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      }
    };
  }, []);

  // Sinkronisasi posisi marker saat koordinat value berubah dari luar
  useEffect(() => {
    if (!mapReady || !markerInstanceRef.current || !mapInstanceRef.current) return;
    if (!isValidCoord) return;

    const currentPos = markerInstanceRef.current.getLatLng();
    const isDifferent =
      Math.abs(currentPos.lat - value.latitude) > 0.00001 ||
      Math.abs(currentPos.lng - value.longitude) > 0.00001;

    if (isDifferent) {
      markerInstanceRef.current.setLatLng([value.latitude, value.longitude]);
      mapInstanceRef.current.panTo([value.latitude, value.longitude], { animate: true });
    }
  }, [value.latitude, value.longitude, mapReady, isValidCoord]);

  // Handler: Ambil lokasi GPS saat ini
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation tidak didukung oleh peramban Anda.");
      return;
    }

    setGeoLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLoading(false);
        const lat = Number(position.coords.latitude.toFixed(7));
        const lng = Number(position.coords.longitude.toFixed(7));

        onChange({
          ...value,
          latitude: lat,
          longitude: lng,
        });

        if (mapInstanceRef.current && markerInstanceRef.current) {
          markerInstanceRef.current.setLatLng([lat, lng]);
          mapInstanceRef.current.flyTo([lat, lng], 16, { animate: true });
        }
      },
      (err) => {
        setGeoLoading(false);
        let msg = "Gagal mengambil lokasi saat ini.";
        if (err.code === 1) {
          msg = "Izin akses lokasi ditolak oleh browser.";
        } else if (err.code === 2) {
          msg = "Posisi GPS tidak tersedia saat ini.";
        }
        setGeoError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Handler: Pilih Kota Preset
  const handlePresetSelect = (preset: { lat: number; lng: number }) => {
    onChange({
      ...value,
      latitude: preset.lat,
      longitude: preset.lng,
    });

    if (mapInstanceRef.current && markerInstanceRef.current) {
      markerInstanceRef.current.setLatLng([preset.lat, preset.lng]);
      mapInstanceRef.current.flyTo([preset.lat, preset.lng], 15, { animate: true });
    }
  };

  // Handler: Pusatkan Peta ke Pin Saat Ini
  const handleCenterOnPin = () => {
    if (!isValidCoord || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([value.latitude, value.longitude], 16, { animate: true });
  };

  // Handler: Cari Alamat / Lokasi via OSM Nominatim
  const handleSearchLocation = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setSearchLoading(true);
    setSearchMessage(null);

    try {
      const endpoint = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query,
      )}&limit=1`;
      const res = await fetch(endpoint, {
        headers: {
          "Accept-Language": "id,en",
        },
      });

      if (!res.ok) {
        throw new Error("Gagal menghubungi layanan pencarian.");
      }

      const results = await res.json();
      if (!results || results.length === 0) {
        setSearchMessage("Lokasi tidak ditemukan. Coba gunakan nama kota atau jalan.");
        return;
      }

      const found = results[0];
      const lat = Number(parseFloat(found.lat).toFixed(7));
      const lng = Number(parseFloat(found.lon).toFixed(7));

      onChange({
        ...value,
        latitude: lat,
        longitude: lng,
        address: found.display_name || undefined,
      });

      if (mapInstanceRef.current && markerInstanceRef.current) {
        markerInstanceRef.current.setLatLng([lat, lng]);
        mapInstanceRef.current.flyTo([lat, lng], 16, { animate: true });
      }

      setSearchMessage(`Ditemukan: ${found.display_name?.split(",").slice(0, 2).join(",")}`);
    } catch {
      setSearchMessage("Pencarian lokasi gagal. Silakan gunakan titik preset atau klik langsung di peta.");
    } finally {
      setSearchLoading(false);
    }
  };

  // Manual input update
  const handleLatChange = (val: string) => {
    const num = parseFloat(val);
    onChange({
      ...value,
      latitude: isNaN(num) ? 0 : num,
    });
  };

  const handleLngChange = (val: string) => {
    const num = parseFloat(val);
    onChange({
      ...value,
      longitude: isNaN(num) ? 0 : num,
    });
  };

  const googleMapsUrl = `https://www.google.com/maps?q=${value.latitude},${value.longitude}`;

  return (
    <div className="space-y-3">
      {/* Header Label & Control Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-xs font-semibold text-slate-300">
          Address Pointer / Titik Lokasi Barbershop <span className="text-rose-400">*</span>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            disabled={geoLoading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors disabled:opacity-50"
            title="Deteksi posisi GPS perangkat"
          >
            <Navigation className={`h-3.5 w-3.5 ${geoLoading ? "animate-spin" : ""}`} />
            <span>{geoLoading ? "Mencari GPS..." : "GPS Saya"}</span>
          </button>

          <button
            type="button"
            onClick={handleCenterOnPin}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition-colors"
            title="Pusatkan peta pada posisi pin saat ini"
          >
            <Crosshair className="h-3.5 w-3.5 text-blue-400" />
            <span>Pusatkan Pin</span>
          </button>
        </div>
      </div>

      {/* Pencarian Alamat / Tempat */}
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                handleSearchLocation(e);
              }
            }}
            placeholder="Cari nama jalan, gedung, atau area (misal: Sudirman Jakarta)"
            className="w-full pl-9 pr-3 py-1.5 bg-[#14233D] text-xs text-white placeholder-slate-500 border border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSearchLocation(e);
          }}
          disabled={searchLoading || !searchQuery.trim()}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
        >
          {searchLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Cari"}
        </button>
      </div>

      {searchMessage && (
        <div className="text-[11px] text-slate-300 px-1 italic">
          {searchMessage}
        </div>
      )}

      {/* REAL INTERACTIVE LEAFLET MAP CONTAINER */}
      <div className="relative w-full h-72 sm:h-80 bg-[#0B1527] border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl">
        {/* The Leaflet Map DOM Element */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Top Overlay Badge: Coordinate & Status */}
        <div className="absolute top-3 left-3 right-3 z-30 pointer-events-none flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700/80 text-[11px] backdrop-blur-md shadow-lg pointer-events-auto">
            <Compass className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-slate-200 font-mono text-[11px]">
              {isValidCoord ? `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}` : "Pilih titik di peta"}
            </span>
          </div>

          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-lg pointer-events-auto">
            {isValidCoord ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                <CheckCircle2 className="h-3 w-3" />
                <span>Titik Terpilih</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-semibold">
                <AlertCircle className="h-3 w-3" />
                <span>Pilih Titik</span>
              </span>
            )}
          </div>
        </div>

        {/* Bottom Bar: Petunjuk & Tombol Buka di Google Maps */}
        <div className="absolute bottom-2 left-2 right-2 z-30 pointer-events-none flex flex-wrap items-center justify-between gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700/80 text-[10px] text-slate-300 backdrop-blur-md shadow pointer-events-auto">
            💡 <em>Klik peta atau geser pin biru untuk menentukan titik</em>
          </div>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-[11px] font-semibold text-white shadow-md backdrop-blur-md transition-colors pointer-events-auto"
            title="Buka titik ini di Google Maps"
          >
            <span>Buka di Google Maps</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Preset Cepat Kota-Kota Besar di Indonesia */}
      <div>
        <div className="text-[10px] text-slate-400 mb-1.5 font-medium">
          Pilihan Cepat Kota:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_CITIES.map((city) => (
            <button
              key={city.name}
              type="button"
              onClick={() => handlePresetSelect(city)}
              className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-[11px] text-slate-200 transition-colors"
            >
              {city.name}
            </button>
          ))}
        </div>
      </div>

      {/* Input Angka Latitude & Longitude Manual (Sinkron Dua Arah) */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">
            Latitude (Lintang)
          </label>
          <input
            type="number"
            step="0.0000001"
            value={value.latitude || ""}
            onChange={(e) => handleLatChange(e.target.value)}
            placeholder="-6.2088"
            className="w-full px-3 py-2 bg-[#14233D] text-xs text-white placeholder-slate-500 border border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-500 transition-colors font-mono"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">
            Longitude (Bujur)
          </label>
          <input
            type="number"
            step="0.0000001"
            value={value.longitude || ""}
            onChange={(e) => handleLngChange(e.target.value)}
            placeholder="106.8456"
            className="w-full px-3 py-2 bg-[#14233D] text-xs text-white placeholder-slate-500 border border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-500 transition-colors font-mono"
          />
        </div>
      </div>

      {geoError && (
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-amber-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{geoError}</span>
        </div>
      )}

      {error && (
        <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
