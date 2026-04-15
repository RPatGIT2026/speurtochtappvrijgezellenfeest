"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { LOCATIONS, TEAM_LABELS, TEAM_ROUTES, getLocationName } from "../../lib/game";

type TeamRow = {
  id: number;
  team_number: number;
  current_stop_index: number;
};

type SubmissionRow = {
  id: number;
  team_id: number;
  location_id: string;
  submitted_at: string;
};

type SubmissionVideoRow = {
  id: number;
  submission_id: number;
  file_path: string;
};

type LiveStatusRow = {
  team_id: number;
  team_number: number;
  current_stop_index: number;
  current_location_id: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  updated_at: string | null;
};

const ADMIN_STORAGE_KEY = "adminUnlocked";

export default function AdminPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [videos, setVideos] = useState<SubmissionVideoRow[]>([]);
  const [liveStatuses, setLiveStatuses] = useState<LiveStatusRow[]>([]);
  const [adminCodeInput, setAdminCodeInput] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const adminCode = process.env.NEXT_PUBLIC_ADMIN_CODE;

  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (saved === "true") setIsAuthed(true);
  }, []);

  useEffect(() => {
    if (!isAuthed) return;

    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [isAuthed]);

  async function loadData() {
    const { data: teamData } = await supabase
      .from("teams")
      .select("id, team_number, current_stop_index")
      .order("team_number", { ascending: true });

    const { data: submissionData } = await supabase
      .from("submissions")
      .select("id, team_id, location_id, submitted_at")
      .order("submitted_at", { ascending: false });

    const { data: videoData } = await supabase
      .from("submission_videos")
      .select("id, submission_id, file_path")
      .order("id", { ascending: false });

    const { data: liveData } = await supabase
      .from("team_live_status")
      .select("*")
      .order("team_number", { ascending: true });

    setTeams(teamData || []);
    setSubmissions(submissionData || []);
    setVideos(videoData || []);
    setLiveStatuses(liveData || []);
    setLastUpdated(new Date().toLocaleTimeString());
  }

  function handleAdminLogin() {
    if (!adminCode) {
      setLoginError("Admincode ontbreekt in .env.local");
      return;
    }

    if (adminCodeInput.trim() !== adminCode.trim()) {
      setLoginError("Onjuiste admincode.");
      return;
    }

    localStorage.setItem(ADMIN_STORAGE_KEY, "true");
    setIsAuthed(true);
    setLoginError("");
  }

  function handleLogout() {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    setIsAuthed(false);
    setAdminCodeInput("");
  }

  function getPublicUrl(filePath: string) {
    const { data } = supabase.storage.from("videos").getPublicUrl(filePath);
    return data.publicUrl;
  }

  const teamMap = useMemo(() => {
    const map = new Map<number, TeamRow>();
    teams.forEach((team) => map.set(team.id, team));
    return map;
  }, [teams]);

  const liveMap = useMemo(() => {
    const map = new Map<number, LiveStatusRow>();
    liveStatuses.forEach((status) => map.set(status.team_id, status));
    return map;
  }, [liveStatuses]);

  if (!isAuthed) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-800 p-6 text-white">
        <div className="mx-auto mt-10 max-w-md rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <h1 className="mb-4 text-3xl font-bold">Admin login</h1>
          <p className="mb-4 text-sm text-zinc-300">
            Vul de admincode in om het dashboard te openen.
          </p>

          <input
            type="password"
            className="mb-3 w-full rounded-2xl border border-white/10 bg-white/10 p-4 text-white placeholder:text-zinc-400"
            placeholder="Admincode"
            value={adminCodeInput}
            onChange={(e) => setAdminCodeInput(e.target.value)}
          />

          <button
            onClick={handleAdminLogin}
            className="w-full rounded-2xl bg-white px-4 py-4 font-semibold text-zinc-900"
          >
            Inloggen
          </button>

          {loginError && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {loginError}
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-zinc-950 p-6 text-white shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Dashboard</p>
              <h1 className="mt-2 text-3xl font-bold">Speurtocht Admin</h1>
              <p className="mt-2 text-sm text-zinc-300">
                Auto-refresh elke 10 seconden · Laatst bijgewerkt om {lastUpdated || "-"}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={loadData}
                className="rounded-2xl border border-white/20 px-4 py-3 text-sm"
              >
                Verversen
              </button>
              <button
                onClick={handleLogout}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-900"
              >
                Uitloggen
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <section className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-zinc-200">
            <h2 className="mb-4 text-2xl font-semibold text-zinc-900">Live teams</h2>

            <div className="grid gap-4 md:grid-cols-2">
              {teams.map((team) => {
                const live = liveMap.get(team.id);
                const route = TEAM_ROUTES[team.team_number] || [];
                const nextLocationId = route[team.current_stop_index];
                const nextLocationName = getLocationName(nextLocationId);

                return (
                  <div key={team.id} className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
                    <p className="text-lg font-semibold text-zinc-900">
                      {TEAM_LABELS[team.team_number]}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Huidige/volgende locatie: {nextLocationName}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Stop index: {team.current_stop_index}
                    </p>

                    <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
                      <p className="text-sm font-medium text-zinc-800">Live locatie</p>

                      {live?.lat && live?.lng ? (
                        <>
                          <p className="mt-2 text-sm text-zinc-600">
                            Laatste update:{" "}
                            {live.updated_at
                              ? new Date(live.updated_at).toLocaleTimeString()
                              : "-"}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Accuracy: {live.accuracy ? `${Math.round(live.accuracy)} m` : "-"}
                          </p>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${live.lat},${live.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-block text-sm font-medium text-blue-600 underline"
                          >
                            Open live locatie in Google Maps
                          </a>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-zinc-500">
                          Nog geen live locatie ontvangen.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-zinc-200">
            <h2 className="mb-4 text-2xl font-semibold text-zinc-900">Routehistorie per team</h2>

            <div className="space-y-4">
              {teams.map((team) => {
                const route = TEAM_ROUTES[team.team_number] || [];
                const completed = route.slice(0, Math.min(team.current_stop_index, route.length));

                return (
                  <div key={team.id} className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
                    <p className="font-semibold text-zinc-900">{TEAM_LABELS[team.team_number]}</p>

                    {completed.length === 0 ? (
                      <p className="mt-2 text-sm text-zinc-500">Nog geen locaties afgerond.</p>
                    ) : (
                      <ol className="mt-3 space-y-2 text-sm text-zinc-700">
                        {completed.map((locationId, index) => (
                          <li key={`${team.id}-${locationId}-${index}`} className="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                            {index + 1}. {getLocationName(locationId)}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-zinc-200">
          <h2 className="mb-4 text-2xl font-semibold text-zinc-900">Inzendingen</h2>

          <div className="space-y-4">
            {submissions.length === 0 && (
              <p className="text-sm text-zinc-500">Nog geen inzendingen binnen.</p>
            )}

            {submissions.map((submission) => {
              const relatedVideos = videos.filter((video) => video.submission_id === submission.id);
              const team = teamMap.get(submission.team_id);
              const teamLabel = team ? TEAM_LABELS[team.team_number] : `Team-ID ${submission.team_id}`;
              const locationName = getLocationName(submission.location_id);

              return (
                <div key={submission.id} className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
                  <p className="font-semibold text-zinc-900">
                    {teamLabel} — {locationName}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {new Date(submission.submitted_at).toLocaleString()}
                  </p>

                  <div className="mt-3 space-y-2">
                    {relatedVideos.length === 0 && (
                      <p className="text-sm text-zinc-500">Geen video&apos;s gevonden.</p>
                    )}

                    {relatedVideos.map((video) => (
                      <div key={video.id}>
                        <a
                          href={getPublicUrl(video.file_path)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline"
                        >
                          Bekijk video
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}