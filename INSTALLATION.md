# Installer PsyStat

PsyStat est gratuit et fonctionne hors-ligne. Vos données ne quittent jamais votre ordinateur.

## Windows

1. Téléchargez `PsyStat-Setup-x.y.z.exe` (installeur) ou `PsyStat-x.y.z-portable.exe` (sans installation).
2. Au lancement, Windows peut afficher **« Windows a protégé votre ordinateur »** (SmartScreen).
   Ce n'est **pas** un virus : c'est simplement parce que l'application n'est pas signée par un
   certificat payant. Pour continuer :
   - Cliquez sur **« Informations complémentaires »**
   - Puis sur **« Exécuter quand même »**
3. C'est tout, PsyStat s'ouvre.

> Astuce : la version **portable** ne s'installe pas, elle se lance directement. Pratique sur les
> PC de la fac où l'on ne peut rien installer.

## macOS

1. Téléchargez `PsyStat-x.y.z.dmg`, ouvrez-le et glissez PsyStat dans Applications.
2. macOS affichera **« PsyStat ne peut pas être ouvert car le développeur ne peut pas être vérifié »**
   (Gatekeeper), pour la même raison (pas de signature Apple payante). Pour continuer :
   - **Clic droit** sur PsyStat → **Ouvrir** → **Ouvrir**
   - (ou Réglages Système → Confidentialité et sécurité → « Ouvrir quand même »)

## Pourquoi ces avertissements ?

Supprimer complètement l'avertissement nécessite un **certificat de signature de code payant**
(≈150-300 €/an sous Windows, 99 $/an chez Apple). Tant que le projet n'en a pas, l'avertissement
reste, mais l'application est parfaitement sûre : le code source est ouvert et vérifiable.
