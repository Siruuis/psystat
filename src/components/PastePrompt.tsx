export function PastePrompt({
  rowCount,
  colCount,
  onChoose,
  onCancel,
}: {
  rowCount: number;
  colCount: number;
  onChoose: (withHeader: boolean) => void;
  onCancel: () => void;
}) {
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog small" onClick={(e) => e.stopPropagation()}>
        <h2>Coller des données</h2>
        <p className="dialog-text">
          Bloc collé : {rowCount} lignes × {colCount} colonnes.
          <br />
          La première ligne contient-elle les noms des variables ?
        </p>
        <div className="dialog-actions">
          <button className="ghost" onClick={onCancel}>
            Annuler
          </button>
          <button className="ghost" onClick={() => onChoose(false)}>
            Non, données brutes
          </button>
          <button className="primary" onClick={() => onChoose(true)}>
            Oui, ce sont les noms
          </button>
        </div>
      </div>
    </div>
  );
}
