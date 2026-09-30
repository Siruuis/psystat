import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { listProjects, saveProject, loadProject, deleteProject, logout, type CloudProject } from "../lib/cloud";

export function CloudDialog({ email, onClose, onLoggedOut }: { email: string; onClose: () => void; onLoggedOut: () => void }) {
  const variables = useStore((s) => s.variables);
  const rows = useStore((s) => s.rows);
  const fileName = useStore((s) => s.fileName);
  const loadData = useStore((s) => s.loadData);
  const setNotice = useStore((s) => s.setNotice);
  const askConfirm = useStore((s) => s.askConfirm);

  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [name, setName] = useState(fileName || "Projet");
  const [busy, setBusy] = useState(false);

  const refresh = () => listProjects().then(setProjects).catch(() => setProjects([]));
  useEffect(() => {
    refresh();
  }, []);

  const save = async () => {
    if (!name.trim() || variables.length === 0) return;
    setBusy(true);
    try {
      await saveProject(name.trim(), variables, rows, fileName);
      setNotice(`Projet « ${name.trim()} » sauvegardé dans le cloud.`);
      refresh();
    } catch (e) {
      setNotice("Échec de la sauvegarde : " + String(e));
    }
    setBusy(false);
  };

  const load = async (p: CloudProject) => {
    try {
      const res = await loadProject(p.id);
      loadData(res.data.variables, res.data.rows, res.data.fileName || p.name);
      setNotice(`Projet « ${p.name} » chargé.`);
      onClose();
    } catch (e) {
      setNotice("Échec du chargement : " + String(e));
    }
  };

  const remove = (p: CloudProject) =>
    askConfirm({
      message: `Supprimer le projet cloud « ${p.name} » ?`,
      danger: true,
      confirmLabel: "Supprimer",
      onConfirm: async () => {
        await deleteProject(p.id);
        refresh();
      },
    });

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog cloud-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>Mes projets (cloud)</h2>
        </div>
        <div className="dialog-body">
          <div className="cloud-user">
            Connecté : <strong>{email}</strong>
            <button className="link-btn" onClick={() => logout().then(onLoggedOut)}>
              se déconnecter
            </button>
          </div>

          <div className="cloud-save">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du projet" />
            <button className="primary" disabled={busy || variables.length === 0} onClick={save}>
              Sauvegarder le projet actuel
            </button>
          </div>

          <div className="field-label" style={{ marginTop: 14 }}>
            Projets sauvegardés
          </div>
          <div className="cloud-list">
            {projects.length === 0 && <div className="var-empty">Aucun projet dans le cloud.</div>}
            {projects.map((p) => (
              <div className="cloud-row" key={p.id}>
                <div className="cloud-meta">
                  <span className="cloud-name">{p.name}</span>
                  <span className="cloud-sub">
                    {p.variables} variables · {p.rows} obs. · {new Date(p.savedAt).toLocaleString("fr-FR")}
                  </span>
                </div>
                <div className="cloud-actions">
                  <button className="ghost" onClick={() => load(p)}>
                    Charger
                  </button>
                  <button className="link-btn" onClick={() => remove(p)}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="dialog-actions">
          <div className="spacer" />
          <button className="ghost" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
