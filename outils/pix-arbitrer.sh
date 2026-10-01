#!/bin/sh
# =====================================================================
# Arbitrer les rapprochements Pix douteux, au terminal.
#
#   sh outils/pix-arbitrer.sh [dossier-des-exports]
#
# L'outil pose, pour chaque cas douteux, la liste des noms tapes dans la
# campagne, et attend un numero. Ce que vous repondez est grave dans la
# colonne `appariement` : aucun import ulterieur n'y reviendra.
#
# POURQUOI CE LANCEUR EXISTE. Le dossier des exports porte un nom accentue
# (« E) PREPARER et ORGANISER la certification EFE »), et une ligne de
# commande accentue ne se tape pas sans peine. Le chemin vit donc ici, dans
# un fichier, et la commande a taper reste courte.
#
# Le dossier par defaut est celui du poste de Max. Donnez-en un autre en
# argument si les exports sont ailleurs.
# =====================================================================
set -e
cd "$(dirname "$0")/.."

DEFAUT="../E) PRÉPARER et ORGANISER la certification EFE/Releve-Pix-2026-10-01"
DOSSIER="${1:-$DEFAUT}"

if [ ! -d "$DOSSIER/exports" ]; then
  echo "Dossier introuvable : $DOSSIER/exports" >&2
  echo "Donnez le dossier en argument : sh outils/pix-arbitrer.sh <dossier>" >&2
  exit 1
fi

SUPABASE_URL="https://bumyriwwysycbrngtzhk.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="$(security find-generic-password -a technologie -s supabase-service-role -w)" \
exec python3 outils/importer-pix.py "$DOSSIER/exports" --classes="$DOSSIER/classes.json" --trancher
