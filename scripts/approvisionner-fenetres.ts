// APPROVISIONNEMENT DES FENÊTRES EN MINI-VIDÉOS (face caméra animée) — outil local, même logique que la production
// (`remplirFenetres` + `preparateurMiniVideo`), branché directement sur les API gratuites.
//
// Usage (racine du dépôt) :
//   node node_modules/tsx/dist/cli.mjs scripts/approvisionner-fenetres.ts --plan <plan.json> --public <dossier public du rendu>
//        [--sortie <plan-sortie.json>] [--rapport <rapport.json>] [--travail <dossier de téléchargement>]
//        [--verdicts <verdicts.json>] [--env <fichier .env>] [--fenetres 3,4,6] [--scenes <autres-scenes.json>]
//   --fenetres : ne (re)cherche que ces fenêtres (numéros à partir de 1) ; les autres sont recopiées telles quelles.
//   --scenes : autres scènes proposées par le réalisateur, { "6": ["consultante qui écrit sur un tableau blanc", …] },
//              essayées dans l'ordre quand rien ne convient (`autreScene`) ; épuisées (ou absentes), et avec la clé Claude,
//              le RÉALISATEUR (Claude, `consigneAutreScene`) propose lui-même une autre scène (passe 4 ; --sans-realisateur
//              pour l'en empêcher). Toute proposition passe le contrôle de littéralité du plan avant d'être cherchée ;
//              puis les scènes de secours ; la fenêtre n'est supprimée qu'en tout dernier recours.
//
// - Passe 3 : TOUTES les fenêtres deviennent des mini-vidéos (plus AUCUNE photo fixe). Requêtes anglaises littérales
//   construites depuis la SCÈNE (`recherche`), Pexels ET Pixabay, 3 pages par requête (`banques.ts`), version la plus
//   PETITE dont le cadre 4:5 garde 720 px ; extrait préparé (passage sans coupe dans la plage de mouvement, 4:5
//   1080×1350, H.264 25 i/s, sans son, ≤ 8 Mo) dans <public>/videos/fenetre-N.mp4 ; mouvement mesuré sur l'extrait
//   (médiane 25 i/s : moins de 3 % ou plus de 35 % → candidat suivant) ; contrôle « littéral » par Claude sur une
//   PLANCHE de 3 images de l'extrait, au regard de la scène et des mots dits. Planche retenue copiée dans
//   <dossier du rapport>/controles/fenetre-N.jpg pour le contrôle visuel humain.
// - Licences : Pexels License et Pixabay Content License, gratuites, usage commercial, sans attribution obligatoire ;
//   source, identifiant, page et auteur sont notés dans le rapport. Aucune banque payante.
// - CLÉS : PEXELS_API_KEY, PIXABAY_API_KEY, ANTHROPIC_API_KEY lues dans l'environnement, sinon dans le fichier --env
//   (par défaut generation_videos/.env). JAMAIS affichées, journalisées ni écrites : tout message passe par `masquer`, et
//   l'outil s'arrête sans rien écrire si une valeur de clé apparaissait dans le plan ou le rapport.
// - Verrou du PC (verrou-lourd.txt) autour de chaque téléchargement + ffmpeg ; la source téléchargée est supprimée dès
//   l'extrait fait (disque C presque plein). Les téléchargements vont chacun dans leur propre dossier, aucun programme
//   n'y est lancé hormis ffmpeg/ffprobe sur le fichier vidéo.
import { spawn } from "node:child_process";
import { closeSync, copyFileSync, createWriteStream, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as FluxWeb } from "node:stream/web";
import {
  chercheurVideosBanques,
  consigneAutreScene,
  lireVerdictMiniVideo,
  preparateurMiniVideo,
  remplirFenetres,
  type CandidatImage,
  type DemandeRecherche,
  type MiniVideoPreparee,
  type VerdictMiniVideo,
} from "../src/moteurs/montage-facecam-animee/images/index";
import type { FenetrePlan } from "../src/domaine/facecam-animee/plan";
import { verifierPlan } from "../src/moteurs/montage-facecam-animee/realisateur/regles";

const VERROU = "<dossier utilisateur>/Documents/Projets/Axion-IA/verrou-lourd.txt";
const MODELE_VERIF = "claude-sonnet-5-5";
/** Le réalisateur (autre scène) : Opus, comme en production (tâche difficile). */
const MODELE_REALISATEUR = "claude-opus-5-5";
const TELECHARGEMENT_MAX = 200 * 1024 * 1024;

