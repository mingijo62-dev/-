"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { EmployeeCheckCard, type ScanEmp } from "@/components/CheckIn";
import { TrainingPicker, useScanSelection } from "@/components/TrainingPicker";
import { api } from "@/lib/client";

/** 휴대폰 기본 카메라로 QR을 찍었을 때 진입하는 화면 */
export default function TokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const sel = useScanSelection();
  const [emp, setEmp] = useState<ScanEmp | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!sel.trainings) return;
    setEmp(null);
    api<ScanEmp[]>(`/api/scan?token=${encodeURIComponent(token)}&trainingId=${sel.trainingId}`)
      .then((r) => setEmp(r[0]))
      .catch((e) => setErr(e.message));
  }, [token, sel.trainingId, sel.trainings]);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }} className="stack">
      <h1>QR 출석 확인</h1>
      <div className="card"><TrainingPicker sel={sel} /></div>
      {err && <div className="alert err">{err}</div>}
      {emp && <EmployeeCheckCard key={`${emp.id}-${sel.trainingId}`} emp={emp} trainingId={sel.trainingId} roundId={sel.roundId} />}
      <Link href="/scan" className="btn">스캐너 화면으로 이동</Link>
    </div>
  );
}
