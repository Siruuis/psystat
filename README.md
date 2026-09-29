# PsyStat

**Logiciel d'analyse statistique pour la psychologie.**

PsyStat est une application de bureau (Windows / macOS / Linux) qui offre un environnement complet
d'analyse de données : éditeur type tableur, une soixantaine de procédures statistiques, et un
moteur de calcul Python validé (pingouin, scipy, statsmodels, scikit-learn). Vos données restent
**100 % en local** : rien n'est envoyé sur Internet.

> Développé à l'**Université Internationale de Rabat (UIR)** par un étudiant en 3ᵉ année.

---

## Fonctionnalités

### Éditeur de données façon tableur
- Vue **Données** et vue **Variables** (type, étiquette, mesure, valeurs, manquantes, rôle, alignement)
- Sélection de plages, copier/couper/coller vers et depuis Excel, clic droit, annuler/rétablir
- Import Excel / CSV, enregistrement de projet, export CSV
- Transformer : calculer une variable, recoder, recodage automatique, rang, compter
- Données : trier, transposer, sélectionner des observations (filtre), scinder le fichier, pondérer

### ~60 procédures statistiques
| Domaine | Procédures |
|---|---|
| Descriptives | Fréquences, Descriptives, Explorer, Tableaux croisés (Khi², Yates, Fisher, V de Cramér) |
| Comparaison de moyennes | Tests t (×3, avec Levene + Welch), ANOVA à un facteur, Moyennes |
| Modèle linéaire général | ANOVA factorielle (type III), mesures répétées (Greenhouse-Geisser), ANCOVA, MANOVA |
| Modèles avancés | Modèles linéaires généralisés, modèles mixtes, log-linéaire |
| Corrélation | Pearson, Spearman, Kendall, partielle |
| Régression | Linéaire (Bêta, VIF), logistique (classification, Nagelkerke), multinomiale, ordinale, Poisson, courbe |
| Classification | K-means, hiérarchique, discriminante, KNN, réseaux de neurones, arbres de décision |
| Réduction des dimensions | Analyse factorielle (EFA), ACP, correspondances, MDS |
| Fiabilité | Alpha de Cronbach, oméga de McDonald, statistiques par item |
| Non paramétriques | Mann-Whitney, Wilcoxon, Kruskal-Wallis, Friedman, Khi², binomial, K-S (Lilliefors), séries, McNemar, Cochran, signes |
| Bayésien | Test t et corrélation bayésiens (facteurs de Bayes) |
| Autres | Survie (Kaplan-Meier, Cox), séries temporelles (ARIMA, lissage), courbe ROC, contrôle qualité |
| Graphiques | Histogramme, barres, boîte à moustaches, nuage, Q-Q, P-P |

### Sorties
- Tableaux clairs et lisibles, copie vers Excel/Word en un clic
- Export des résultats en **Word et PDF au format APA** (prêts pour un mémoire)

---

## Installation (utilisateurs)

Téléchargez la dernière version depuis la page **[Releases](../../releases)**.

- **Windows** : `PsyStat-Setup-x.y.z.exe` (installeur) ou `PsyStat-x.y.z-portable.exe` (sans installation).
- **macOS** : `PsyStat-x.y.z.dmg`.
- **Linux** : `PsyStat-x.y.z.AppImage`.

> ⚠️ **Avertissement de sécurité au premier lancement** : l'application n'étant pas signée par un
> certificat payant, Windows (SmartScreen) et macOS (Gatekeeper) affichent un avertissement.
> Ce n'est **pas** un virus. Voir **[INSTALLATION.md](INSTALLATION.md)** pour la marche à suivre.

---

## Développement

Prérequis : **Node.js 18+** et **Python 3.10+**.

```bash
# Frontend
npm install

# Moteur Python
cd engine
python -m venv .venv
# Windows : .venv\Scripts\python -m pip install -r requirements.txt
# macOS/Linux : .venv/bin/python -m pip install -r requirements.txt
cd ..

# Lancer l'app (Vite + Electron + moteur Python)
npm run dev
```

### Fabriquer les installeurs

```bash
npm run dist        # installeur, réutilise le moteur déjà gelé (~2 min)
npm run freeze      # (re)geler le moteur Python avec PyInstaller (~15-20 min)
npm run dist:full   # geler + installeur (à faire quand le moteur Python change)
```

Les installeurs sont générés dans `release/`.

---

## Architecture

```
Interface (React + TypeScript + Vite)
        │  JSON via HTTP local (port dynamique)
Coquille desktop (Electron)
        │  lance
Moteur de calcul (Python : FastAPI + pingouin / scipy / statsmodels / scikit-learn / matplotlib)
```

En développement, le moteur tourne via l'environnement virtuel Python. En production, il est **figé**
avec PyInstaller (aucune installation de Python requise chez l'utilisateur).

---

## Licence

[MIT](LICENSE) — libre d'utilisation, de modification et de distribution.
