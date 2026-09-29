import { useEffect, useRef, useState } from "react";
import { useStore } from "./state/store";
import { importFile } from "./lib/importFile";
import { engineHealth } from "./lib/engine";
import { saveProject, openProject, exportCsv } from "./lib/projectFile";
import { exportWord, exportPdf } from "./lib/exportResults";
import { selectionToTSV, writeClipboard } from "./lib/clipboard";
import { ANALYSES, ANALYSIS_GROUPS, GRAPH_GROUP, analysisById, analysesInGroup, type AnalysisDef } from "./lib/analyses";
import { MenuBar, type Menu } from "./components/MenuBar";
import { Toolbar, type ToolButton } from "./components/Toolbar";
import { DataView } from "./components/DataView";
import { VariableView } from "./components/VariableView";
import { OutputView } from "./components/OutputView";
import { AnalysisDialog } from "./components/AnalysisDialog";
import { ComputeDialog } from "./components/ComputeDialog";
import { RecodeDialog } from "./components/RecodeDialog";
import { SortDialog } from "./components/SortDialog";
import { SelectCasesDialog } from "./components/SelectCasesDialog";
import { TransformDialog, type TransformMode } from "./components/TransformDialog";
import { FindDialog } from "./components/FindDialog";
import { PickVariableDialog } from "./components/PickVariableDialog";
import { Toast } from "./components/Toast";

type Tab = "data" | "variables" | "output";
type Dialog =
  | { type: "analysis"; def: AnalysisDef }
  | { type: "compute" }
  | { type: "recode" }
  | { type: "sort" }
  | { type: "selectcases" }
  | { type: "transform"; mode: TransformMode }
  | { type: "find" }
  | { type: "split" }
  | { type: "weight" }
  | null;