/* ---------------- Arguments ---------------- */
const args: Record<string, string> = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith("--")) args[process.argv[i].slice(2)] = process.argv[i + 1] ?? "";
if (!args.plan || !args.public) {
  console.error("Usage : approvisionner-fenetres.ts --plan <plan.json> --public <dossier public> [--sortie …] [--rapport …] [--travail …] [--verdicts …] [--env …] [--fenetres …] [--scenes …]");
  process.exit(2);
}
const PUBLIC = resolve(args.public);
const SORTIE = resolve(args.sortie ?? args.plan.replace(/\.json$/, "") + "-approvisionne.json");
const RAPPORT = resolve(args.rapport ?? SORTIE.replace(/\.json$/, "") + "-rapport.json");
const TRAVAIL = resolve(args.travail ?? join(tmpdir(), "approvisionner-fenetres"));
const ENV = args.env ?? "<dossier utilisateur>/Documents/Projets/generation_videos/.env";
const SCENES: Record<string, string[]> = args.scenes && existsSync(args.scenes) ? JSON.parse(readFileSync(args.scenes, "utf8")) : {};
const SEULEMENT = args.fenetres ? new Set(args.fenetres.split(",").map((x) => Number(x.trim()))) : null;
// --mots <mots.json> : transcription datée ({ w, a, … }[]) ; le contrôle visuel juge contre la PHRASE DITE (passe 3).
const MOTS: { w: string; a: number }[] | undefined = args.mots && existsSync(args.mots) ? JSON.parse(readFileSync(args.mots, "utf8")) : undefined;
const SANS_REALISATEUR = process.argv.includes("--sans-realisateur");
const VERDICTS: Record<string, unknown> = args.verdicts && existsSync(args.verdicts) ? JSON.parse(readFileSync(args.verdicts, "utf8")) : {};

