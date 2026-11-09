"use client";
import { useEffect, useState } from "react";

type S = { orgName: string; logoVer: string | null };
let cache: Promise<S> | null = null;
export function useSiteSettings() {
  const [s, setS] = useState<S>({ orgName: "한솔제지", logoVer: null });
  useEffect(() => {
    cache ??= fetch("/api/settings", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ orgName: "한솔제지", logoVer: null }));
    cache.then((v) => v?.orgName && setS(v));
  }, []);
  return s;
}
export function resetSiteSettings() {
  cache = null;
}

/** 회사 로고: 관리자가 업로드한 공식 로고가 있으면 이미지, 없으면 Hansol 워드마크 */
export default function Logo({ dark }: { dark?: boolean }) {
  const s = useSiteSettings();
  return (
    <span className={`logo${dark ? " dark" : ""}`}>
      {s.logoVer ? (
        <img src={`/api/settings/logo?v=${s.logoVer}`} alt={s.orgName} />
      ) : (
        <>
          <span className="wordmark">Hansol</span>
          <span className="org">{s.orgName}</span>
        </>
      )}
    </span>
  );
}
