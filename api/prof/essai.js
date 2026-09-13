import { appelant, possedeGroupe, reArmer } from '../_lib/autorisation.js';
import {
  lire, ecrire, creerUtilisateur, utilisateurParEmail, supprimerUtilisateur,
  supprimerFichier, configuree, origineLegitime, refus,
} from '../_lib/supabase.js';
import { UUID, NIVEAUX } from '../_lib/progression.js';

// =====================================================================
// UN GROUPE D'ESSAI, AVEC DES ÉLÈVES FICTIFS.
//
// Aucune donnée réelle d'élève n'entre dans le site avant l'autorisation de
// la direction et l'avis du DPO (décision 7). D'ici là, les quatre collègues
// essaient le plan de l'année, les coches et les exceptions sur un groupe
// fabriqué ici : six comptes dont l'adresse ne correspond à personne, et
// dont le nom dit ce qu'ils sont.
//
//   POST   {niveau}   crée « ESSAI-XXXXX » avec six élèves fictifs.
//   DELETE {groupe}   supprime un groupe d'essai ET ses élèves fictifs.
//
// LA SUPPRESSION NE S'APPLIQUE QU'AUX GROUPES D'ESSAI, reconnus à leur code
// exact (ESSAI- suivi des cinq caractères tirés ici, pas n'importe quel code
// qui commencerait par ESSAI-), et qu'aux comptes dont l'adresse suit le
// motif fictif. Si un élève réel a été inscrit dans le groupe, ou y a
// déposé un travail, la fonction REFUSE tout : le groupe emporterait ses
// dépôts en cascade (rendus.groupe_id, on delete cascade). Le professeur le
// retire d'abord dans « Groupes et comptes », comme le fait desinscrire.js.
// Le travail d'un mineur ne disparaît pas par une fonction.
// =====================================================================

const PREFIXE = 'ESSAI-';
const CODE_ESSAI = /^ESSAI-[A-Z2-9]{5}$/;
const EFFECTIF = 6;
const FICTIF = /^essai-[a-z0-9]{5}-[1-9]@eleve\.egd\.mg$/;

