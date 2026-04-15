"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getCurrentLocationForTeam,
  getDistanceInMeters,
  getGoogleMapsLink,
} from "@/lib/game";

type TeamRow = {
  id: number;
  team_number: number;
  team_code: string;
  current_stop_index: number;
};

export default function HomePage() {
  const [teamCode, setTeamCode] = useState("");
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [status, setStatus] = useState("");
  const [isAtLocation, setIsAtLocation] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("teamCode");
    if (saved) setTeamCode(saved);
  }, []);

  const currentLocation = useMemo(() => {
    if (!team) return null;
    return getCurrentLocationForTeam(team.team_number, team.current_stop_index);
  }, [team]);

  async function handleLogin() {
    setStatus("Bezig met inloggen...");
    const cleanCode = teamCode.trim();

    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("team_code", cleanCode)
      .single();

    if (error || !data) {
      setStatus("Onjuiste teamcode.");
      return;
    }

    localStorage.setItem("teamCode", cleanCode);
    setTeam(data);
    setStatus(`Ingelogd als Team ${data.team_number}.`);
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

  function checkLocation() {
    if (!currentLocation?.lat || !currentLocation?.lng) return;

    if (!navigator.geolocation) {
      setStatus("Locatie wordt niet ondersteund op dit apparaat.");
      return;
    }

    setStatus("Locatie controleren...");

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

        if (within) {
          setStatus("Top, jullie zijn op de juiste locatie. De opdracht is nu zichtbaar.");
        } else {
          setStatus(`Nog niet dichtbij genoeg. Jullie zitten op ongeveer ${Math.round(dist)} meter afstand.`);
        }
      },
      () => {
        setStatus("Kon je locatie niet ophalen. Geef locatie-toegang in je browser.");
      },
      { enableHighAccuracy: true }
    );
  }

  async function handleSubmitVideos() {
    if (!team || !currentLocation) return;
    if (selectedFiles.length === 0) {
      setStatus("Kies eerst minimaal 1 video.");
      return;
    }

    const confirmed = window.confirm(
      "Weet je zeker dat je deze video('s) definitief wilt inzenden?"
    );

    if (!confirmed) return;

    setIsSubmitting(true);
    setStatus("Video's uploaden...");

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
      setStatus("Kon inzending niet aanmaken.");
      setIsSubmitting(false);
      return;
    }

    for (const file of selectedFiles) {
      const filePath = `team-${team.team_number}/${currentLocation.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        setStatus(`Upload mislukt voor ${file.name}.`);
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
        setStatus("Video opgeslagen, maar registratie in database mislukte.");
        setIsSubmitting(false);
        return;
      }
    }

    const { error: teamUpdateError } = await supabase
      .from("teams")
      .update({ current_stop_index: team.current_stop_index + 1 })
      .eq("id", team.id);

    if (teamUpdateError) {
      setStatus("Upload gelukt, maar volgende locatie kon niet worden vrijgegeven.");
      setIsSubmitting(false);
      return;
    }

    setSelectedFiles([]);
    setIsAtLocation(false);
    setDistance(null);
    setStatus("Opdracht afgerond. Volgende locatie staat klaar.");
    await refreshTeam();
    setIsSubmitting(false);
  }

  if (!team) {
    return (
      <main className="min-h-screen bg-zinc-100 p-6">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow">
          <h1 className="mb-4 text-2xl font-bold">Vrijgezellen Speurtocht</h1>
          <p className="mb-4 text-sm text-zinc-600">
            Vul jullie teamcode in om te starten.
          </p>

          <input
            className="mb-3 w-full rounded-xl border p-3"
            placeholder="Bijv. TEAM1-2026"
            value={teamCode}
            onChange={(e) => setTeamCode(e.target.value)}
          />

          <button
            className="w-full rounded-xl bg-black px-4 py-3 text-white"
            onClick={handleLogin}
          >
            Inloggen
          </button>

          {status && <p className="mt-4 text-sm">{status}</p>}
        </div>
      </main>
    );
  }

  if (!currentLocation) {
    return (
      <main className="min-h-screen bg-zinc-100 p-6">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold">Team {team.team_number}</h1>
          <p className="mt-3">Geen actieve locatie gevonden.</p>
        </div>
      </main>
    );
  }

  const mapsLink = getGoogleMapsLink(
    currentLocation.name,
    currentLocation.lat,
    currentLocation.lng
  );

  return (
    <main className="min-h-screen bg-zinc-100 p-6">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Team {team.team_number}</h1>
          <p className="text-sm text-zinc-600">Huidige stop: {team.current_stop_index + 1}</p>
        </div>

        <div className="rounded-2xl border p-4">
          <h2 className="text-xl font-semibold">{currentLocation.name}</h2>

          {currentLocation.isFinal ? (
            <>
              <p className="mt-3">Jullie eindbestemming is bereikt. Op naar Ruby's Irish Pub 🍻</p>
              <a
                href={mapsLink}
                target="_blank"
                className="mt-4 inline-block rounded-xl bg-black px-4 py-3 text-white"
              >
                Open route
              </a>
            </>
          ) : (
            <>
              <a
                href={mapsLink}
                target="_blank"
                className="mt-4 inline-block rounded-xl bg-black px-4 py-3 text-white"
              >
                Open route
              </a>

              <button
                className="mt-3 block rounded-xl bg-zinc-800 px-4 py-3 text-white"
                onClick={checkLocation}
              >
                Ik ben aangekomen
              </button>

              {distance !== null && (
                <p className="mt-3 text-sm text-zinc-600">
                  Afstand tot locatie: {Math.round(distance)} meter
                </p>
              )}

              {isAtLocation && (
                <div className="mt-6 rounded-2xl bg-zinc-50 p-4">
                  <h3 className="text-lg font-semibold">Opdracht</h3>
                  <p className="mt-2">{currentLocation.challenge}</p>

                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-medium">
                      Voeg 1 of meerdere video's toe
                    </label>
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setSelectedFiles(files);
                      }}
                    />
                  </div>

                  {selectedFiles.length > 0 && (
                    <ul className="mt-3 space-y-2 text-sm">
                      {selectedFiles.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="rounded-lg border p-2">
                          {file.name}
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    className="mt-4 rounded-xl bg-green-600 px-4 py-3 text-white disabled:opacity-50"
                    disabled={isSubmitting}
                    onClick={handleSubmitVideos}
                  >
                    {isSubmitting ? "Bezig met inzenden..." : "Definitief inzenden"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {status && <p className="mt-4 text-sm">{status}</p>}
      </div>
    </main>
  );
}