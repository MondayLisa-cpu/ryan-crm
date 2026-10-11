"use client";

import { useEffect, useRef } from "react";

/** 電腦（闊屏）預設打開、手機預設收埋嘅 <details> */
export default function WideOpenDetails({ summary, children }: { summary: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current && window.matchMedia("(min-width: 721px)").matches) ref.current.open = true;
  }, []);
  return (
    <details ref={ref}>
      <summary className="small">{summary}</summary>
      {children}
    </details>
  );
}
