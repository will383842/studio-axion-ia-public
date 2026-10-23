#!/usr/bin/env node
/**
 * Mémoire native, étape 2 : base SYNTHÉTIQUE aux tailles de la production du 17/10 (données INVENTÉES).
 *
 * À lancer sur une base qui a déjà démarré une fois (données de démonstration + migrations) : les documents de
 * démonstration servent de gabarits, des copies inventées sont ajoutées à côté (préfixe « syn- »). Rien n'est supprimé.
 *
 *   DATABASE_URL=postgresql://… node scripts/memoire-native/semer-base-synthetique.mjs [--actif] [--depenses 1500]
 *
 * Tailles visées (production) : travaux 63 / ~21 Mo (dont `parametres.tableau` de 1 à 5,6 Mo), versions 73 / ~6 Mo,
 * sousTitres 96 / ~1,7 Mo, videos 62 / ~0,9 Mo, plans 1077 / ~0,6 Mo.
 * `--actif` : ajoute UN travail en cours, volumineux (5,6 Mo de `parametres.tableau`), que son moteur renvoie inchangé
 * à chaque tour (fabrication image→vidéo « menée par le lanceur ») : comme un tableau en pause qui attend un rendu.
 * `--depenses N` (défaut 0) : N dépenses inventées sur les 90 derniers jours (une par appel Claude, voix, illustration…).
 * Petites (~0,8 Ko), elles ne pèsent rien dans les « grosses » collections, mais le budget les parcourt toutes.
 */
import pg from "pg";