function suffixe() {
  // Lettres et chiffres sans ambiguïté à l'oral : pas de 0/O ni de 1/I/L.
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const alea = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(alea, (x) => alphabet[x % alphabet.length]).join('');
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return refus(res, 405, 'Méthode non autorisée.');
  }
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Réservé aux professeurs.');

  try {
    // ---- Créer -------------------------------------------------------------
    if (req.method === 'POST') {
      const niveau = String(req.body?.niveau ?? '5eme');
      if (!NIVEAUX.includes(niveau)) {
        return refus(res, 400, 'Niveau attendu : 5eme, 4eme ou 3eme.');
      }
      // Un seul groupe d'essai à la fois par professeur : le bouton se
      // trouve sur une page qu'on recharge, un double clic en créerait deux.
      const existants = await lire('groupes',
        `prof_id=eq.${moi.id}&code=like.${PREFIXE}*&select=id,code`);
      const deja = existants.find((g) => CODE_ESSAI.test(g.code));
      if (deja) {
        return res.status(200).json({ ok: true, groupe: deja, existant: true });
      }
      const s = suffixe();
      const code = `${PREFIXE}${s.toUpperCase()}`;
      const [g] = await ecrire('groupes', '', {
        code, libelle: `Groupe d'essai (élèves fictifs)`, niveau, prof_id: moi.id,
      }, 'POST');

      // Chaque élève : compte, profil, inscription. Sans transaction, chaque
      // préfixe est un état sûr : un groupe d'essai à quatre élèves au lieu
      // de six reste un groupe d'essai, et DELETE le nettoie entièrement.
      const eleves = [];
      for (let i = 1; i <= EFFECTIF; i++) {
        const email = `essai-${s}-${i}@eleve.egd.mg`;
        let id = await creerUtilisateur(email);
        if (!id) id = await utilisateurParEmail(email);
        if (!id) continue;
        await ecrire('profils', '', {
          id, email, role: 'eleve', prenom: 'Élève', nom: `Fictif ${i}`,
          actif: true, mdp_provisoire: true, mdp_pose_le: null,
        }, 'POST').catch((e) => { if (e.code !== '23505' && e.statut !== 409) throw e; });
        await ecrire('appartenances', '', { profil_id: id, groupe_id: g.id }, 'POST')
          .catch((e) => { if (e.code !== '23505' && e.statut !== 409) throw e; });
        eleves.push({ id, prenom: 'Élève', nom: `Fictif ${i}` });
      }

      if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
      return res.status(200).json({ ok: true, groupe: { ...g, eleves } });
    }

    // ---- Supprimer -----------------------------------------------------------
    const groupe = String(req.body?.groupe ?? '');
    if (!UUID.test(groupe)) return refus(res, 400, 'Groupe non précisé.');
    if (!(await possedeGroupe(moi.id, groupe))) {
      return refus(res, 403, "Ce groupe n'est pas le vôtre.");
    }
    const g = (await lire('groupes', `id=eq.${groupe}&select=id,code`))[0];
    if (!g || !CODE_ESSAI.test(g.code)) {
      return refus(res, 400, "Seul un groupe d'essai créé par ce bouton se supprime ici.");
    }

    // RIEN N'EST EFFACÉ TANT QU'UNE PERSONNE RÉELLE EST CONCERNÉE. On regarde
    // les membres ET les dépôts : un élève retiré du groupe plus tôt peut y
    // avoir laissé un travail, que la suppression du groupe emporterait.
    const [membres, depots] = await Promise.all([
      lire('appartenances', `groupe_id=eq.${groupe}&select=profil_id,profils(id,email)`),
      lire('rendus', `groupe_id=eq.${groupe}&select=id,fichier,profil_id,profils(email)`),
    ]);
    const fictif = (email) => FICTIF.test(String(email ?? '').toLowerCase());
    const reels = membres.filter((m) => !fictif(m.profils?.email)).length
      + depots.filter((d) => !fictif(d.profils?.email)).length;
    if (reels) {
      return refus(res, 409,
        'Ce groupe d’essai compte un élève réel, ou un travail déposé par un '
        + 'élève réel. Retirez-le d’abord dans « Groupes et comptes » : rien '
        + 'n’a été supprimé.');
    }

    // Les fichiers déposés par les comptes fictifs partent d'abord : la
    // suppression du compte emporte la ligne rendus, pas l'objet du stockage.
    for (const d of depots) {
      if (d.fichier) await supprimerFichier(d.fichier).catch(() => false);
    }

    // Puis les comptes. Si l'un résiste (GoTrue en erreur), le groupe est
    // CONSERVÉ : un nouvel appel reprendra le nettoyage là où il s'est arrêté.
    // Sans cela, le compte orphelin n'apparaîtrait plus nulle part, et
    // personne ne saurait qu'il existe encore.
    let effaces = 0;
    let echecs = 0;
    for (const m of membres) {
      if (await supprimerUtilisateur(m.profil_id)) effaces++; else echecs++;
    }
    if (echecs) {
      return refus(res, 500,
        `${effaces} compte(s) fictif(s) supprimé(s), ${echecs} en échec. `
        + 'Le groupe est conservé : relancez la suppression dans un instant.');
    }
    // Le groupe emporte plans, avancement et exceptions en cascade.
    await ecrire('groupes', `id=eq.${groupe}`, {}, 'DELETE');

    if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
    res.status(200).json({ ok: true, effaces });
  } catch (e) {
    console.error('essai :', e.message);
    refus(res, 500, req.method === 'POST'
      ? 'Le groupe d’essai n’a pas été créé.'
      : 'Le groupe d’essai n’a pas été supprimé.');
  }
}
