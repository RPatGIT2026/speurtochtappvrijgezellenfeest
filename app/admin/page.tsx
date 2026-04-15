"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

export default function AdminPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [videos, setVideos] = useState<SubmissionVideoRow[]>([]);

  useEffect(() => {
    loadData();
  }, []);

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

    setTeams(teamData || []);
    setSubmissions(submissionData || []);
    setVideos(videoData || []);
  }

  function getPublicUrl(filePath: string) {
    const { data } = supabase.storage.from("videos").getPublicUrl(filePath);
    return data.publicUrl;
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold">Admin Overzicht</h1>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Teams</h2>
          <div className="space-y-3">
            {teams.map((team) => (
              <div key={team.id} className="rounded-xl border p-3">
                Team {team.team_number} — huidige stop index: {team.current_stop_index}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Inzendingen</h2>
          <div className="space-y-4">
            {submissions.map((submission) => {
              const relatedVideos = videos.filter(
                (video) => video.submission_id === submission.id
              );

              return (
                <div key={submission.id} className="rounded-xl border p-4">
                  <p className="font-medium">
                    Team ID {submission.team_id} — locatie {submission.location_id}
                  </p>
                  <p className="text-sm text-zinc-600">
                    {new Date(submission.submitted_at).toLocaleString()}
                  </p>

                  <div className="mt-3 space-y-2">
                    {relatedVideos.map((video) => (
                      <div key={video.id}>
                        <a
                          href={getPublicUrl(video.file_path)}
                          target="_blank"
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
        </div>
      </div>
    </main>
  );
}