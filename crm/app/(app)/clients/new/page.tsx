import NewClientForm from "./NewClientForm";

export default function NewClientPage() {
  return (
    <div className="narrow">
      <h1>新增準客戶</h1>
      <p className="muted small">新客會由 RR 階段開始。唔需要身份證號碼。</p>
      <NewClientForm />
    </div>
  );
}
