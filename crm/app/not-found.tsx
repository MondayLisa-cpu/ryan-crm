import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page narrow">
      <h1>搵唔到</h1>
      <p className="muted">呢個頁面唔存在，或者你冇權限睇。</p>
      <Link href="/">返回主頁</Link>
    </div>
  );
}
