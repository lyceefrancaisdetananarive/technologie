// =====================================================================
// Fonctions partagées par l'espace élève et l'espace professeur.
// =====================================================================

/**
 * Réduit une photo avant l'envoi. Une photo de téléphone fait 4 Mo ;
 * réduite, elle en fait 200 Ko. Sur la liaison de Tananarive, c'est la
 * différence entre un dépôt qui aboutit et un dépôt qui expire.
 *
 * Effet de bord utile : le réencodage efface les métadonnées EXIF, donc
 * les coordonnées GPS que les téléphones inscrivent dans les photos.
 *
 * PIÈGE CONNU : sur certaines vieilles machines et certains pilotes
 * graphiques, canvas rend une image entièrement noire sans lever d'erreur.
 * On vérifie donc le résultat avant de le retenir, et on renvoie l'original
 * si le doute subsiste — mieux vaut un envoi lent qu'une page noire.
 */
export function reduireImage(fichier, cotéMax = 1600, qualite = 0.8) {
  return new Promise((resoudre) => {
    if (!fichier.type.startsWith('image/')) return resoudre(fichier);

    const url = URL.createObjectURL(fichier);
    const img = new Image();

    img.onerror = () => { URL.revokeObjectURL(url); resoudre(fichier); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const ech = Math.min(1, cotéMax / Math.max(img.width, img.height));
        if (ech === 1 && fichier.size < 600000) return resoudre(fichier);

        const c = document.createElement('canvas');
        c.width = Math.round(img.width * ech);
        c.height = Math.round(img.height * ech);
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, c.width, c.height);

        if (!imageValable(ctx, c)) return resoudre(fichier);

        c.toBlob((blob) => {
          // Si la réduction n'a rien gagné, on garde l'original.
          if (!blob || blob.size < 5000 || blob.size >= fichier.size) {
            return resoudre(fichier);
          }
          resoudre(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', qualite);
      } catch (e) {
        resoudre(fichier);
      }
    };
    img.src = url;
  });
}

/** L'image obtenue est-elle autre chose qu'un rectangle uniforme ? */
function imageValable(ctx, c) {
  try {
    const pas = Math.max(1, Math.floor(c.width / 12));
    const vus = new Set();
    for (let x = 0; x < c.width; x += pas) {
      for (let y = 0; y < c.height; y += pas) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        vus.add(`${p[0] >> 4},${p[1] >> 4},${p[2] >> 4}`);
        if (vus.size > 3) return true;   // assez de variété : c'est une image
      }
    }
    return false;   // uniforme : canvas a probablement échoué
  } catch {
    return true;    // en cas de doute (canvas bridé), on ne bloque pas
  }
}

/**
 * Envoi avec reprise. Une coupure de quelques secondes est la norme ici,
 * pas l'exception : réessayer trois fois évite de perdre le travail d'un
 * élève pour une microcoupure.
 */
export async function envoyerAvecReprise(url, options, essais = 3) {
  let derniere;
  for (let i = 0; i < essais; i++) {
    try {
      const r = await fetch(url, options);
      if (r.ok || (r.status >= 400 && r.status < 500)) return r;
      derniere = new Error(`HTTP ${r.status}`);
    } catch (e) {
      derniere = e;
    }
    if (i < essais - 1) await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
  }
  throw derniere;
}

/** Appel JSON vers nos propres fonctions. */
export async function api(chemin, options = {}) {
  const r = await fetch(chemin, {
    headers: { 'content-type': 'application/json' }, ...options,
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { location.href = '/connexion.html'; throw new Error('session'); }
  if (!r.ok) throw new Error(d.message || 'Le service ne répond pas.');
  return d;
}

export function dateCourte(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
    ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function echapper(t) {
  const d = document.createElement('div');
  d.textContent = t == null ? '' : String(t);
  return d.innerHTML;
}
