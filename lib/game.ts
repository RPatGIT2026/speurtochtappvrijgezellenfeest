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
  berkebrom: {
    id: "berkebrom",
    name: "Eetcafé In den Berkebrom",
    lat: 51.9516,
    lng: 4.4337,
    radiusMeters: 100,
    challenge: "Maak hier een korte teamselfie-video van 10 seconden.",
  },
  grotekerk: {
    id: "grotekerk",
    name: "Grote Kerk Overschie",
    lat: 51.9523,
    lng: 4.4347,
    radiusMeters: 100,
    challenge:
      "Laat 1 teamlid een speech van 15 seconden geven alsof hij burgemeester is.",
  },
  museum: {
    id: "museum",
    name: "Museum Overschie",
    lat: 51.9530,
    lng: 4.4355,
    radiusMeters: 100,
    challenge:
      "Maak een video waarin jullie doen alsof jullie een museumrondleiding geven.",
  },
  halte: {
    id: "halte",
    name: "Bibliotheek Overschie / De Halte",
    lat: 51.9537,
    lng: 4.4361,
    radiusMeters: 100,
    challenge:
      "Neem een video op waarin jullie allemaal tegelijk 1 boek aanbevelen.",
  },
  petrus: {
    id: "petrus",
    name: "Petrus' Bandenkerk",
    lat: 51.9544,
    lng: 4.4370,
    isFinal: true,
  },
};

export const TEAM_ROUTES: Record<number, string[]> = {
  1: ["berkebrom", "grotekerk", "museum", "halte", "petrus"],
  2: ["grotekerk", "museum", "halte", "berkebrom", "petrus"],
  3: ["museum", "halte", "berkebrom", "grotekerk", "petrus"],
  4: ["halte", "berkebrom", "grotekerk", "museum", "petrus"],
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