export default function App() {
  const [tab, setTab] = useState<Tab>("data");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [engineOk, setEngineOk] = useState<boolean | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);

  const variables = useStore((s) => s.variables);
  const rows = useStore((s) => s.rows);
  const running = useStore((s) => s.running);
  const showValueLabels = useStore((s) => s.showValueLabels);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const fileName = useStore((s) => s.fileName);
  const filterMask = useStore((s) => s.filterMask);
  const splitVar = useStore((s) => s.splitVar);
  const weightVar = useStore((s) => s.weightVar);

  useEffect(() => {
    engineHealth().then(setEngineOk);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        if (useStore.getState().variables.length) setDialog({ type: "find" });
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const s = useStore.getState();
        if (s.variables.length) saveProject(s.fileName, s.variables, s.rows);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const store = useStore.getState;
  const notify = (m: string) => useStore.getState().setNotice(m);
  const hasData = variables.length > 0;

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { variables, rows } = await importFile(file);
    store().loadData(variables, rows, file.name.replace(/\.[^.]+$/, ""));
    setTab("data");
    e.target.value = "";
  };

  const onOpenProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { variables, rows } = await openProject(file);
      store().loadData(variables, rows, file.name.replace(/\.[^.]+$/, ""));
      setTab("data");
      notify("Projet ouvert.");
    } catch {
      notify("Fichier de projet illisible.");
    }
    e.target.value = "";
  };

  const copySelection = () => {
    const s = store();
    writeClipboard(selectionToTSV(s.variables, s.rows, s.selection));
    notify("Copié dans le presse-papier.");
  };

  const cutSelection = () => {
    const s = store();
    writeClipboard(selectionToTSV(s.variables, s.rows, s.selection));
    const { ar, ac, fr, fc } = s.selection;
    s.deleteRange(Math.min(ar, fr), Math.min(ac, fc), Math.max(ar, fr), Math.max(ac, fc));
  };

  const insertVarAtSel = () => store().insertVariable(store().selection.fc);
  const insertRowAtSel = () => store().insertRow(store().selection.fr);
  const quickSort = (asc: boolean) => store().sortByColumn(store().selection.fc, asc);

  const variableInfo = () => {
    const s = store();
    if (!s.variables.length) return notify("Aucune variable.");
    s.addResult({
      title: "Informations sur les variables",
      tables: [
        {
          title: "Récapitulatif des variables",
          columns: ["Nom", "Type", "Étiquette", "Mesure", "Étiquettes de valeurs", "Manquantes"],
          rows: s.variables.map((v) => [
            v.name,
            v.type === "numeric" ? "Numérique" : "Chaîne",
            v.label || "",
            v.measure,
            Object.keys(v.labels).length ? `${Object.keys(v.labels).length}` : "",
            v.missing.length ? v.missing.join(", ") : "",
          ]),
        },
      ],
    });
    setTab("output");
  };

  const analysisItem = (def: AnalysisDef) => ({
    label: def.title,
    disabled: !hasData,
    onClick: () => setDialog({ type: "analysis", def }),
  });

  const menus: Menu[] = [
    {
      label: "Fichier",
      items: [
        { label: "Nouveau", shortcut: "", onClick: () => { store().newDataset(); setTab("data"); } },
        { label: "Ouvrir un projet…", onClick: () => projectInput.current?.click() },
        { label: "Importer Excel / CSV…", onClick: () => fileInput.current?.click() },
        { separator: true },
        { label: "Enregistrer le projet", onClick: () => saveProject(store().fileName, store().variables, store().rows), disabled: !hasData },
        { label: "Exporter les données (CSV)", onClick: () => exportCsv(store().fileName, store().variables, store().rows), disabled: !hasData },
        { separator: true },
        { label: "Exporter les résultats en Word (APA)…", onClick: () => {
            const r = store().results;
            if (!r.length) return notify("Aucun résultat à exporter.");
            exportWord(store().fileName, r);
          } },
        { label: "Exporter les résultats en PDF (APA)…", onClick: () => {
            const r = store().results;
            if (!r.length) return notify("Aucun résultat à exporter.");
            exportPdf(store().fileName, r);
          } },
      ],
    },
    {
      label: "Édition",
      items: [
        { label: "Annuler", shortcut: "Ctrl+Z", onClick: () => store().undo(), disabled: !canUndo },
        { label: "Rétablir", shortcut: "Ctrl+Y", onClick: () => store().redo(), disabled: !canRedo },
        { separator: true },
        { label: "Copier", shortcut: "Ctrl+C", onClick: copySelection, disabled: !hasData },
        { label: "Couper", shortcut: "Ctrl+X", onClick: cutSelection, disabled: !hasData },
        { label: "Coller", shortcut: "Ctrl+V", onClick: () => notify("Placez-vous dans la grille et faites Ctrl+V.") },
        { separator: true },
        { label: "Rechercher…", shortcut: "Ctrl+F", onClick: () => setDialog({ type: "find" }), disabled: !hasData },
      ],
    },
    {
      label: "Affichage",
      items: [
        { label: `${showValueLabels ? "✓ " : ""}Étiquettes de valeurs`, onClick: () => store().toggleValueLabels() },
        { label: "Données", onClick: () => setTab("data") },
        { label: "Variables", onClick: () => setTab("variables") },
        { label: "Résultats", onClick: () => setTab("output") },
      ],
    },
    {
      label: "Données",
      items: [
        { label: "Insérer une variable", onClick: insertVarAtSel, disabled: !hasData },
        { label: "Insérer une observation", onClick: insertRowAtSel, disabled: !hasData },
        { separator: true },
        { label: "Trier les observations…", onClick: () => setDialog({ type: "sort" }), disabled: !hasData },
        { label: "Transposer", onClick: () => { store().transpose(); notify("Données transposées."); }, disabled: !hasData },
        { separator: true },
        { label: "Sélectionner des observations…", onClick: () => setDialog({ type: "selectcases" }), disabled: !hasData },
        { label: "Retirer le filtre", onClick: () => { store().clearFilter(); notify("Filtre retiré."); }, disabled: !hasData },
        { separator: true },
        { label: "Scinder le fichier…", onClick: () => setDialog({ type: "split" }), disabled: !hasData },
        { label: "Pondérer les observations…", onClick: () => setDialog({ type: "weight" }), disabled: !hasData },
      ],
    },
    {
      label: "Transformer",
      items: [
        { label: "Calculer une variable…", onClick: () => setDialog({ type: "compute" }), disabled: !hasData },
        { label: "Recoder en une variable différente…", onClick: () => setDialog({ type: "recode" }), disabled: !hasData },
        { label: "Recodage automatique…", onClick: () => setDialog({ type: "transform", mode: "autorecode" }), disabled: !hasData },
        { label: "Rang des observations…", onClick: () => setDialog({ type: "transform", mode: "rank" }), disabled: !hasData },
        { label: "Compter les occurrences…", onClick: () => setDialog({ type: "transform", mode: "count" }), disabled: !hasData },
      ],
    },
    {
      label: "Analyser",
      items: ANALYSIS_GROUPS.map((group) => ({
        label: group,
        submenu: ANALYSES.filter((a) => a.group === group).map(analysisItem),
      })),
    },
    {
      label: "Graphiques",
      items: analysesInGroup(GRAPH_GROUP).map(analysisItem),
    },
    {
      label: "Utilitaires",
      items: [{ label: "Informations sur les variables", onClick: variableInfo, disabled: !hasData }],
    },
    {
      label: "Aide",
      items: [
        { label: "À propos de PsyStat", onClick: () => notify("PsyStat — analyse statistique pour la psychologie. Université Internationale de Rabat.") },
      ],
    },
  ];

  const tools: ToolButton[] = [
    { icon: "new", title: "Nouveau", onClick: () => { store().newDataset(); setTab("data"); } },
    { icon: "open", title: "Ouvrir un projet", onClick: () => projectInput.current?.click() },
    { icon: "save", title: "Enregistrer le projet", onClick: () => saveProject(store().fileName, store().variables, store().rows), disabled: !hasData, separatorAfter: true },
    { icon: "undo", title: "Annuler", onClick: () => store().undo(), disabled: !canUndo },
    { icon: "redo", title: "Rétablir", onClick: () => store().redo(), disabled: !canRedo, separatorAfter: true },
    { icon: "insertCol", title: "Insérer une variable", onClick: insertVarAtSel, disabled: !hasData },
    { icon: "insertRow", title: "Insérer une observation", onClick: insertRowAtSel, disabled: !hasData, separatorAfter: true },
    { icon: "sortAsc", title: "Trier (croissant)", onClick: () => quickSort(true), disabled: !hasData },
    { icon: "sortDesc", title: "Trier (décroissant)", onClick: () => quickSort(false), disabled: !hasData, separatorAfter: true },
    { icon: "labels", title: "Afficher les étiquettes de valeurs", onClick: () => store().toggleValueLabels(), active: showValueLabels },
    { icon: "compute", title: "Calculer une variable", onClick: () => setDialog({ type: "compute" }), disabled: !hasData, separatorAfter: true },
    { icon: "run", title: "Descriptives rapides", onClick: () => { const d = analysisById("descriptives"); if (d) setDialog({ type: "analysis", def: d }); }, disabled: !hasData },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <div className="titlebar">
          <span className="brand">PsyStat</span>
          <span className="file-name">— {fileName}</span>
          <div className="spacer" />
          <div className={`engine-badge ${engineOk ? "ok" : engineOk === false ? "ko" : ""}`}>
            {engineOk == null ? "Moteur…" : engineOk ? "Moteur connecté" : "Moteur hors ligne"}
          </div>
        </div>
        <MenuBar menus={menus} />
        <Toolbar buttons={tools} />
      </header>

      <nav className="tabs">
        <button className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}>
          Données
        </button>
        <button className={tab === "variables" ? "active" : ""} onClick={() => setTab("variables")}>
          Variables
        </button>
        <button className={tab === "output" ? "active" : ""} onClick={() => setTab("output")}>
          Résultats
        </button>
        <div className="tab-info">
          {variables.length} variables · {rows.length} observations
          {filterMask && (
            <span className="filter-badge"> · filtre actif ({filterMask.filter(Boolean).length}/{rows.length})</span>
          )}
          {splitVar && <span className="split-badge"> · scindé par {splitVar}</span>}
          {weightVar && <span className="split-badge"> · pondéré par {weightVar}</span>}
          {running && <span className="running"> · calcul en cours…</span>}
        </div>
      </nav>

      <main className="content">
        {tab === "data" && <DataView />}
        {tab === "variables" && <VariableView />}
        {tab === "output" && <OutputView />}
      </main>

      {dialog?.type === "analysis" && <AnalysisDialog def={dialog.def} onClose={() => setDialog(null)} />}
      {dialog?.type === "compute" && <ComputeDialog onClose={() => setDialog(null)} />}
      {dialog?.type === "recode" && <RecodeDialog onClose={() => setDialog(null)} />}
      {dialog?.type === "sort" && <SortDialog onClose={() => setDialog(null)} />}
      {dialog?.type === "selectcases" && <SelectCasesDialog onClose={() => setDialog(null)} />}
      {dialog?.type === "transform" && <TransformDialog mode={dialog.mode} onClose={() => setDialog(null)} />}
      {dialog?.type === "find" && <FindDialog onClose={() => setDialog(null)} />}
      {dialog?.type === "split" && (
        <PickVariableDialog
          title="Scinder le fichier"
          label="Analyser séparément pour chaque groupe de :"
          current={splitVar}
          onChoose={(n) => { store().setSplit(n); notify(n ? `Fichier scindé par ${n}.` : "Scission retirée."); }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "weight" && (
        <PickVariableDialog
          title="Pondérer les observations"
          label="Variable de pondération (fréquences) :"
          current={weightVar}
          onChoose={(n) => { store().setWeight(n); notify(n ? `Observations pondérées par ${n}.` : "Pondération retirée."); }}
          onClose={() => setDialog(null)}
          filter={(name) => useStore.getState().variables.find((v) => v.name === name)?.type === "numeric"}
        />
      )}

      <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={onImport} />
      <input ref={projectInput} type="file" accept=".psystat,.json" style={{ display: "none" }} onChange={onOpenProject} />
      <Toast />
    </div>
  );
}
