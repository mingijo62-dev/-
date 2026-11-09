"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { toast } from "@/components/ui";
import Logo, { resetSiteSettings, useSiteSettings } from "@/components/Logo";

export default function SettingsPage() {
  const s = useSiteSettings();
  const [org, setOrg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setOrg(s.orgName), [s.orgName]);

  const reload = () => { resetSiteSettings(); location.reload(); };
  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", f);
      await api("/api/settings/logo", { form: fd });
      toast("로고가 변경되었습니다.");
      reload();
    } catch (ex) { alert(ex instanceof Error ? ex.message : "실패"); setBusy(false); }
  };
  const removeLogo = async () => {
    if (!confirm("업로드한 로고를 삭제하고 기본 'Hansol' 글자 로고로 되돌릴까요?")) return;
    await api("/api/settings/logo", { method: "DELETE" });
    reload();
  };
  const saveOrg = async () => {
    await api("/api/settings", { method: "PATCH", body: { orgName: org } });
    reload();
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h1>설정</h1>
      <div className="card stack" style={{ marginTop: 12 }}>
        <h2 style={{ margin: 0 }}>회사 로고</h2>
        <div className="muted small">상단바·로그인·직원 출석 화면·출석 QR 게시물에 표시됩니다. 사내 홍보팀/포털의 <b>공식 한솔제지 로고 파일</b>(배경 투명 PNG 또는 SVG, 가로형 권장, 1MB 이하)을 올려주세요. 상단바는 파란 배경이므로 흰색 로고가 가장 잘 보입니다.</div>
        <div className="row" style={{ gap: 16 }}>
          <div style={{ background: "var(--hansol-grad)", padding: "12px 16px", borderRadius: 10 }}><Logo /></div>
          <div style={{ background: "#fff", border: "1px solid var(--line)", padding: "12px 16px", borderRadius: 10 }}><Logo dark /></div>
        </div>
        <div className="row">
          <label className="btn primary" style={{ cursor: "pointer" }}>
            {busy ? "업로드 중..." : "로고 이미지 업로드"}
            <input type="file" accept=".png,.jpg,.jpeg,.svg,.webp" onChange={uploadLogo} style={{ display: "none" }} />
          </label>
          {s.logoVer && <button className="btn danger" onClick={removeLogo}>기본 로고로 되돌리기</button>}
        </div>
      </div>
      <div className="card stack">
        <h2 style={{ margin: 0 }}>회사명</h2>
        <div className="muted small">로고 이미지가 없을 때 &apos;Hansol&apos; 글자 옆에 표시됩니다.</div>
        <div className="row">
          <input value={org} onChange={(e) => setOrg(e.target.value)} style={{ maxWidth: 260 }} />
          <button className="btn" onClick={saveOrg}>저장</button>
        </div>
      </div>
    </div>
  );
}
