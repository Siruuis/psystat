import { useEffect } from "react";
import { useStore } from "../state/store";

export function Toast() {
  const notice = useStore((s) => s.notice);
  const setNotice = useStore((s) => s.setNotice);

  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(null), 3200);
      return () => clearTimeout(t);
    }
  }, [notice, setNotice]);

  if (!notice) return null;
  return (
    <div className="toast" onClick={() => setNotice(null)}>
      {notice}
    </div>
  );
}