const actif = process.argv.includes("--actif");
const iDep = process.argv.indexOf("--depenses");
const nDepenses = iDep >= 0 ? Number(process.argv[iDep + 1]) : 0;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let graine = 42;
const hasard = () => ((graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const MOTS = "vous collez vos fichiers clients dans le tableau avant après chiffre preuve scène encre page voix calage mot réseau fin appel douleur gain temps facture devis relance".split(" ");
const mot = () => MOTS[Math.floor(hasard() * MOTS.length)];
const phrase = (n) => Array.from({ length: n }, mot).join(" ");

/** État de tableau inventé d'environ `octets` (journal d'étapes, mots calés, scènes : beaucoup de petits objets). */
function tableau(octets) {
  const etat = { version: 3, atteinte: ["script", "voix", "calage", "scenes"], journal: [], audio: { mots: [] }, fiche: { scenes: [] } };
  let taille = 0;
  let i = 0;
  while (taille < octets) {
    const n = i++;
    if (n % 3 === 0) {
      const e = { etape: `scene-${n}`, le: new Date(1_790_000_000_000 + n * 1000).toISOString(), statut: "terminee", donnees: { texte: phrase(40), empreinte: n.toString(16).padStart(32, "0"), props: { x: hasard(), y: hasard(), titre: phrase(6) } } };
      etat.journal.push(e);
      taille += 450;
    } else if (n % 3 === 1) {
      for (let k = 0; k < 20; k++) etat.audio.mots.push({ mot: mot(), debutSec: n + k * 0.3, finSec: n + k * 0.3 + 0.28, conf: hasard() });
      taille += 20 * 75;
    } else {
      etat.fiche.scenes.push({ id: `sc-${n}`, ordre: n, texte: phrase(25), dessin: { invite: phrase(30), style: "encre", elements: [phrase(4), phrase(4), phrase(4)] } });
      taille += 600;
    }
  }
  return etat;
}

async function gabarit(collection) {
  const { rows } = await client.query("SELECT data FROM documents WHERE collection = $1 AND id NOT LIKE 'syn-%' ORDER BY id LIMIT 1", [collection]);
  if (!rows[0]) throw new Error(`Aucun document « ${collection} » de démonstration : démarrez le studio une fois d'abord.`);
  return rows[0].data;
}

async function ecrire(collection, doc) {
  await client.query(
    `INSERT INTO documents (collection, id, data, modifie_le) VALUES ($1, $2, $3, now())
     ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, modifie_le = now()`,
    [collection, doc.id, JSON.stringify(doc)],
  );
}

const g = {
  travail: await gabarit("travaux"),
  version: await gabarit("versions"),
  sousTitre: await gabarit("sousTitres"),
  video: await gabarit("videos"),
  plan: await gabarit("plans"),
  depense: await gabarit("depenses"),
};

// Dépenses : N petites, réparties sur 90 jours (Claude surtout, voix, illustrations).
const FOURNISSEURS = ["anthropic", "anthropic", "anthropic", "heygen", "fal"];
for (let i = 0; i < nDepenses; i++) {
  const date = new Date(Date.now() - Math.floor(hasard() * 90 * 86_400_000)).toISOString();
  const f = FOURNISSEURS[i % FOURNISSEURS.length];
  const c = 1 + Math.floor(hasard() * 300);
  const ligne = { ...g.depense.lignes[0], etape: `Étape inventée ${i % 13}`, fournisseur: f, nature: "reel", total: { devise: "EUR", centimes: c }, prixUnitaire: { devise: "EUR", centimes: c } };
  await ecrire("depenses", { ...g.depense, id: `syn-dep-${i}`, date, creeLe: date, modifieLe: date, estDemo: false, videoId: `syn-v-${i % 62}`, travailId: `syn-trav-${i % 63}`, total: { devise: "EUR", centimes: c }, lignes: [ligne] });
}

// Vidéos : 62 × ~15 Ko.
for (let i = 0; i < 62; i++) {
  await ecrire("videos", { ...g.video, id: `syn-v-${i}`, titre: `Vidéo inventée ${i}`, estDemo: false, notes: phrase(1700) });
}
// Versions : 73 × ~80 Ko (moteur de simulation).
for (let i = 0; i < 73; i++) {
  await ecrire("versions", { ...g.version, id: `syn-ver-${i}`, videoId: `syn-v-${i % 62}`, estDemo: false, remplissage: phrase(9000) });
}
// Sous-titres : 96 × ~18 Ko.
for (let i = 0; i < 96; i++) {
  await ecrire("sousTitres", { ...g.sousTitre, id: `syn-st-${i}`, videoId: `syn-v-${i % 62}`, estDemo: false, remplissage: phrase(1800) });
}
// Plans : 1077 × ~600 o.
for (let i = 0; i < 1077; i++) {
  await ecrire("plans", { ...g.plan, id: `syn-plan-${i}`, videoId: `syn-v-${i % 62}`, estDemo: false });
}
// Travaux : 63, ~21 Mo en tout ; les gros `parametres.tableau` de 1 à 5,6 Mo, tous TERMINÉS.
const MO = 1024 * 1024;
const gros = [5.6, 4.2, 3.1, 2.4, 1.8, 1.4, 1.1, 1.0].map((x) => Math.round(x * MO));
for (let i = 0; i < 63; i++) {
  const t = { ...g.travail, id: `syn-trav-${i}`, cibleId: `syn-v-${i % 62}`, versionId: `syn-ver-${i}`, statut: "termine", estDemo: false, parametres: { tableau: tableau(gros[i] ?? 4000) } };
  await ecrire("travaux", t);
}
if (actif) {
  // Le travail EN COURS : version au moteur image→vidéo, menée par le lanceur (le moteur le renvoie inchangé).
  await ecrire("versions", { ...g.version, id: "syn-ver-actif", videoId: "syn-v-0", estDemo: false, commande: { ...g.version.commande, moteurId: "montage-image-video" } });
  await ecrire("travaux", {
    ...g.travail,
    id: "syn-trav-actif",
    cibleId: "syn-v-0",
    versionId: "syn-ver-actif",
    statut: "en_cours",
    termineLe: undefined,
    reprise: undefined,
    estDemo: false,
    parametres: { lanceurIV: true, tableau: tableau(5.6 * MO) },
  });
}

const { rows } = await client.query("SELECT collection, count(*)::int AS n, round(sum(length(data::text)) / 1048576.0, 1)::float AS mo FROM documents GROUP BY 1 ORDER BY 3 DESC LIMIT 8");
console.table(rows);
await client.end();
