# Déployer PsyStat sur un VPS

PsyStat est une **application 100 % statique** : tout le calcul se fait dans le navigateur (Pyodide).
Le serveur ne fait que **servir des fichiers**. Aucun backend, aucune base de données.

## Ce qu'il te faut

- Un **VPS** (le moins cher suffit : Hetzner CX22 ~4€/mois, Contabo, OVH, DigitalOcean…), Ubuntu/Debian.
- Un **nom de domaine** (ou un sous-domaine, ex : `psystat.ton-domaine.com`).
- Accès **SSH** au VPS.

## 1. Pointer le domaine vers le VPS

Chez ton registrar (ou ta zone DNS), crée un enregistrement **A** :

```
Type   Nom               Valeur (IP du VPS)
A      psystat           123.45.67.89
```

Attends quelques minutes que le DNS se propage.

## 2. Installer Caddy sur le VPS (HTTPS automatique)

```bash
sudo apt update && sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

## 3. Configurer Caddy

Copie le `deploy/Caddyfile` de ce repo dans `/etc/caddy/Caddyfile` sur le VPS, en remplaçant
`psystat.ton-domaine.com` par ton vrai domaine. Puis :

```bash
sudo mkdir -p /var/www/psystat
sudo systemctl reload caddy
```

Caddy obtient le certificat HTTPS tout seul (Let's Encrypt) au premier accès.

## 4. Construire et envoyer le site

Sur **ta machine** (là où tu développes) :

```bash
npm run build          # génère le dossier dist/
```

Puis envoie le contenu de `dist/` vers le VPS (remplace user@IP) :

```bash
# depuis la racine du projet
scp -r dist/* user@123.45.67.89:/var/www/psystat/
```

C'est tout : ouvre `https://psystat.ton-domaine.com` — PsyStat est en ligne. 🎉

## 5. Mettre à jour le site plus tard

À chaque nouvelle version :

```bash
npm run build
scp -r dist/* user@123.45.67.89:/var/www/psystat/
```

(Le cache est configuré pour que les utilisateurs reçoivent toujours la dernière version.)

## Notes

- **HTTPS obligatoire** : Pyodide et l'API presse-papier exigent un contexte sécurisé. Caddy s'en occupe.
- **Pyodide** télécharge Python + les bibliothèques (~15 Mo) depuis le CDN jsdelivr au premier chargement,
  puis les met en cache. Rien à héberger de ce côté.
- **RAM du VPS** : le serveur ne calcule rien, 1 Go de RAM suffit pour servir le site à de nombreux utilisateurs.
