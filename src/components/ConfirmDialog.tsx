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
      <div className="dialog confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-body">
          <div className={`confirm-icon ${confirm.danger ? "danger" : ""}`}>{confirm.danger ? "!" : "?"}</div>
          <div className="confirm-text">
            <h3>{confirm.title ?? "Confirmation"}</h3>
            <p>{confirm.message}</p>
          </div>
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
