"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  TEAM_LABELS,
  getCurrentLocationForTeam,
  getDistanceInMeters,
  getGoogleMapsLink,
  getProgressPercent,
  getStatusStyles,
  getTotalStopsForTeam,
  formatMb,
} from "../lib/game";

type TeamRow = {
  id: number;
  team_number: number;
  team_code: string;
  current_stop_index: number;
};

type StatusType = "success" | "error" | "info" | "warning";

export default function HomePage() {
  const [teamCode, setTeamCode] = useState("");
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<StatusType>("info");
  const [isAtLocation, setIsAtLocation] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [lastFailedUpload, setLastFailedUpload] = useState(false);
  const [lastUploadedCount, setLastUploadedCount] = useState<number | null>(null);

  const maxVideoMb = Number(process.env.NEXT_PUBLIC_MAX_VIDEO_MB || "50");
  const maxVideoBytes = maxVideoMb * 1024 * 1024;

  useEffect(() => {
    const saved = localStorage.getItem("teamCode");
    if (saved) setTeamCode(saved);
  }, []);

  useEffect(() => {
    if (!teamCode.trim()) return;
    const saved = localStorage.getItem("teamCode");
    if (saved && saved === teamCode.trim() && !team) {
      handleLogin(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamCode]);

  useEffect(() => {
    if (!team) return;

    const interval = setInterval(() => {
      updateLiveLocation();
    }, 15000);

    updateLiveLocation();

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team]);

  const currentLocation = useMemo(() => {
    if (!team) return null;
    return getCurrentLocationForTeam(team.team_number, team.current_stop_index);
  }, [team]);

  const progressPercent = useMemo(() => {
    if (!team) return 0;
    return getProgressPercent(team.team_number, team.current_stop_index);
  }, [team]);

  const totalStops = useMemo(() => {
    if (!team) return 0;
    return getTotalStopsForTeam(team.team_number);
  }, [team]);

  function showStatus(message: string, type: StatusType = "info") {
    setStatus(message);
    setStatusType(type);
  }

  async function handleLogin(isAutoLogin = false) {
    const cleanCode = teamCode.trim();

    if (!cleanCode) {
      showStatus("Vul eerst een teamcode in.", "warning");
      return;
    }

    showStatus("Bezig met inloggen...", "info");

    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("team_code", cleanCode)
      .single();

    if (error || !data) {
      showStatus("Onjuiste teamcode. Controleer de code en probeer opnieuw.", "error");
      return;
    }

    localStorage.setItem("teamCode", cleanCode);
    setTeam(data);
    showStatus(
      isAutoLogin
        ? `${TEAM_LABELS[data.team_number]} is automatisch geladen.`
        : `Ingelogd als ${TEAM_LABELS[data.team_number]}.`,
      "success"
    );
  }

  async function refreshTeam() {
    if (!team) return;

    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("id", team.id)
      .single();

    if (!error && data) {
      setTeam(data);
    }
  }

  async function updateLiveLocation() {
    if (!team || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await supabase.from("team_live_status").upsert({
          team_id: team.id,
          team_number: team.team_number,
          current_stop_index: team.current_stop_index,
          current_location_id: currentLocation?.id || null,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          updated_at: new Date().toISOString(),
        });
      },
      () => {},
      {
        enableHighAccuracy: true,
        timeout: 8000,
      }
    );
  }

  function removeSelectedFile(indexToRemove: number) {
    setSelectedFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  }

  function resetLocationState() {
    setIsAtLocation(false);
    setDistance(null);
  }

  function validateFiles(files: File[]) {
    const validFiles: File[] = [];

    for (const file of files) {
      if (file.size > maxVideoBytes) {
        showStatus(
          `${file.name} is ${formatMb(file.size)} MB en dus groter dan de limiet van ${maxVideoMb} MB.`,
          "error"
        );
        continue;
      }
      validFiles.push(file);
    }

    return validFiles;
  }

  async function handleLogout() {
    localStorage.removeItem("teamCode");
    setTeam(null);
    setTeamCode("");
    setSelectedFiles([]);
    resetLocationState();
    showStatus("Je bent uitgelogd.", "info");
  }

  function checkLocation() {
    if (!currentLocation?.lat || !currentLocation?.lng) return;

    if (!navigator.geolocation) {
      showStatus("Locatie wordt niet ondersteund op dit apparaat.", "error");
      return;
    }

    setIsCheckingLocation(true);
    showStatus("Locatie controleren...", "info");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const dist = getDistanceInMeters(
          position.coords.latitude,
          position.coords.longitude,
          currentLocation.lat!,
          currentLocation.lng!
        );

        setDistance(dist);
        const within = dist <= (currentLocation.radiusMeters || 75);
        setIsAtLocation(within);
        setIsCheckingLocation(false);

        if (within) {
          showStatus("Top. Jullie zijn op de juiste locatie. De opdracht is nu zichtbaar.", "success");
        } else {
          showStatus(
            `Jullie zitten nog ongeveer ${Math.round(dist)} meter van de locatie af.`,
            "warning"
          );
        }
      },
      (error) => {
        setIsCheckingLocation(false);

        if (error.code === 1) {
          showStatus("Locatie-toegang geweigerd. Geef locatie-toegang in je browserinstellingen.", "error");
          return;
        }

        showStatus("Kon je locatie niet ophalen. Controleer je instellingen en probeer opnieuw.", "error");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  }

  async function handleSubmitVideos() {
    if (!team || !currentLocation) return;

    if (selectedFiles.length === 0) {
      showStatus("Voeg eerst minimaal één video toe voordat je inzendt.", "warning");
      return;
    }

    const confirmed = window.confirm(
      "Weet je zeker dat je deze video('s) definitief wilt inzenden?"
    );

    if (!confirmed) return;

    setIsSubmitting(true);
    setLastFailedUpload(false);
    setLastUploadedCount(null);
    showStatus("Bezig met inzenden...", "info");

    const { data: submissionData, error: submissionError } = await supabase
      .from("submissions")
      .insert({
        team_id: team.id,
        location_id: currentLocation.id,
        confirmed: true,
      })
      .select()
      .single();

    if (submissionError || !submissionData) {
      showStatus("Er ging iets mis bij het aanmaken van de inzending.", "error");
      setLastFailedUpload(true);
      setIsSubmitting(false);
      return;
    }

    for (const file of selectedFiles) {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const filePath = `team-${team.team_number}/${currentLocation.id}/${Date.now()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        showStatus(`Upload mislukt voor ${file.name}. Probeer opnieuw.`, "error");
        setLastFailedUpload(true);
        setIsSubmitting(false);
        return;
      }

      const { error: videoInsertError } = await supabase
        .from("submission_videos")
        .insert({
          submission_id: submissionData.id,
          file_path: filePath,
        });

      if (videoInsertError) {
        showStatus("De video is wel geüpload, maar niet goed geregistreerd.", "error");
        setLastFailedUpload(true);
        setIsSubmitting(false);
        return;
      }
    }

    const { error: teamUpdateError } = await supabase
      .from("teams")
      .update({ current_stop_index: team.current_stop_index + 1 })
      .eq("id", team.id);

    if (teamUpdateError) {
      showStatus("De video's zijn geüpload, maar de volgende locatie kon niet worden vrijgegeven.", "error");
      setLastFailedUpload(true);
      setIsSubmitting(false);
      return;
    }

    setLastUploadedCount(selectedFiles.length);
    setSelectedFiles([]);
    resetLocationState();
    await refreshTeam();
    setIsSubmitting(false);
    showStatus(
      `${selectedFiles.length} video${selectedFiles.length > 1 ? "'s zijn" : " is"} succesvol geüpload. De volgende locatie staat klaar.`,
      "success"
    );
  }

  if (!team) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-800 p-6 text-white">
        <div className="mx-auto mt-10 max-w-md rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-300">Speurtocht</p>
            <h1 className="mt-2 text-3xl font-bold">Vrijgezellenfeest Tilburg</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Log in met jullie teamcode om te starten.
            </p>
          </div>

          <input
            className="mb-3 w-full rounded-2xl border border-white/10 bg-white/10 p-4 text-white placeholder:text-zinc-400"
            placeholder="Bijv. TEAM1-2026"
            value={teamCode}
            onChange={(e) => setTeamCode(e.target.value)}
          />

          <button
            className="w-full rounded-2xl bg-white px-4 py-4 font-semibold text-zinc-900"
            onClick={() => handleLogin(false)}
          >
            Inloggen
          </button>

          {status && (
            <div className={`mt-4 rounded-2xl border p-4 text-sm ${getStatusStyles(statusType)}`}>
              {status}
            </div>
          )}
        </div>
      </main>
    );
  }

  if (!currentLocation) {
    return (
      <main className="min-h-screen bg-zinc-100 p-6">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-xl">
          <h1 className="text-2xl font-bold">{TEAM_LABELS[team.team_number]}</h1>
          <p className="mt-3">Geen actieve locatie gevonden.</p>
        </div>
      </main>
    );
  }

  const mapsLink = getGoogleMapsLink(currentLocation.name, currentLocation.lat, currentLocation.lng);

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-100 via-white to-zinc-100 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 rounded-3xl bg-zinc-950 p-5 text-white shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Actief team</p>
              <h1 className="mt-2 text-3xl font-bold">{TEAM_LABELS[team.team_number]}</h1>
              <p className="mt-1 text-sm text-zinc-300">
                Stop {Math.min(team.current_stop_index + 1, totalStops)} van {totalStops}
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-2xl border border-white/20 px-4 py-2 text-sm text-white"
            >
              Uitloggen
            </button>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-sm text-zinc-300">
              <span>Voortgang</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-3 rounded-full bg-white/10">
              <div
                className="h-3 rounded-full bg-white transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-xl ring-1 ring-zinc-200">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Volgende locatie</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900">{currentLocation.name}</h2>
          </div>

          {currentLocation.isFinal ? (
            <>
              <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-900">
                Jullie eindbestemming is bereikt. Op naar Ruby&apos;s Irish Pub 🍻
              </div>

              <a
                href={mapsLink}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block rounded-2xl bg-zinc-950 px-5 py-4 font-medium text-white"
              >
                Open route
              </a>
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl bg-zinc-950 px-5 py-4 text-center font-medium text-white"
                >
                  Open route
                </a>

                <button
                  className="rounded-2xl bg-zinc-200 px-5 py-4 font-medium text-zinc-900 disabled:opacity-50"
                  onClick={checkLocation}
                  disabled={isCheckingLocation}
                >
                  {isCheckingLocation ? "Locatie controleren..." : "Ik ben aangekomen"}
                </button>
              </div>

              {distance !== null && (
                <p className="mt-3 text-sm text-zinc-500">
                  Afstand tot locatie: {Math.round(distance)} meter
                </p>
              )}

              {isAtLocation && (
                <div className="mt-6 rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Opdracht</p>
                    <p className="mt-2 text-lg leading-relaxed text-zinc-900">
                      {currentLocation.challenge}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                    <label className="mb-2 block text-sm font-medium text-zinc-800">
                      Maak of kies 1 of meerdere video&apos;s
                    </label>

                    <input
                      type="file"
                      accept="video/*"
                      capture="environment"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (!files.length) return;

                        const validFiles = validateFiles(files);
                        if (!validFiles.length) return;

                        setSelectedFiles((prev) => [...prev, ...validFiles]);

                        if (validFiles.some((file) => file.size > 6 * 1024 * 1024)) {
                          showStatus(
                            "Let op: grotere video’s werken soms minder stabiel. Korte clips uploaden het betrouwbaarst.",
                            "warning"
                          );
                        }
                      }}
                      className="block w-full text-sm"
                    />

                    <p className="mt-2 text-xs text-zinc-500">
                      Maximaal {maxVideoMb} MB per video. Voor stabiele uploads zijn korte clips slim.
                    </p>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-zinc-900">{file.name}</p>
                            <p className="text-xs text-zinc-500">{formatMb(file.size)} MB</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeSelectedFile(index)}
                            className="rounded-xl border border-rose-200 px-3 py-2 text-sm text-rose-700"
                          >
                            Verwijderen
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                      className="rounded-2xl bg-emerald-600 px-5 py-4 font-medium text-white disabled:opacity-50"
                      disabled={isSubmitting}
                      onClick={handleSubmitVideos}
                    >
                      {isSubmitting ? "Bezig met inzenden..." : "Definitief inzenden"}
                    </button>

                    {lastFailedUpload && (
                      <button
                        className="rounded-2xl border border-zinc-300 px-5 py-4 font-medium text-zinc-900"
                        disabled={isSubmitting}
                        onClick={handleSubmitVideos}
                      >
                        Opnieuw proberen
                      </button>
                    )}
                  </div>

                  {lastUploadedCount !== null && (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      Upload geslaagd: {lastUploadedCount} video{lastUploadedCount > 1 ? "'s" : ""} opgeslagen.
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {status && (
            <div className={`mt-5 rounded-2xl border p-4 text-sm ${getStatusStyles(statusType)}`}>
              {status}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}