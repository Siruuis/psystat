import { useStore } from "../state/store";

export function ConfirmDialog() {
  const confirm = useStore((s) => s.confirm);
  const close = useStore((s) => s.closeConfirm);
  if (!confirm) return null;

  const run = () => {
    confirm.onConfirm();
    close();
  };

  return (
    <div className="dialog-backdrop" onClick={close}>
      <div className="dialog small" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>{confirm.title ?? "Confirmation"}</h2>
        </div>
        <div className="dialog-body">
          <p className="dialog-text">{confirm.message}</p>
        </div>
        <div className="dialog-actions">
          <div className="spacer" />
          <button className="ghost" onClick={close}>
            Annuler
          </button>
          <button className={confirm.danger ? "danger" : "primary"} onClick={run} autoFocus>
            {confirm.confirmLabel ?? "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}
