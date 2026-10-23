/**
 * PREUVE DU LOT M0b (A1) — la vraie voix HeyGen de Will, par le code du studio (`fournisseurs/heygen/voix.ts`).
 *
 *   pnpm exec tsx outils/voix-heygen/preuve-m0b.mts [chemin du fichier de clés]
 *   pnpm exec tsx outils/voix-heygen/preuve-m0b.mts --analyser     (aucun appel : refait les mesures sur les sons gardés)
 *
 * - La clé `HEYGEN_API_KEY` est lue dans le fichier de clés (par défaut `~/.claude/secrets/studio.env`), jamais
 *   affichée ni écrite. Appels faits : `GET /v3/voices?type=private` (gratuit), `GET /v3/users/me` (gratuit, solde
 *   avant / après) et `POST /v3/voices/speech` sur les PHRASES ci-dessous (quelques centimes). Aucune vidéo, aucun look.
 * - Sorties dans `docs/captures/m0b-voix/` : le son de chaque phrase (tel que HeyGen le sert), sa réponse (horodatage
 *   des mots) et `preuve.json` (coût relevé sur le solde, débit en mots/s et syllabes/s, respirations, contrôle de
 *   l'horodatage sur le son).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { creerClientHeygen, mimeDepuisOctets } from "../../src/fournisseurs/heygen/client";
import { creerFournisseurVoixHeygen } from "../../src/fournisseurs/heygen/voix";
import { stockageSimulation } from "../../src/fournisseurs/simulation/autres";
import { PRONONCIATIONS_DEPART, substituerPrononciations } from "../../src/domaine/prononciations";
import { decoderPcm, detecterRespirations, niveauDb } from "../../studio-rendu/src/audio/pcm";
// Essai sur ce poste (entrées servies par 127.0.0.1) : mode essai EXPLICITE de studio-rendu (relecture sécurité R45).
process.env.STUDIO_RENDU_ESSAI ??= "1";

const ANALYSER_SEULEMENT = process.argv.includes("--analyser");
const FICHIER_CLES = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? join(homedir(), ".claude", "secrets", "studio.env");
const SORTIE = join(process.cwd(), "docs", "captures", "m0b-voix");
const NOM_VOIX_WILL = /^DJI_04/;
const FREQ = 48_000;

/** Test d'écoute (BRANCHEMENTS A1) : sons proches, montant, nom propre ; puis une phrase avant / après les prononciations. */
const PHRASES: { id: string; texte: string; prononciations?: boolean }[] = [
  { id: "1-sons-proches", texte: "Un bon PV, puis un pépin : voilà comment tout commence." },
  { id: "2-montant", texte: "Cette amende de 135 € peut être contestée sous 45 jours." },
  { id: "3-nom-propre", texte: "Williams Jullin, d'Axion-IA, vous explique tout cela simplement." },
  { id: "4-avant", texte: "Chez Axion-IA, nous préparons votre RGPD et vos PV." },
  { id: "5-apres", texte: "Chez Axion-IA, nous préparons votre RGPD et vos PV.", prononciations: true },
];

type Mot = { mot: string; debutSec: number; finSec: number };

