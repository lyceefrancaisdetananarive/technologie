import { lire, ecrire, configuree, refus } from './_lib/supabase.js';

// SONDE TEMPORAIRE, SANS PARAMÈTRE. Elle crée un compte d'élève fictif à
// adresse fixe, obtient un jeton haché par l'API d'administration (aucun
// courriel envoyé), le passe dans /api/auth/changer-mot-de-passe exactement
// comme la page le ferait, vérifie que le rejeu est refusé, puis supprime le
// compte. Son pire résultat possible est son résultat attendu. À retirer
// dès le test fait.
const ADRESSE = 'sonde.premiere-connexion@eleve.egd.mg';

export default async function handler(req, res) {
  if (!configuree()) return refus(res, 503, 'non configuré');
  const BASE = process.env.SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adm = { apikey: SERVICE, authorization: `Bearer ${SERVICE}`,
                'content-type': 'application/json' };
  const hote = req.headers.host;
  const etapes = [];
  let id = null;

  const appelPage = (corps) => fetch(`https://${hote}/api/auth/changer-mot-de-passe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: `https://${hote}` },
    body: JSON.stringify(corps),
  });

  try {
    const l = await fetch(`${BASE}/auth/v1/admin/users?filter=${encodeURIComponent(ADRESSE)}`,
      { headers: adm }).then((r) => r.json());
    for (const u of (l.users ?? [])) {
      if (u.email === ADRESSE) {
        await fetch(`${BASE}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: adm });
        etapes.push('reliquat d’un essai précédent supprimé');
      }
    }

    const c = await fetch(`${BASE}/auth/v1/admin/users`, {
      method: 'POST', headers: adm,
      body: JSON.stringify({ email: ADRESSE, email_confirm: true,
        password: crypto.randomUUID() + crypto.randomUUID() }),
    });
    const cu = await c.json();
    id = cu.id ?? null;
    etapes.push(`1. compte sonde créé : ${c.status}`);
    if (!id) throw new Error('pas d’identifiant');

    await ecrire('profils', '', { id, email: ADRESSE, role: 'eleve', actif: true,
      mdp_provisoire: true, mdp_pose_le: null }, 'POST');
    etapes.push('2. profil créé (élève, provisoire)');

    const g = await fetch(`${BASE}/auth/v1/admin/generate_link`, {
      method: 'POST', headers: adm,
      body: JSON.stringify({ type: 'recovery', email: ADRESSE }),
    });
    const gl = await g.json();
    etapes.push(`3. generate_link : ${g.status}, hashed_token ${gl.hashed_token ? 'présent' : 'ABSENT'}`);

    const mdp = 'sonde-' + crypto.randomUUID();
    const a = await appelPage({ jeton: gl.hashed_token, nouveau: mdp });
    const aj = await a.json().catch(() => ({}));
    etapes.push(`4. changer-mot-de-passe : ${a.status} ${JSON.stringify(aj)}, `
      + `cookie ${a.headers.get('set-cookie') ? 'posé' : 'ABSENT'} (attendu 200 + cookie)`);

    const b = await appelPage({ jeton: gl.hashed_token, nouveau: mdp + 'x' });
    etapes.push(`5. rejeu du même jeton : ${b.status} (attendu 401)`);

    const v = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: process.env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ email: ADRESSE, password: mdp }),
    });
    etapes.push(`6. connexion avec le nouveau mot de passe : ${v.status} (attendu 200)`);

    const pr = (await lire('profils', `id=eq.${id}&select=mdp_provisoire,mdp_pose_le`))[0];
    etapes.push(`7. profil : provisoire=${pr?.mdp_provisoire}, pose_le ${pr?.mdp_pose_le ? 'renseigné' : 'NULL'} (attendu false, renseigné)`);
  } catch (e) {
    etapes.push('ERREUR ' + e.message);
  } finally {
    if (id) {
      const d = await fetch(`${BASE}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adm });
      etapes.push(`8. compte sonde supprimé : ${d.status}`);
    }
  }
  res.status(200).json({ etapes });
}