/* ---------------- Clés (jamais affichées) ---------------- */
const NOMS = ["PEXELS_API_KEY", "PIXABAY_API_KEY", "ANTHROPIC_API_KEY"] as const;
type NomCle = (typeof NOMS)[number];
function lireCles(): Record<NomCle, string> {
  const fichier: Partial<Record<NomCle, string>> = {};
  if (NOMS.some((n) => !process.env[n]) && existsSync(ENV)) {
    for (const ligne of readFileSync(ENV, "utf8").split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(ligne);
      if (m && (NOMS as readonly string[]).includes(m[1])) fichier[m[1] as NomCle] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return Object.fromEntries(NOMS.map((n) => [n, process.env[n] || fichier[n] || ""])) as Record<NomCle, string>;
}
const CLES = lireCles();
const SECRETS = Object.values(CLES).filter((v) => v.length >= 8);
const masquer = (s: unknown) => SECRETS.reduce((t, v) => t.split(v).join("[clé masquée]").split(encodeURIComponent(v)).join("[clé masquée]"), String(s ?? ""));
const journal = (...m: unknown[]) => console.log(masquer(m.join(" ")));
journal(`Clés : Pexels ${CLES.PEXELS_API_KEY ? "présente" : "absente"}, Pixabay ${CLES.PIXABAY_API_KEY ? "présente" : "absente"}, Claude ${CLES.ANTHROPIC_API_KEY ? "présente" : "absente"}.`);

/* ---------------- Verrou du PC ---------------- */
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function sousVerrou<T>(f: () => Promise<T>): Promise<T> {
  for (;;) {
    try {
      closeSync(openSync(VERROU, "wx"));
      writeFileSync(VERROU, `approvisionner-fenetres ${new Date().toISOString()}\n`);
      break;
    } catch {
      await attendre(10_000);
    }
  }
  try {
    return await f();
  } finally {
    try {
      unlinkSync(VERROU);
    } catch {
      /* déjà retiré */
    }
  }
}

/* ---------------- Réseau ---------------- */
async function obtenir(url: string, o: RequestInit & { delai?: number } = {}): Promise<Response> {
  let r: Response;
  try {
    r = await fetch(url, { ...o, signal: AbortSignal.timeout(o.delai ?? 30_000) });
  } catch (e) {
    throw new Error(masquer(`réseau : ${(e as Error).message}`));
  }
  if (!r.ok) throw new Error(masquer(`réponse ${r.status}`));
  return r;
}
async function telecharger(url: string, fichier: string): Promise<void> {
  const r = await obtenir(url, { delai: 180_000 });
  if (Number(r.headers.get("content-length") ?? 0) > TELECHARGEMENT_MAX) throw new Error("fichier trop lourd");
  mkdirSync(dirname(fichier), { recursive: true });
  // Délai TOTAL du flux (passe 2, 15/10 : un téléchargement Pexels resté figé 25 min bloquait l'outil ET le verrou du PC).
  await pipeline(Readable.fromWeb(r.body as unknown as FluxWeb), createWriteStream(fichier), { signal: AbortSignal.timeout(180_000) });
}

function executer(programme: "ffmpeg" | "ffprobe", a: string[]): Promise<Uint8Array> {
  return new Promise((ok, ko) => {
    const p = spawn(programme, a, { windowsHide: true });
    const sortie: Buffer[] = [];
    let erreur = "";
    p.stdout.on("data", (d: Buffer) => sortie.push(d));
    p.stderr.on("data", (d: Buffer) => {
      erreur = (erreur + d.toString()).slice(-4000);
    });
    p.on("error", ko);
    p.on("close", (code) => (code === 0 ? ok(Buffer.concat(sortie)) : ko(new Error(`${programme} a échoué (${code}) : ${erreur.slice(-300)}`))));
  });
}

/* ---------------- Banques gratuites (même code que la production : `banques.ts`) ---------------- */
const videosBanques = chercheurVideosBanques({ pexels: CLES.PEXELS_API_KEY, pixabay: CLES.PIXABAY_API_KEY }, async (url, init) => {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    throw new Error(masquer(`réseau : ${(e as Error).message}`));
  }
});

const appels: { fenetre: number; source: string; genre: string; requete: string; page: number; n: number }[] = [];
let fenetreCourante = 0;
async function chercher(d: DemandeRecherche): Promise<CandidatImage[]> {
  let r: CandidatImage[] = [];
  try {
    // Vidéos seulement (plus aucune photo dans une fenêtre). Wikimedia, Mes images, captures : hors de cet outil.
    if ((d.source === "pexels" || d.source === "pixabay") && d.genre === "video") r = await videosBanques(d.source, d.requeteEn, d.page ?? 1);
  } catch (e) {
    journal(`  ${d.source} « ${d.requeteEn} » p${d.page ?? 1} : ${masquer((e as Error).message)}`);
    throw e;
  }
  appels.push({ fenetre: fenetreCourante + 1, source: d.source, genre: d.genre, requete: d.requeteEn, page: d.page ?? 1, n: r.length });
  return r;
}

/* ---------------- Préparation (même code que la production) ---------------- */
const preparations = new Map<string, MiniVideoPreparee & { source: { largeur: number; hauteur: number; dureeSec: number } }>();
const preparer = preparateurMiniVideo({
  executer,
  telecharger,
  async dossierTravail(nom) {
    const d = join(TRAVAIL, nom);
    rmSync(d, { recursive: true, force: true });
    mkdirSync(d, { recursive: true });
    return d;
  },
  async taille(f) {
    return statSync(f).size;
  },
  async deposer(fichier, cle) {
    const cible = join(PUBLIC, cle);
    mkdirSync(dirname(cible), { recursive: true });
    copyFileSync(fichier, cible);
    return cle;
  },
  async retirer(cle) {
    rmSync(join(PUBLIC, cle), { force: true });
  },
  async supprimer(f) {
    rmSync(f, { force: true });
  },
  sousVerrou,
});

/* ---------------- Contrôle « littéral » par Claude ---------------- */
async function demanderClaude(imageJpeg: Buffer | null, consigne: string, modele = MODELE_VERIF): Promise<string> {
  const contenu = [...(imageJpeg ? [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageJpeg.toString("base64") } }] : []), { type: "text", text: consigne }];
  const r = await obtenir("https://api.anthropic.com/v1/messages", {
    method: "POST",
    delai: 90_000,
    headers: { "x-api-key": CLES.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: modele, max_tokens: 1500, messages: [{ role: "user", content: contenu }] }),
  });
  const j = (await r.json()) as { content?: { type: string; text?: string }[] };
  return (j.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
}
const aRegarder: { empreinte: string; image?: string }[] = [];
async function verifierMiniVideo(d: { candidat: CandidatImage; image?: string; consigne: string }): Promise<VerdictMiniVideo> {
  const e = `${d.candidat.source}:${d.candidat.id}`;
  if (!CLES.ANTHROPIC_API_KEY) {
    aRegarder.push({ empreinte: e, image: d.image });
    const v = VERDICTS[e];
    return lireVerdictMiniVideo(typeof v === "string" ? v : v ? JSON.stringify(v) : "aucun verdict déposé");
  }
  if (!d.image || !existsSync(d.image)) return lireVerdictMiniVideo("image absente");
  try {
    const v = lireVerdictMiniVideo(await demanderClaude(readFileSync(d.image), d.consigne));
    journal(`    contrôle ${e} : ${v.verdict}${v.accepte ? "" : " (refus)"} — ${v.raison}`);
    return v;
  } catch (err) {
    journal(`    contrôle ${e} impossible : ${(err as Error).message}`);
    return lireVerdictMiniVideo("contrôle impossible");
  }
}
/** Plus aucune photo : une vidéo de banque passe TOUJOURS par la préparation (mesurée, recadrée). */
async function stocker(c: CandidatImage): Promise<string> {
  if (!/^https?:/.test(c.cle)) return c.cle;
  throw new Error("une vidéo de banque passe par la préparation ; aucune photo dans une fenêtre");
}