function lireCle(): string {
  const ligne = readFileSync(FICHIER_CLES, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("HEYGEN_API_KEY="));
  const cle = ligne?.slice("HEYGEN_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  if (!cle) throw new Error("HEYGEN_API_KEY absente du fichier de clés.");
  return cle;
}

/** Syllabes orales approchées : groupes de voyelles (« eau », « ou », « ai » = 1), e muet final retiré. */
function syllabes(mot: string): number {
  const m = mot
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
  if (!m) return 0;
  return Math.max(1, m.replace(/e(s|nt)?$/, "").match(/[aeiouy]+/g)?.length ?? 0);
}

/**
 * Contrôle de l'horodatage sur le son (sans WhisperX) : autour de chaque blanc annoncé ≥ 150 ms entre deux mots, on
 * cherche dans le son où la voix s'arrête et où elle reprend (fenêtres de 10 ms, seuil −35 dB), et on compare aux temps
 * annoncés. Écart positif : HeyGen annonce trop tard.
 */
function ecartsAuxBlancs(x: Float32Array, mots: Mot[]): { attaques: number[]; fins: number[] } {
  // Silences réels du son : au moins 100 ms continues sous −35 dB (fenêtres de 10 ms).
  const pas = 0.01;
  const silences: { debutSec: number; finSec: number }[] = [];
  let debut: number | null = null;
  for (let t = 0; t < x.length / FREQ; t += pas) {
    const calme = niveauDb(x, { debutSec: t, finSec: t + pas }, FREQ) <= -35;
    if (calme && debut === null) debut = t;
    if (!calme && debut !== null) {
      if (t - debut >= 0.1) silences.push({ debutSec: debut, finSec: t });
      debut = null;
    }
  }
  const attaques: number[] = [];
  const fins: number[] = [];
  for (let i = 1; i < mots.length; i++) {
    const a = mots[i - 1].finSec;
    const b = mots[i].debutSec;
    if (b - a < 0.15) continue;
    // Le silence réel le plus proche du blanc annoncé (centre à centre, à moins de 0,8 s).
    const centre = (a + b) / 2;
    const proche = silences.reduce<{ debutSec: number; finSec: number } | null>((m, s) => (!m || Math.abs((s.debutSec + s.finSec) / 2 - centre) < Math.abs((m.debutSec + m.finSec) / 2 - centre) ? s : m), null);
    if (!proche || Math.abs((proche.debutSec + proche.finSec) / 2 - centre) > 0.8) continue;
    fins.push(Math.round((a - proche.debutSec) * 1000));
    attaques.push(Math.round((b - proche.finSec) * 1000));
  }
  return { attaques, fins };
}

/** Début réel de la voix comparé au premier mot annoncé (ms ; positif = annoncé trop tard). */
function ecartPremierMot(x: Float32Array, mots: Mot[]): number | null {
  if (!mots.length) return null;
  for (let t = 0; t < x.length / FREQ; t += 0.01) if (niveauDb(x, { debutSec: t, finSec: t + 0.01 }, FREQ) > -35) return Math.round((mots[0].debutSec - t) * 1000);
  return null;
}

const moyenneAbs = (l: number[]) => (l.length ? Math.round(l.reduce((s, e) => s + Math.abs(e), 0) / l.length) : null);

/** Mesures d'une phrase depuis ses fichiers gardés (son + réponse HeyGen). */
async function mesurer(id: string, texte: string) {
  const fichier = [".mp3", ".wav"].map((e) => join(SORTIE, `${id}${e}`)).find(existsSync);
  if (!fichier) throw new Error(`Son introuvable pour ${id}.`);
  const { mots, dureeSec, texte: texteDit } = JSON.parse(readFileSync(join(SORTIE, `${id}.heygen.json`), "utf8")) as { mots: Mot[]; dureeSec: number; texte: string };
  const x = await decoderPcm(fichier);
  const parole = mots.length ? mots.at(-1)!.finSec - mots[0].debutSec : 0;
  const blancs = mots
    .slice(1)
    .map((m, i) => ({ debutSec: mots[i].finSec, finSec: m.debutSec }))
    .filter((b) => b.finSec - b.debutSec >= 0.12);
  const { attaques, fins } = ecartsAuxBlancs(x, mots);
  return {
    id,
    texte,
    texteDit,
    caracteres: texteDit.length,
    dureeSec,
    mots: mots.length,
    motsParSeconde: +(mots.length / parole).toFixed(2),
    syllabesParSeconde: +(mots.reduce((s, m) => s + syllabes(m.mot), 0) / parole).toFixed(2),
    blancsDe120msOuPlus: blancs.length,
    respirations: detecterRespirations(x, blancs).length,
    ecartPremierMotMs: ecartPremierMot(x, mots),
    ecartAttaquesMs: attaques,
    ecartFinsMs: fins,
  };
}

async function appelsReels(): Promise<Record<string, unknown>> {
  const client = creerClientHeygen({ cle: lireCle() });
  const voix = creerFournisseurVoixHeygen({ client, stockage: () => stockageSimulation, environnement: "dev" });
  const solde = async () => (await client.requete<{ wallet?: { remaining_balance?: number } }>("GET", "/v3/users/me")).wallet?.remaining_balance ?? NaN;
  const liste = await voix.listerVoixExistantes();
  const will = liste.find((v) => NOM_VOIX_WILL.test(v.nom));
  if (!will) throw new Error("La voix de Will (« DJI_04… ») est introuvable chez HeyGen.");
  if (!will.utilisable) throw new Error("La voix de Will ne sait pas produire un son seul.");
  console.log(`Voix trouvée : ${will.nom} (${will.typeClone}, ${will.langue}).`);
  const soldeAvant = await solde();
  let caracteres = 0;
  for (const p of PHRASES) {
    const prononciations = p.prononciations ? PRONONCIATIONS_DEPART : [];
    const r = await voix.lire({ idExterne: will.idExterne, texte: p.texte, reglages: { vitesse: 1, stabilite: 60, emotion: 50 }, prononciations });
    // Son téléchargé aussitôt (l'adresse HeyGen est temporaire), rangé sous son VRAI type (HeyGen sert du MP3 en « .wav »).
    const { octets } = await client.telecharger(r.fichierCle);
    writeFileSync(join(SORTIE, `${p.id}.${mimeDepuisOctets(octets) === "audio/wav" ? "wav" : "mp3"}`), octets);
    const texteDit = p.prononciations ? substituerPrononciations(p.texte, prononciations) : p.texte;
    caracteres += texteDit.length;
    writeFileSync(join(SORTIE, `${p.id}.heygen.json`), JSON.stringify({ texte: texteDit, mots: r.mots, dureeSec: r.dureeSec, coutAnnonce: r.cout }, null, 2));
    console.log(`${p.id} : ${r.dureeSec.toFixed(2)} s, ${r.mots.length} mots horodatés.`);
  }
  // Le solde se met à jour en quelques secondes.
  await new Promise((ok) => setTimeout(ok, 5000));
  const soldeApres = await solde();
  return {
    date: new Date().toISOString(),
    voix: { nom: will.nom, typeClone: will.typeClone, langue: will.langue, moteur: "starfish" },
    appels: { liste: "GET /v3/voices?type=private", parole: `POST /v3/voices/speech × ${PHRASES.length}`, solde: "GET /v3/users/me × 2" },
    cout: { soldeAvantUsd: soldeAvant, soldeApresUsd: soldeApres, depenseUsd: +(soldeAvant - soldeApres).toFixed(4), caracteres },
  };
}

async function main() {
  mkdirSync(SORTIE, { recursive: true });
  const fichierPreuve = join(SORTIE, "preuve.json");
  let entete: Record<string, unknown>;
  if (ANALYSER_SEULEMENT) {
    if (!existsSync(fichierPreuve)) throw new Error("Aucune preuve à analyser : lancez d'abord sans --analyser.");
    const p = JSON.parse(readFileSync(fichierPreuve, "utf8"));
    entete = { date: p.date, voix: p.voix, appels: p.appels, cout: p.cout };
  } else entete = await appelsReels();

  const resultats = [];
  for (const p of PHRASES) resultats.push(await mesurer(p.id, p.texte));
  const attaques = resultats.flatMap((r) => r.ecartAttaquesMs);
  const fins = resultats.flatMap((r) => r.ecartFinsMs);
  const premiers = resultats.flatMap((r) => (r.ecartPremierMotMs === null ? [] : [r.ecartPremierMotMs]));
  const preuve = {
    ...entete,
    phrases: resultats,
    syntheseDebit: {
      motsParSecondeMoyen: +(resultats.reduce((s, r) => s + r.motsParSeconde, 0) / resultats.length).toFixed(2),
      syllabesParSecondeMoyen: +(resultats.reduce((s, r) => s + r.syllabesParSeconde, 0) / resultats.length).toFixed(2),
      cibleMotsParSeconde: "4,0 à 4,8 (B.4)",
      cibleSyllabesParSeconde: "6,0 à 6,5 (B.4)",
      respirationsDetectees: resultats.reduce((s, r) => s + r.respirations, 0),
    },
    controleHorodatage: {
      methode:
        "son de HeyGen par fenêtres de 10 ms au seuil de −35 dB : arrêt et reprise réels de la voix autour de chaque blanc annoncé ≥ 150 ms, et début réel du premier mot (écart positif = annoncé trop tard)",
      premierMotMs: premiers,
      ecartMoyenPremierMotMs: moyenneAbs(premiers),
      ecartMoyenFinsAvantBlancMs: moyenneAbs(fins),
      ecartMoyenAttaquesApresBlancMs: moyenneAbs(attaques),
      seuilB5: "< 40 ms visé ; au-delà de 80 ms : construire studio-aligneur (WhisperX)",
    },
  };
  writeFileSync(fichierPreuve, JSON.stringify(preuve, null, 2));
  console.log(JSON.stringify({ cout: preuve.cout, debit: preuve.syntheseDebit, horodatage: preuve.controleHorodatage }, null, 2));
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
