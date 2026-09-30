import { useEffect, useRef, useState, type KeyboardEvent, type ClipboardEvent, type MouseEvent } from "react";
import { useStore } from "../state/store";
import { PastePrompt } from "./PastePrompt";
import { ContextMenu, type ContextItem } from "./ContextMenu";
import { writeClipboard } from "../lib/clipboard";

const GHOST_ROWS = 20;

function parseClipboard(text: string): string[][] {
  const lines = text.replace(/\r/g, "").split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines.map((l) => l.split("\t"));
}

export function DataView() {
  const variables = useStore((s) => s.variables);
  const rows = useStore((s) => s.rows);
  const selection = useStore((s) => s.selection);
  const setSelection = useStore((s) => s.setSelection);
  const setCellAuto = useStore((s) => s.setCellAuto);
  const pasteMatrix = useStore((s) => s.pasteMatrix);
  const renameVariable = useStore((s) => s.renameVariable);
  const deleteRange = useStore((s) => s.deleteRange);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const showValueLabels = useStore((s) => s.showValueLabels);
  const insertVariable = useStore((s) => s.insertVariable);
  const removeVariable = useStore((s) => s.removeVariable);
  const insertRow = useStore((s) => s.insertRow);
  const removeRow = useStore((s) => s.removeRow);
  const filterMask = useStore((s) => s.filterMask);
  const askConfirm = useStore((s) => s.askConfirm);
  const [ctx, setCtx] = useState<{ x: number; y: number; items: ContextItem[] } | null>(null);

  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingHeader, setEditingHeader] = useState<number | null>(null);
  const [pastePrompt, setPastePrompt] = useState<{ matrix: string[][]; r: number; c: number } | null>(null);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const ghostCols = variables.length === 0 ? 6 : 2;
  const totalCols = variables.length + ghostCols;
  const totalRows = rows.length + GHOST_ROWS;

  const rMin = Math.min(selection.ar, selection.fr);
  const rMax = Math.max(selection.ar, selection.fr);
  const cMin = Math.min(selection.ac, selection.fc);
  const cMax = Math.max(selection.ac, selection.fc);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editing]);

  const cellText = (r: number, c: number) => {
    if (c >= variables.length || r >= rows.length) return "";
    const v = rows[r][variables[c].name];
    return v == null ? "" : String(v);
  };

  const displayText = (r: number, c: number) => {
    const raw = cellText(r, c);
    if (!showValueLabels || raw === "" || c >= variables.length) return raw;
    return variables[c].labels[raw] ?? raw;
  };

  const focusGrid = () => containerRef.current?.focus();

  const move = (r: number, c: number, extend: boolean) => {
    const rr = Math.max(0, Math.min(r, totalRows - 1));
    const cc = Math.max(0, Math.min(c, totalCols - 1));
    setSelection(extend ? { ...selection, fr: rr, fc: cc } : { ar: rr, ac: cc, fr: rr, fc: cc });
  };

  const startEdit = (r: number, c: number, initial: string) => {
    setEditing({ r, c });
    setEditValue(initial);
  };

  const commitEdit = (advance: "down" | "right" | null) => {
    if (editing) {
      setCellAuto(editing.r, editing.c, editValue);
      const { r, c } = editing;
      setEditing(null);
      if (advance === "down") move(r + 1, c, false);
      else if (advance === "right") move(r, c + 1, false);
      requestAnimationFrame(focusGrid);
    }
  };

  const onCellMouseDown = (r: number, c: number, shift: boolean) => {
    if (editing) commitEdit(null);
    dragging.current = true;
    setSelection(shift ? { ...selection, fr: r, fc: c } : { ar: r, ac: c, fr: r, fc: c });
    requestAnimationFrame(focusGrid);
  };

  const onCellMouseEnter = (r: number, c: number) => {
    if (dragging.current) setSelection({ ...selection, fr: r, fc: c });
  };

  const selectColumn = (c: number) => {
    const last = Math.max(rows.length - 1, 0);
    setSelection({ ar: 0, ac: c, fr: last, fc: c });
    focusGrid();
  };

  const selectRow = (r: number) => {
    const last = Math.max(variables.length - 1, 0);
    setSelection({ ar: r, ac: 0, fr: r, fc: last });
    focusGrid();
  };

  const selectAll = () => {
    setSelection({ ar: 0, ac: 0, fr: Math.max(rows.length - 1, 0), fc: Math.max(variables.length - 1, 0) });
  };

  const buildTSV = () => {
    const out: string[] = [];
    for (let r = rMin; r <= rMax; r++) {
      const line: string[] = [];
      for (let c = cMin; c <= cMax; c++) line.push(cellText(r, c));
      out.push(line.join("\t"));
    }
    return out.join("\n");
  };

  const onCopy = (e: ClipboardEvent) => {
    if (editing) return;
    e.preventDefault();
    e.clipboardData.setData("text/plain", buildTSV());
  };

  const onCut = (e: ClipboardEvent) => {
    if (editing) return;
    e.preventDefault();
    e.clipboardData.setData("text/plain", buildTSV());
    deleteRange(rMin, cMin, rMax, cMax);
  };

  const onPaste = (e: ClipboardEvent) => {
    if (editing) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    const matrix = parseClipboard(text);
    if (matrix.length === 1 && matrix[0].length === 1) {
      setCellAuto(rMin, cMin, matrix[0][0]);
      return;
    }
    setPastePrompt({ matrix, r: rMin, c: cMin });
  };

  const applyPaste = (withHeader: boolean) => {
    if (!pastePrompt) return;
    const { matrix, r, c } = pastePrompt;
    if (withHeader) {
      const header = matrix[0];
      const body = matrix.slice(1);
      if (body.length) pasteMatrix(r, c, body);
      header.forEach((name, i) => {
        const clean = name.trim().replace(/\s+/g, "_");
        if (clean) renameVariable(c + i, clean);
      });
    } else {
      pasteMatrix(r, c, matrix);
    }
    setPastePrompt(null);
    focusGrid();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (editing) {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit("down");
      } else if (e.key === "Tab") {
        e.preventDefault();
        commitEdit("right");
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditing(null);
        focusGrid();
      }
      return;
    }

    const ctrl = e.ctrlKey || e.metaKey;
    const { fr, fc } = selection;

    if (ctrl && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
      return;
    }
    if (ctrl && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
      e.preventDefault();
      redo();
      return;
    }
    if (ctrl && e.key.toLowerCase() === "a") {
      e.preventDefault();
      selectAll();
      return;
    }
    if (ctrl && ["c", "x", "v"].includes(e.key.toLowerCase())) return;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        move(fr - 1, fc, e.shiftKey);
        return;
      case "ArrowDown":
        e.preventDefault();
        move(fr + 1, fc, e.shiftKey);
        return;
      case "ArrowLeft":
        e.preventDefault();
        move(fr, fc - 1, e.shiftKey);
        return;
      case "ArrowRight":
        e.preventDefault();
        move(fr, fc + 1, e.shiftKey);
        return;
      case "Tab":
        e.preventDefault();
        move(fr, fc + 1, false);
        return;
      case "Enter":
        e.preventDefault();
        move(fr + 1, fc, false);
        return;
      case "F2":
        e.preventDefault();
        startEdit(fr, fc, cellText(fr, fc));
        return;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        deleteRange(rMin, cMin, rMax, cMax);
        return;
    }

    if (e.key.length === 1 && !ctrl && !e.altKey) {
      startEdit(fr, fc, e.key);
    }
  };

  const pasteFromClipboard = async (r: number, c: number) => {
    let text = "";
    try {
      text = window.psystat?.clipboardRead ? window.psystat.clipboardRead() : await navigator.clipboard.readText();
    } catch {
      text = "";
    }
    if (!text) return;
    const matrix = parseClipboard(text);
    if (matrix.length === 1 && matrix[0].length === 1) setCellAuto(r, c, matrix[0][0]);
    else setPastePrompt({ matrix, r, c });
  };

  const onContextMenu = (e: MouseEvent, r: number, c: number) => {
    e.preventDefault();
    const inside = r >= rMin && r <= rMax && c >= cMin && c <= cMax;
    const a = inside ? rMin : r;
    const b = inside ? cMin : c;
    const a2 = inside ? rMax : r;
    const b2 = inside ? cMax : c;
    if (!inside) setSelection({ ar: r, ac: c, fr: r, fc: c });
    const rectTSV = () => {
      const out: string[] = [];
      for (let rr = a; rr <= a2; rr++) {
        const line: string[] = [];
        for (let cc = b; cc <= b2; cc++) line.push(cellText(rr, cc));
        out.push(line.join("\t"));
      }
      return out.join("\n");
    };
    const items: ContextItem[] = [
      { label: "Couper", onClick: () => { writeClipboard(rectTSV()); deleteRange(a, b, a2, b2); } },
      { label: "Copier", onClick: () => writeClipboard(rectTSV()) },
      { label: "Coller", onClick: () => pasteFromClipboard(a, b) },
      { label: "Effacer le contenu", onClick: () => deleteRange(a, b, a2, b2) },
      { separator: true },
      { label: "Insérer une variable", onClick: () => insertVariable(c) },
      { label: "Supprimer la variable", disabled: c >= variables.length, onClick: () =>
        askConfirm({ message: `Supprimer la variable « ${variables[c]?.name} » et toutes ses données ?`, danger: true, confirmLabel: "Supprimer", onConfirm: () => removeVariable(c) }) },
      { separator: true },
      { label: "Insérer une observation", onClick: () => insertRow(r) },
      { label: "Supprimer l'observation", disabled: r >= rows.length, onClick: () =>
        askConfirm({ message: `Supprimer l'observation n°${r + 1} ?`, danger: true, confirmLabel: "Supprimer", onConfirm: () => removeRow(r) }) },
    ];
    setCtx({ x: e.clientX, y: e.clientY, items });
  };

  const commitHeader = (index: number, value: string) => {
    if (value.trim()) renameVariable(index, value);
    setEditingHeader(null);
    focusGrid();
  };

  const activeName = variables[selection.fc]?.name ?? "";

  return (
    <div className="data-panel">
      <div className="cell-bar">
        <div className="cell-ref">{activeName || "—"}</div>
        <input
          className="cell-input"
          value={editing ? editValue : cellText(selection.fr, selection.fc)}
          placeholder="valeur de la cellule active"
          onChange={(e) => {
            if (!editing) startEdit(selection.fr, selection.fc, e.target.value);
            else setEditValue(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit("down");
            }
          }}
          onBlur={() => editing && commitEdit(null)}
        />
      </div>

      <div
        className="grid-wrap sheet"
        tabIndex={0}
        ref={containerRef}
        onKeyDown={onKeyDown}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        onMouseUp={() => (dragging.current = false)}
      >
        <table className="data-grid">
          <thead>
            <tr>
              <th className="rownum corner" onClick={selectAll}></th>
              {Array.from({ length: totalCols }, (_, c) => (
                <th
                  key={c}
                  className={`${c >= variables.length ? "ghost-head" : ""} ${c >= cMin && c <= cMax && c < variables.length ? "col-selected" : ""}`}
                  onClick={() => c < variables.length && selectColumn(c)}
                  onDoubleClick={() => c < variables.length && setEditingHeader(c)}
                  title={c < variables.length ? variables[c].name : ""}
                >
                  {editingHeader === c ? (
                    <input
                      autoFocus
                      defaultValue={variables[c].name}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => commitHeader(c, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitHeader(c, (e.target as HTMLInputElement).value);
                        if (e.key === "Escape") setEditingHeader(null);
                      }}
                    />
                  ) : c < variables.length ? (
                    variables[c].label || variables[c].name
                  ) : (
                    ""
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: totalRows }, (_, r) => (
              <tr key={r}>
                <td
                  className={`rownum ${r >= rMin && r <= rMax && r < rows.length ? "row-selected" : ""} ${filterMask && r < rows.length && !filterMask[r] ? "row-filtered" : ""}`}
                  onClick={() => selectRow(r)}
                >
                  {r + 1}
                </td>
                {Array.from({ length: totalCols }, (_, c) => {
                  const isEditing = editing?.r === r && editing?.c === c;
                  const inSel = r >= rMin && r <= rMax && c >= cMin && c <= cMax;
                  const isActive = selection.fr === r && selection.fc === c;
                  return (
                    <td
                      key={c}
                      className={`${inSel ? "sel" : ""} ${isActive ? "active" : ""}`}
                      onMouseDown={(e) => onCellMouseDown(r, c, e.shiftKey)}
                      onMouseEnter={() => onCellMouseEnter(r, c)}
                      onDoubleClick={() => startEdit(r, c, cellText(r, c))}
                      onContextMenu={(e) => onContextMenu(e, r, c)}
                    >
                      {isEditing ? (
                        <input
                          ref={editRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(null)}
                        />
                      ) : (
                        <span className="cell-text">{displayText(r, c)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ctx && <ContextMenu x={ctx.x} y={ctx.y} items={ctx.items} onClose={() => setCtx(null)} />}

      {pastePrompt && (
        <PastePrompt
          rowCount={pastePrompt.matrix.length}
          colCount={Math.max(...pastePrompt.matrix.map((m) => m.length))}
          onChoose={applyPaste}
          onCancel={() => {
            setPastePrompt(null);
            focusGrid();
          }}
        />
      )}
    </div>
  );
}
