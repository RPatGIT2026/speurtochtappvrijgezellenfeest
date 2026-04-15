export type LocationItem = {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  challenge?: string;
  isFinal?: boolean;
};

export const LOCATIONS: Record<string, LocationItem> = {
  kerk: {
    id: "kerk",
    name: "Sint Dionysiuskerk",
    lat: 51.5547,
    lng: 5.0852,
    radiusMeters: 75,
    challenge:
      "Tegenover de kerk vind je het standbeeld van Willem 2. Wie kan hem het beste nadoen? Drink achteraf een biertje op Willem.",
  },
  spoorzone: {
    id: "spoorzone",
    name: "Spoorzone (LocHal)",
    lat: 51.5611,
    lng: 5.0858,
    radiusMeters: 75,
    challenge:
      "Bierpong op straat. Speel een potje met 3 bekers (en 2 biertjes) per kant op een bankje of tafel in teams. Het verliezende team neemt een shotje.",
  },
  poppodium013: {
    id: "poppodium013",
    name: "013 Poppodium",
    lat: 51.5578,
    lng: 5.0929,
    radiusMeters: 75,
    challenge: "Neem een shotje met 2 milfs.",
  },
  piushaven: {
    id: "piushaven",
    name: "Piushaven",
    lat: 51.552576,
    lng: 5.096929,
    radiusMeters: 75,
    challenge:
      "Doe een straatinterview van minimaal 2 minuten met een dame (en adt daarna een biertje).",
  },
  rubys: {
    id: "rubys",
    name: "Ruby's Irish Pub",
    isFinal: true,
  },
};

export const TEAM_ROUTES: Record<number, string[]> = {
  1: ["kerk", "spoorzone", "poppodium013", "piushaven", "rubys"],
  2: ["spoorzone", "poppodium013", "piushaven", "kerk", "rubys"],
  3: ["poppodium013", "piushaven", "kerk", "spoorzone", "rubys"],
  4: ["piushaven", "kerk", "spoorzone", "poppodium013", "rubys"],
};

export const TEAM_LABELS: Record<number, string> = {
  1: "Team 1",
  2: "Team 2",
  3: "Team 3",
  4: "Team 4",
};

export function getCurrentLocationForTeam(
  teamNumber: number,
  currentStopIndex: number
) {
  const route = TEAM_ROUTES[teamNumber];
  const locationId = route[currentStopIndex];
  return LOCATIONS[locationId];
}

export function getTotalStopsForTeam(teamNumber: number) {
  return TEAM_ROUTES[teamNumber]?.length || 0;
}

export function getProgressPercent(teamNumber: number, currentStopIndex: number) {
  const totalStops = getTotalStopsForTeam(teamNumber);
  if (!totalStops || totalStops <= 1) return 0;

  const playableStops = totalStops - 1;
  const finishedStops = Math.min(currentStopIndex, playableStops);
  return Math.round((finishedStops / playableStops) * 100);
}

export function getDistanceInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const f1 = toRad(lat1);
  const f2 = toRad(lat2);
  const df = toRad(lat2 - lat1);
  const dl = toRad(lng2 - lng1);

  const a =
    Math.sin(df / 2) * Math.sin(df / 2) +
    Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) * Math.sin(dl / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getGoogleMapsLink(name: string, lat?: number, lng?: number) {
  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
}

export function formatMb(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1);
}

export function getLocationName(locationId?: string | null) {
  if (!locationId) return "Onbekend";
  return LOCATIONS[locationId]?.name || locationId;
}

export function getStatusStyles(type: "success" | "error" | "info" | "warning") {
  switch (type) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-sky-200 bg-sky-50 text-sky-800";
  }
}