/* ---------------- Déroulé : une fenêtre à la fois (anti-doublon sur la vidéo) ---------------- */
async function principal() {
  const plan = JSON.parse(readFileSync(args.plan, "utf8")) as { fenetres: FenetrePlan[] } & Record<string, unknown>;
  const pris: string[] = [];
  const fenetres: FenetrePlan[] = [];
  const lignes: Record<string, unknown>[] = [];
  for (const [i, f0] of plan.fenetres.entries()) {
    fenetreCourante = i;
    if (SEULEMENT && !SEULEMENT.has(i + 1)) {
      fenetres.push(f0);
      continue;
    }
    const f: FenetrePlan = { ...f0, video: true };
    journal(`\nFenêtre ${i + 1} (${f.debut}-${f.fin} s) : « ${f.recherche} »${f.illustre ? ` — dit : « ${f.illustre} »` : ""}`);
    const r = await remplirFenetres(
      { fenetres: [f] },
      {
        chercher,
        stocker,
        preparerMiniVideo: async (c, d) => {
          const p = await preparer(c, { ...d, fenetre: i });
          preparations.set(`${c.source}:${c.id}`, p);
          journal(`    ${c.source} ${c.id} (${c.largeur}×${c.hauteur}) : extrait ${p.dureeSec} s dès ${p.debutSourceSec} s, médiane ${((p.pixelsChangesMedian ?? 0) * 100).toFixed(1)} % de pixels changés, ${p.coupes ?? 0} coupe(s), ${Math.round((p.partFigee ?? 0) * 100)} % figées, ${((p.octets ?? 0) / 1e6).toFixed(2)} Mo`);
          return p;
        },
        abandonner: async (cle) => rmSync(join(PUBLIC, cle), { force: true }),
        verifierMiniVideo,
        autreScene: async (d) => {
          let autre = (SCENES[String(i + 1)] ?? []).find((x) => !d.essayees.includes(x) && !d.refus.some((r) => r.includes(`« ${x} »`))) ?? null;
          if (!autre && CLES.ANTHROPIC_API_KEY && !SANS_REALISATEUR) {
            try {
              autre = (await demanderClaude(null, consigneAutreScene(d), MODELE_REALISATEUR)).trim().split(/\r?\n/)[0].replace(/^[«"“\s]+|[»"”.\s]+$/g, "") || null;
            } catch (e) {
              journal(`  réalisateur indisponible : ${masquer((e as Error).message)}`);
            }
          }
          if (autre) journal(`  → autre scène demandée au réalisateur : « ${autre} »`);
          return autre;
        },
        historique: [pris],
        ...(MOTS ? { mots: MOTS } : {}),
      },
    );
    // Rien retenu : la fenêtre est SUPPRIMÉE du plan (jamais une photo morte).
    const nf: FenetrePlan | undefined = r.plan.fenetres[0];
    const choix = r.choix[0];
    if (nf) fenetres.push(nf);
    if (choix) pris.push(choix.empreinte);
    const prep = choix ? preparations.get(choix.empreinte) : undefined;
    let controle: string | undefined;
    if (prep?.image && existsSync(prep.image)) {
      controle = join(dirname(RAPPORT), "controles", `fenetre-${i + 1}.jpg`);
      mkdirSync(dirname(controle), { recursive: true });
      copyFileSync(prep.image, controle);
    }
    lignes.push({
      fenetre: i + 1,
      debut: f.debut,
      fin: f.fin,
      recherche: f.recherche,
      illustre: f.illustre,
      requetes: appels.filter((a) => a.fenetre === i + 1).map((a) => `${a.source} p${a.page} « ${a.requete} » (${a.n})`),
      supprimee: !nf,
      media: nf?.media,
      video: nf?.video === true,
      depuisSec: nf?.depuisSec,
      scene: choix?.scene,
      sceneRemplacee: !!choix && choix.scene !== f.recherche,
      ...(choix
        ? {
            source: choix.source,
            id: choix.id,
            licence: choix.licence?.nom,
            usageCommercial: choix.licence?.usageCommercial,
            page: choix.page,
            auteur: choix.auteur,
            requeteRetenue: choix.requete,
            verdict: choix.verdict,
            raison: choix.raison,
            ...(prep ? { formatSource: `${prep.source.largeur}×${prep.source.hauteur}`, dureeSourceSec: prep.source.dureeSec, debutPassageSec: prep.debutSourceSec, dureeExtraitSec: prep.dureeSec, mouvement: prep.mouvement, pixelsChanges: prep.pixelsChanges, pixelsChangesMedian: prep.pixelsChangesMedian, partFigee: prep.partFigee, octets: prep.octets, imageControle: controle } : {}),
          }
        : {}),
      manques: r.manques.map((m) => m.raison),
    });
  }

  const sortiePlan = { ...plan, fenetres };
  // Passe 4 : le plan livré repasse le contrôle de littéralité des fenêtres (scènes de remplacement comprises).
  const erreursFenetres = MOTS ? verifierPlan(sortiePlan, MOTS as never).erreurs.filter((e) => /^Fenêtre \d+ : la (recherche|phrase)/.test(e)) : [];
  const nbVideos = fenetres.filter((f) => f.video && /\.mp4$/i.test(f.media)).length;
  const nbSupprimees = lignes.filter((l) => l.supprimee).length;
  const rapport = {
    plan: args.plan,
    sortie: SORTIE,
    date: new Date().toISOString(),
    sources: "Pexels (Pexels License) et Pixabay (Pixabay Content License) : gratuites, usage commercial, sans attribution obligatoire",
    controle: CLES.ANTHROPIC_API_KEY ? `Claude (${MODELE_VERIF}) sur une planche de 3 images de l'extrait, au regard de la scène et des mots dits` : "verdicts déposés (--verdicts)",
    bilan: `${nbVideos} mini-vidéos sur ${fenetres.length} fenêtres gardées (${plan.fenetres.length} au départ, ${nbSupprimees} supprimée(s))`,
    ...(MOTS ? { erreursLitteraliteFenetres: erreursFenetres } : {}),
    fenetres: lignes,
    ...(aRegarder.length ? { aRegarder } : {}),
  };
  const texteRapport = JSON.stringify(rapport, null, 1);
  const textePlan = JSON.stringify(sortiePlan, null, 1);
  for (const v of SECRETS) {
    if ([texteRapport, textePlan].some((t) => t.includes(v) || t.includes(encodeURIComponent(v)))) {
      console.error("ARRÊT : une valeur de clé apparaîtrait dans le plan ou le rapport. Rien n'est écrit.");
      process.exit(3);
    }
  }
  writeFileSync(SORTIE, textePlan);
  writeFileSync(RAPPORT, texteRapport);
  journal(`\n${rapport.bilan}\nPlan : ${SORTIE}\nRapport : ${RAPPORT}`);
  if (MOTS) journal(`Littéralité des fenêtres (contrôle du plan) : ${erreursFenetres.length ? erreursFenetres.join("\n  ") : "aucune erreur"}`);
  for (const l of lignes) journal(`  F${l.fenetre} ${l.supprimee ? "SUPPRIMÉE" : l.video ? "VIDÉO" : "capture"} ${l.source ?? "-"} ${l.id ?? ""} ${l.licence ?? ""} ${l.verdict ?? ""} ${l.pixelsChangesMedian !== undefined ? "médiane " + ((l.pixelsChangesMedian as number) * 100).toFixed(1) + " %" : ""} « ${l.requeteRetenue ?? ""} »`);
}

principal().catch((e) => {
  console.error(masquer((e as Error).message));
  process.exit(1);
});
