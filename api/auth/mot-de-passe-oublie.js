import { lire, ecrire, envoyerLienReinitialisation, configuree, origineLegitime, refus }
  from '../_lib/supabase.js';

// Réponse TOUJOURS identique, que l'adresse existe ou non. Sinon cette page
// devient un annuaire : on saisit une adresse et on apprend si elle a un
// compte. Sur un système qui n'héberge que des mineurs, c'est inacceptable.
const REPONSE = "Si cette adresse figure sur la liste d'accès, un message " +
  "vient de lui être envoyé. Ouvrez votre boîte sur mail.google.com " +
  "(expéditeur : Technologie LFT) et regardez aussi le dossier " +
  "« indésirables ». Si rien n'arrive dans deux minutes, vérifiez " +
  "l'orthographe de votre adresse, ou demandez un accès provisoire à " +
  "votre professeur.";

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, "Service non configuré.");
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  // Les espaces INTÉRIEURES aussi : « lea. rakoto@… » (espace glissée après
  // le point) n'est pas une autre adresse, c'est la même mal tapée.
  const email = String(req.body?.email ?? '').replace(/\s+/g, '').toLowerCase();
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
        // On envoie D'ABORD, et on ne note la demande qu'après un envoi
        // accepté. Notée avant, une demande refusée par Supabase (429 :
        // limite de /auth/v1/recover par adresse IP quand deux groupes
        // démarrent en même temps, relais SMTP saturé ; ou 5xx) fermait
        // le créneau de cinq minutes sur un courriel jamais parti, et rien
        // n'en gardait trace. La réponse à la personne ne change pas (même
        // message que l'adresse existe ou non) ; les journaux, eux, disent
        // le statut.
        const origine = `https://${req.headers.host}`;
        const statut = await envoyerLienReinitialisation(email, origine);
        if (statut >= 200 && statut < 300) {
          await ecrire('tentatives', '', { profil_id: p.id, origine: 'lien' }, 'POST').catch(() => {});
        } else {
          console.error('mot-de-passe-oublie : /auth/v1/recover a répondu', statut);
        }
      }
    }
  } catch (e) {
    console.error('mot-de-passe-oublie :', e.message);
    // On ne le dit pas non plus : même réponse en cas de panne.
  }
  res.status(200).json({ ok: true, message: REPONSE });
}
