import { useStore } from "../state/store";
import type { ResultTable } from "../types";
import { writeClipboard } from "../lib/clipboard";

function tableToTSV(table: ResultTable): string {
  const head = table.columns.join("\t");
  const body = table.rows.map((r) => r.map((c) => (c == null ? "" : String(c))).join("\t"));
  return [table.title, head, ...body].join("\n");
}

function Table({ table }: { table: ResultTable }) {
  const setNotice = useStore((s) => s.setNotice);
  const copy = () => {
    writeClipboard(tableToTSV(table));
    setNotice("Tableau copié (collez dans Word ou Excel).");
  };
  return (
    <div className="result-table">
      <div className="result-table-head">
        <span className="result-table-title">{table.title}</span>
        <button className="link-btn" onClick={copy}>
          copier
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {table.columns.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className={ci === 0 ? "label-col" : ""}>
                    {cell == null ? "" : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.footnotes?.map((f, i) => (
        <div className="footnote" key={i}>
          {f}
        </div>
      ))}
    </div>
  );
}

function ApaBox({ text }: { text: string }) {
  const setNotice = useStore((s) => s.setNotice);
  const copy = () => {
    writeClipboard(text);
    setNotice("Phrase APA copiée (collez dans votre mémoire).");
  };
  return (
    <div className="apa-box">
      <div className="apa-head">
        <span className="apa-title">Phrase prête à citer (format APA)</span>
        <button className="link-btn" onClick={copy}>
          copier
        </button>
      </div>
      <p className="apa-text">{text}</p>
    </div>
  );
}

export function OutputView() {
  const results = useStore((s) => s.results);
  const clearResults = useStore((s) => s.clearResults);
  const askConfirm = useStore((s) => s.askConfirm);

  if (results.length === 0) {
    return <div className="empty">Les résultats de vos analyses apparaîtront ici.</div>;
  }

  return (
    <div className="output">
      <div className="output-toolbar">
        <button className="ghost" onClick={() =>
          askConfirm({ message: "Effacer tous les résultats affichés ?", danger: true, confirmLabel: "Effacer", onConfirm: clearResults })}>
          Effacer les résultats
        </button>
      </div>
      {results.map((r) => (
        <div className="result-block" key={r.id}>
          <div className="result-header">
            <h3>{r.title}</h3>
            <span className="result-time">{r.ranAt}</span>
          </div>
          {r.error ? (
            <div className="result-error">{r.error}</div>
          ) : (
            <>
              {r.tables?.map((t, i) => (
                <Table table={t} key={i} />
              ))}
              {r.images?.map((img, i) => (
                <div className="result-image" key={i}>
                  <div className="result-table-title">{img.title}</div>
                  <img src={img.src} alt={img.title} />
                </div>
              ))}
              {r.apa && <ApaBox text={r.apa} />}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
