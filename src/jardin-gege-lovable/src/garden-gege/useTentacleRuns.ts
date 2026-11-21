import { useEffect, useState } from "react";

// Public GitHub Actions metadata only: no credentials, private logs or publishing actions.
export type TentacleRun = {
  name: string;
  status: "idle" | "queued" | "in_progress" | "completed" | "unavailable";
  conclusion: string | null;
  at: string | null;
  url: string | null;
};

const workflows = [
  { name: "Production", file: "gerard-production.yml" },
  { name: "Diffusion", file: "gerard-runtime.yml", job: "delivery" },
  { name: "Apprentissage", file: "gerard-learning.yml" },
] as const;

export function useTentacleRuns(enabled: boolean) {
  const [runs, setRuns] = useState<TentacleRun[]>([]);
  useEffect(() => {
    if (!enabled) { setRuns([]); return; }
    let disposed = false;
    const controller = new AbortController();
    const load = async () => {
      const next = await Promise.all(workflows.map(async (item): Promise<TentacleRun> => {
        try {
          const url = `https://api.github.com/repos/benoitlub/poulpe-fiction/actions/workflows/${item.file}/runs?per_page=15`;
          const response = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: "application/vnd.github+json" },
          });
          if (!response.ok) throw new Error(`GitHub ${response.status}`);
          const body = await response.json() as { workflow_runs?: Array<{
            status?: string; conclusion?: string | null; created_at?: string;
            updated_at?: string; html_url?: string; id?: number; run_attempt?: number;
          }> };
          // Diffusion shares a workflow with courrier. Inspect the job name,
          // not the workflow run, so a mail run never looks like a diffusion run.
          let run = body.workflow_runs?.[0];
          if ("job" in item) {
            run = undefined;
            for (const candidate of body.workflow_runs ?? []) {
              if (!candidate.id) continue;
              const jobsResponse = await fetch(
                `https://api.github.com/repos/benoitlub/poulpe-fiction/actions/runs/${candidate.id}/jobs?per_page=30`,
                { signal: controller.signal, headers: { Accept: "application/vnd.github+json" } },
              );
              if (!jobsResponse.ok) throw new Error(`GitHub jobs ${jobsResponse.status}`);
              const jobs = await jobsResponse.json() as { jobs?: Array<{
                name?: string; status?: string; conclusion?: string | null;
                started_at?: string; completed_at?: string; html_url?: string;
              }> };
              const job = jobs.jobs?.find((entry) => /^(delivery|diffusion)(\s|$|\s*\/)/i.test(entry.name?.trim() ?? ""));
              if (job) return {
                name: item.name,
                status: job.status === "completed" || job.status === "in_progress" || job.status === "queued" ? job.status : "unavailable",
                conclusion: job.conclusion ?? null,
                at: job.completed_at ?? job.started_at ?? candidate.created_at ?? null,
                url: job.html_url ?? candidate.html_url ?? null,
              };
            }
          }
          if (!run) return { name: item.name, status: "idle", conclusion: null, at: null, url: null };
          const status = run.status === "in_progress" || run.status === "queued" || run.status === "completed"
            ? run.status : "unavailable";
          return {
            name: item.name, status, conclusion: run.conclusion ?? null,
            at: run.updated_at ?? run.created_at ?? null, url: run.html_url ?? null,
          };
        } catch {
          return { name: item.name, status: "unavailable", conclusion: null, at: null, url: null };
        }
      }));
      if (!disposed) setRuns(next);
    };
    void load();
    const interval = setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    return () => { disposed = true; clearInterval(interval); controller.abort(); };
  }, [enabled]);
  return runs;
}
