"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

export type Round = { id: number; round_no: number; edu_date: string; start_time: string; end_time: string; location: string; status: string; attended?: number };
export type TrainingItem = { id: number; title: string; status: string; rounds: Round[]; target_count?: number; attended_count?: number };

const KEY = "sea.scan.selection";

export function useScanSelection() {
  const [trainings, setTrainings] = useState<TrainingItem[] | null>(null);
  const [trainingId, setTrainingId] = useState<number>(0);
  const [roundId, setRoundId] = useState<number>(0);
  const [error, setError] = useState("");

  useEffect(() => {
    api<TrainingItem[]>("/api/trainings")
      .then((list) => {
        const active = list.filter((t) => t.status === "active");
        setTrainings(active);
        let saved: { t?: number; r?: number } = {};
        try {
          saved = JSON.parse(localStorage.getItem(KEY) || "{}");
        } catch {}
        const t = active.find((x) => x.id === saved.t) || active.find((x) => x.rounds.some((r) => r.status === "open")) || active[0];
        if (t) {
          setTrainingId(t.id);
          const open = t.rounds.filter((r) => r.status === "open");
          const r = open.find((x) => x.id === saved.r) || open[0];
          setRoundId(r?.id ?? 0);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (trainingId) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ t: trainingId, r: roundId }));
      } catch {}
    }
  }, [trainingId, roundId]);

  const training = trainings?.find((t) => t.id === trainingId) ?? null;
  const round = training?.rounds.find((r) => r.id === roundId) ?? null;
  return { trainings, training, round, trainingId, roundId, setTrainingId, setRoundId, error };
}

export function TrainingPicker({ sel }: { sel: ReturnType<typeof useScanSelection> }) {
  const { trainings, training, trainingId, roundId, setTrainingId, setRoundId } = sel;
  if (sel.error) return <div className="alert err">{sel.error}</div>;
  if (!trainings) return <p className="muted">교육 목록 불러오는 중...</p>;
  if (!trainings.length) return <div className="alert warn">진행 중인 교육이 없습니다. 관리자가 [교육·차수] 메뉴에서 교육을 등록해야 합니다.</div>;
  const openRounds = training?.rounds.filter((r) => r.status === "open") ?? [];
  return (
    <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      <label className="field">교육
        <select
          value={trainingId}
          onChange={(e) => {
            const t = trainings.find((x) => x.id === Number(e.target.value));
            setTrainingId(Number(e.target.value));
            setRoundId(t?.rounds.find((r) => r.status === "open")?.id ?? 0);
          }}
        >
          {trainings.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </label>
      <label className="field">차수 (접수중)
        <select value={roundId} onChange={(e) => setRoundId(Number(e.target.value))}>
          {!openRounds.length && <option value={0}>접수 중인 차수 없음</option>}
          {openRounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.round_no}차 · {r.edu_date} {r.start_time}{r.location ? ` · ${r.location}` : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
