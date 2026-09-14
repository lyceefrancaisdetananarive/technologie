import { lire, ecrire, envoyerLienReinitialisation, configuree, origineLegitime, refus }
  from '../_lib/supabase.js';

// Réponse TOUJOURS identique, que l'adresse existe ou non. Sinon cette page
// devient un annuaire : on saisit une adresse et on apprend si elle a un
// compte. Sur un système qui n'héberge que des mineurs, c'est inacceptable.
const REPONSE = "Si cette adresse figure sur la liste d'accès, un message " +
  "vient de lui être envoyé. Regardez aussi le dossier « indésirables ».";

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, "Service non configuré.");
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!email) return res.status(200).json({ ok: true, message: REPONSE });

  try {
    const p = (await lire('profils',
      `email=eq.${encodeURIComponent(email)}&select=id,actif`))[0];

    // On n'envoie que si la personne est sur la liste ET active, et au plus
    // une fois toutes les cinq minutes par compte : un lien en boucle est un
    // abus du relais de courriel, et la réponse reste la même dans tous les
    // cas pour ne rien dire de l'existence du compte.
    if (p && p.actif) {
      const depuis = new Date(Date.now() - 5 * 60000).toISOString();
      const recentes = await lire('tentatives',
        `profil_id=eq.${p.id}&origine=eq.lien&quand=gte.${depuis}&select=id`).catch(() => []);
      if (!recentes.length) {
        await ecrire('tentatives', '', { profil_id: p.id, origine: 'lien' }, 'POST').catch(() => {});
        const origine = `https://${req.headers.host}`;
        await envoyerLienReinitialisation(email, origine);
      }
    }
  } catch (e) {
    console.error('mot-de-passe-oublie :', e.message);
    // On ne le dit pas non plus : même réponse en cas de panne.
  }
  res.status(200).json({ ok: true, message: REPONSE });
}
