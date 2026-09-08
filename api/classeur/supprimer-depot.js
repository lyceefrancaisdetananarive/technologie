import { appelant, possedeGroupe } from '../_lib/autorisation.js';
import {
  lire, ecrire, supprimerFichier, configuree, origineLegitime, refus,
} from '../_lib/supabase.js';

// =====================================================================
// SUPPRIMER UN DÉPÔT.
//
// Ce point d'entrée n'existait pas, et c'est ce qui rendait les dépôts
// fantômes indélébiles. preparer-depot.js crée la ligne AVANT le
// téléversement, avec « fichier » à null ; si l'envoi échoue, et sur cette
// liaison il échoue, la ligne reste. Le message affiché invite alors à
// réessayer, ce qui en crée une deuxième, puis une troisième. Personne ne
// pouvait les enlever : aucune fonction ici, et aucune politique de
// suppression en base, délibérément.
//
// QUI PEUT SUPPRIMER QUOI, ET POURQUOI CETTE LIMITE.
//
//  · L'ÉLÈVE supprime SON dépôt, tant qu'il n'est pas corrigé. Cela couvre
//    les deux besoins réels : le fantôme d'un envoi raté, et la photo floue
//    qu'il veut remplacer. Une fois le travail corrigé, il est verrouillé :
//    sinon un élève effacerait la trace d'une correction qui ne lui plaît
//    pas, et le professeur verrait son travail disparaître après l'avoir lu.
//
//  · LE PROFESSEUR ne supprime que les dépôts INCOMPLETS de ses élèves,
//    c'est-à-dire ceux qui ne portent aucun fichier. Il fait le ménage, il
//    ne détruit rien : un dépôt qui contient le travail d'un mineur ne
//    s'efface pas d'un clic, même par le professeur. Si un fichier doit
//    vraiment disparaître, cela relève d'une demande écrite, pas d'un bouton.
// =====================================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');

  const rendu = String(req.body?.rendu ?? '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(rendu)) {
    return refus(res, 400, 'Dépôt non précisé.');
  }

  try {
    const r = (await lire('rendus',
      `id=eq.${rendu}&select=id,profil_id,groupe_id,fichier,corrige_le`))[0];
    if (!r) return refus(res, 404, 'Dépôt introuvable.');

    if (moi.role === 'eleve') {
      if (r.profil_id !== moi.id) return refus(res, 403, 'Dépôt inconnu.');
      if (r.corrige_le) {
        return refus(res, 409,
          "Ce travail a déjà été corrigé : il ne peut plus être supprimé. " +
          "Parlez-en à votre professeur.");
      }
    } else {
      if (!(await possedeGroupe(moi.id, r.groupe_id))) {
        return refus(res, 403,
          "Ce dépôt n'a pas été fait dans l'un de vos groupes.");
      }
      if (r.fichier) {
        return refus(res, 409,
          "Ce dépôt contient un document. On ne supprime ici que les dépôts " +
          "restés vides après un envoi interrompu.");
      }
    }

    // Le fichier d'abord, la ligne ensuite. Une coupure entre les deux laisse
    // une ligne sans fichier, c'est-à-dire un fantôme que ce même point
    // d'entrée sait effacer. Dans l'ordre inverse, elle laisserait un fichier
    // sans ligne, donc plus rien pour le désigner : un objet orphelin dans le
    // stockage, invisible et impossible à retrouver.
    if (r.fichier) await supprimerFichier(r.fichier).catch(() => {});
    await ecrire('rendus', `id=eq.${rendu}`, {}, 'DELETE');

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('supprimer-depot :', e.message);
    refus(res, 500, "La suppression n'a pas abouti.");
  }
}
