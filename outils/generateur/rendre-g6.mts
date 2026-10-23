/**
 * PREUVE DES LOTS G6 ET G6b — rendu LOCAL RÉEL (0 €) avec le VRAI MOTEUR avocat, sans aucun appel payant :
 *
 *   G6 : un sujet du domaine d'Axion-IA (cadrage hypothétique honnête, aucun faux cas client) en 5 versions réseau.
 *     La MÈRE (LinkedIn, la plus longue, avec son segment facultatif) passe par tout le moteur : voix → nettoyage des
 *     blancs → découpage avec coupes imposées → composition 9:16 dans `studio-rendu`. Chaque autre version (TikTok,
 *     Reels, Shorts, Facebook) ne fait lire QUE son début et sa fin, puis le moteur assemble (opération `assemblage`)
 *     son début neuf, le corps de la mère sur des coupes (segment facultatif retiré) et sa fin neuve, et compose la
 *     vidéo avec SON encadré et SON incrustation d'appel, sous-titres hors de toutes les zones protégées.
 *   G6b : une prise « je lis » (la voix d'essai `tests/fixtures/voix-essai.wav` sur une image filmée de démonstration),
 *     calée sur le texte validé par l'aligneur (sa sortie RÉELLE enregistrée au lot D3 sur ce son), un seul angle,
 *     sous-titrée depuis le texte validé.
 *
 * Simulé (gratuit) : la voix est celle de Windows (Hortense, `voix-windows.ps1`) ; le double est la silhouette d'essai
 * (webm transparent, comme la démonstration M4) posée là où la brique visage du lot M6 posera le vrai double.
 * `studio-rendu` tourne EN LOCAL (opérations appelées directement, fichiers servis depuis un dossier temporaire).
 *
 * Usage (racine du dépôt) : `pnpm exec tsx outils/generateur/rendre-g6.mts`
 * Sorties : docs/captures/g6/ (mp4 courts 540 × 960, planches, preuves.json) ; vidéos pleine taille dans le dossier temporaire.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import type { BlocScript, CommandeFabrication, IdReseau, MotHorodate, Travail } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, FournisseurAlignement, FournisseurVoix, ResultatAlignement, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { ResultatFabrication } from "@/moteurs/types";
// Essai sur ce poste (entrées servies par 127.0.0.1) : mode essai EXPLICITE de studio-rendu (relecture sécurité R45).
process.env.STUDIO_RENDU_ESSAI ??= "1";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const SORTIE = join(RACINE, "docs", "captures", "g6");
const TRAVAIL = join(tmpdir(), "studio-g6");
const ENTREES = join(TRAVAIL, "entrees");
mkdirSync(SORTIE, { recursive: true });
mkdirSync(ENTREES, { recursive: true });

// Hors de Next, « server-only » refuse d'être chargé : la preuve tourne en ligne de commande (Remotion exige la
// condition par défaut de React). Le module est neutralisé ICI seulement, jamais dans le studio.
{
  const exiger0 = (await import("node:module")).createRequire(import.meta.url);
  const chemin = exiger0.resolve("server-only");
  exiger0.cache[chemin] = { id: chemin, filename: chemin, loaded: true, exports: {} } as unknown as NodeJS.Module;
}

const charger = async <T,>(m: string): Promise<T> => {
  const x = (await import(m)) as T & { default?: T };
  return (x.default ?? x) as T;
};
const moteurs = await charger<typeof import("@/moteurs/montage-avocat")>("@/moteurs/montage-avocat");
const avocat = await charger<typeof import("@/formats/avocat")>("@/formats/avocat");
const elements = await charger<typeof import("@/donnees/elements-avocat")>("@/donnees/elements-avocat");
const decors = await charger<typeof import("@/donnees/decors-catalogue")>("@/donnees/decors-catalogue");
const decl = await charger<typeof import("@/briques/declinaison")>("@/briques/declinaison");
const largeur = await charger<typeof import("@/briques/sous-titres/largeur")>("@/briques/sous-titres/largeur");
const montants = await charger<typeof import("@/lib/montants")>("@/lib/montants");
const { composition } = await import("../../studio-rendu/src/operations/composition");
const { nettoyageAudio } = await import("../../studio-rendu/src/operations/nettoyage-audio");
const { assemblage } = await import("../../studio-rendu/src/operations/assemblage");
const { servirDossier } = await import("../../studio-rendu/src/composition/serveur-fichiers");
const { paquetCompositions } = await import("../../studio-rendu/src/remotion");

const RESEAUX: IdReseau[] = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"];
const plat = (cle: string) => cle.replace(/[\\/]/g, "__");
const serveur = await servirDossier(ENTREES);
const T0 = Date.now();

/* --- 1. Fichiers d'entrée (servis comme R2) : décor, LUT, logo d'appel, double d'essai --- */
copyFileSync(join(RACINE, "public", "demo", "decors", "fond-1-halo-orange.jpg"), join(ENTREES, "fond-1-halo-orange.jpg"));
copyFileSync(join(RACINE, "public", "luts", "axion-buffer-clair-obscur.cube"), join(ENTREES, "axion-buffer-clair-obscur.cube"));
copyFileSync(join(RACINE, "public", "demo", "marque", "logo.png"), join(ENTREES, "logo-appel.png"));
const exiger = (await import("node:module")).createRequire(join(RACINE, "studio-rendu", "package.json"));
const { renderMedia, selectComposition } = exiger("@remotion/renderer") as typeof import("../../studio-rendu/node_modules/@remotion/renderer");
const webm = join(ENTREES, "double-essai-40s.webm");
if (!existsSync(webm)) {
  const serveUrl = await paquetCompositions();
  const props = { tenue: "#1E2128", peau: "#C4967A", images: 40 * 25 };
  const c = await selectComposition({ serveUrl, id: "DoubleEssai", inputProps: props });
  console.log("double d'essai (webm alpha, 40 s)…");
  await renderMedia({ composition: c, serveUrl, codec: "vp9", pixelFormat: "yuva420p", imageFormat: "png", outputLocation: webm, inputProps: props, concurrency: 4, chromiumOptions: { gl: "swangle" }, muted: true });
}

/* --- 2. Fournisseurs LOCAUX : voix Windows, stockage (dossier servi), studio-rendu appelé directement --- */
const voixWindows: FournisseurVoix = {
  id: "windows",
  type: "voix",
  nom: "Voix Windows (essai)",
  reelPrevu: "HeyGen",
  mode: "simulation",
  capacites: { asynchrone: false, accordExige: false, audioSeul: true },
  copierVoix: async () => ({ idExterne: "windows", statut: "prete" }),
  listerVoixExistantes: async () => [],
  async lire(d) {
    const h = createHash("md5").update(d.texte).digest("hex").slice(0, 10);
    const base = join(ENTREES, `voix-${h}`);
    if (!existsSync(`${base}.wav`)) {
      writeFileSync(`${base}.txt`, d.texte, "utf8");
      const r = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(ICI, "voix-windows.ps1"), "-Texte", `${base}.txt`, "-Sortie", base], { encoding: "utf8" });
      if (r.status !== 0) throw new Error(`voix Windows : ${r.stderr}`);
    }
    const debuts = JSON.parse(readFileSync(`${base}.debuts.json`, "utf8").replace(/^﻿/, "")) as { mot: string; debutSec: number }[];
    // Fin de chaque mot mesurée sur le son (dernière trame de 10 ms au-dessus de −40 dBFS), comme la démonstration M4.
    const pcm = spawnSync("ffmpeg", ["-v", "error", "-i", `${base}.wav`, "-f", "f32le", "-ac", "1", "-ar", "48000", "-"], { maxBuffer: 1 << 28 }).stdout;
    const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4);
    const duree = x.length / 48000;
    const db = (i: number) => {
      let s = 0;
      for (let k = i; k < Math.min(i + 480, x.length); k++) s += x[k] * x[k];
      return 10 * Math.log10(s / 480 + 1e-12);
    };
    const mots: MotHorodate[] = debuts.map((m, i) => {
      const limite = i + 1 < debuts.length ? debuts[i + 1].debutSec : duree;
      let fin = m.debutSec + 0.05;
      for (let t = Math.floor(m.debutSec * 48000); t < Math.floor(limite * 48000) - 480; t += 480) if (db(t) > -40) fin = (t + 480) / 48000;
      return { mot: m.mot, debutSec: m.debutSec, finSec: +Math.min(limite, fin).toFixed(3) };
    });
    return { fichierCle: `voix-${h}.wav`, dureeSec: +duree.toFixed(3), cout: montants.centimes(0), mots };
  },
} as unknown as FournisseurVoix;

const stockageLocal: StockageFichiers = {
  id: "local",
  type: "stockage",
  nom: "Dossier local",
  reelPrevu: "R2",
  mode: "reel",
  capacites: { asynchrone: false, accordExige: false },
  preparerDepot: async () => ({ cleStockage: "x", urlDepot: "" }),
  confirmerDepot: async () => ({ ok: true }),
  urlLecture: async (cle) => `${serveur.base}/${encodeURIComponent(plat(cle))}`,
  urlLectureDuree: async (cle) => `${serveur.base}/${encodeURIComponent(plat(cle))}`,
  // Une adresse de dépôt existe (le moteur l'exige) ; studio-rendu local ne dépose rien : il range le fichier lui-même.
  urlDepotDuree: async (cle: string) => `${serveur.base}/depot/${encodeURIComponent(plat(cle))}`,
} as unknown as StockageFichiers;

/** studio-rendu local : chaque demande est faite tout de suite, son fichier rangé sous la clé de sortie. */
const etats = new Map<string, EtatRendu>();
const compteurs: Record<string, number> = {};
const renduLocal: ServiceRendu = {
  async soumettre(d: DemandeRendu) {
    const dossier = join(TRAVAIL, "rendus", d.idRendu);
    mkdirSync(dossier, { recursive: true });
    const contexte = { dossier, signal: new AbortController().signal, progression: () => {} };
    compteurs[d.operation] = (compteurs[d.operation] ?? 0) + 1;
    d.sortie.urlDepot = "";
    const depots = (d.parametres as { depots?: Record<string, { urlDepot: string }> }).depots;
    for (const x of Object.values(depots ?? {})) x.urlDepot = "";
    const t0 = Date.now();
    if (d.operation === "composition") {
      // Le double d'essai (silhouette, webm transparent) là où la brique visage (lot M6) posera le vrai double.
      const p = d.parametres as { image?: { doubles: { principal: unknown } } };
      const opaque = (p.image?.doubles.principal as { type?: string; transparent?: boolean } | undefined)?.transparent === false;
      if (p.image && !opaque) {
        p.image.doubles.principal = { type: "video", url: "entree:double-principal", transparent: true };
        d.entrees["double-principal"] = `${serveur.base}/double-essai-40s.webm`;
      }
      const r = await composition(d, contexte);
      copyFileSync(join(dossier, "video.mp4"), join(ENTREES, plat(d.sortie.cle)));
      etats.set(d.idRendu, { statut: "termine", sortieCle: d.sortie.cle, mesures: r.mesures });
    } else if (d.operation === "nettoyage-audio") {
      const r = await nettoyageAudio(d, contexte);
      const f = (d.parametres as { mode: string }).mode === "appliquer" ? "audio-maitre.wav" : "analyse.json";
      copyFileSync(join(dossier, f), join(ENTREES, plat(d.sortie.cle)));
      etats.set(d.idRendu, { statut: "termine", sortieCle: d.sortie.cle, mesures: r.mesures });
    } else if (d.operation === "assemblage") {
      const r = await assemblage(d, contexte);
      const f = (d.parametres as { sortie: string }).sortie === "wav" ? "assemblage.wav" : "assemblage.mp4";
      copyFileSync(join(dossier, f), join(ENTREES, plat(d.sortie.cle)));
      etats.set(d.idRendu, { statut: "termine", sortieCle: d.sortie.cle, mesures: r.mesures });
    } else throw new Error(`opération non prévue dans la preuve : ${d.operation}`);
    console.log(`  studio-rendu · ${d.operation} ${d.idRendu} : ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    return { idRendu: d.idRendu };
  },
  etat: async (id) => etats.get(id) ?? { statut: "inconnu" },
} as ServiceRendu;

/* --- 3. Le sujet : un corps commun, une ouverture et une fin par réseau (domaine d'Axion-IA, cadrage hypothétique) --- */
const bloc = (id: string, blocRecette: string, segments: BlocScript["segments"]): BlocScript => ({ id, blocRecette, segments });
const CORPS: BlocScript[] = [
  bloc("b-coeur", "coeur", [
    { id: "c1", texte: "Prenons une DAF de PME qui relance chaque facture à la main, le vendredi soir.", emphase: ["à la main"] },
    { id: "c2", texte: "Ce qu'on met en place dans ce cas : un outil qui lit les factures et relance seul.", changementVisuel: true },
    { id: "f1", texte: "Et chaque échange reste tracé, client par client, sans un seul copier-coller.", facultatif: "linkedin" },
  ]),
  bloc("b-preuve", "preuve", [{ id: "c3", texte: "Sauf si vos clients paient tous à l'heure : là, gardez votre méthode." }]),
];
const appel = (id: string, texte: string) => bloc(`b-${id}`, "appel", [{ id, texte, incrustation: { type: "objet" as const, elementId: "incrustation-appel-logo" } }]);
const VERSIONS: { code: string; reseau: IdReseau; ouverture: BlocScript[]; fin: BlocScript[]; encadre: string; facultatif: boolean }[] = [
  { code: "0042-AV-LI", reseau: "linkedin", facultatif: true, encadre: "Relances : le vrai coût", ouverture: [bloc("b-o-li", "accroche", [{ id: "o-li", texte: "DAF de PME : vos relances de factures vous prennent tout le vendredi ?" }])], fin: [appel("a-li", "Écrivez-nous pour un diagnostic gratuit.")] },
  { code: "0042-AV-TT", reseau: "tiktok", facultatif: false, encadre: "Relances à la main", ouverture: [bloc("b-o-tt", "accroche", [{ id: "o-tt", texte: "Vous relancez encore vos factures à la main ?" }])], fin: [appel("a-tt", "Envoyez ça à votre DAF."), bloc("b-r-tt", "boucle", [{ id: "r-tt", texte: "Et le vendredi soir, alors ?" }])] },
  { code: "0042-AV-IG", reseau: "instagram", facultatif: false, encadre: "Le vendredi des relances", ouverture: [bloc("b-o-ig", "accroche", [{ id: "o-ig", texte: "Le vendredi soir, c'est relance de factures ?" }])], fin: [appel("a-ig", "Envoyez ça à votre DAF."), bloc("b-r-ig", "boucle", [{ id: "r-ig", texte: "Toujours à la main ?" }])] },
  { code: "0042-AV-YS", reseau: "youtube-shorts", facultatif: false, encadre: "Relancer sans y penser", ouverture: [bloc("b-o-ys", "accroche", [{ id: "o-ys", texte: "Relancer ses factures à la main, ça vous parle ?" }])], fin: [appel("a-ys", "Combien de relances faites-vous chaque semaine ?")] },
  { code: "0042-AV-FB", reseau: "facebook", facultatif: false, encadre: "Vos relances, automatisées", ouverture: [bloc("b-o-fb", "accroche", [{ id: "o-fb", texte: "Qui relance encore ses factures à la main ?" }])], fin: [appel("a-fb", "Combien de relances partent encore à la main chez vous ?")] },
];
const DITS: Record<string, string> = { DAF: "daf", PME: "pé emme heu" };
const dire = (t: string) => t.replace(/\b(DAF|PME)\b/g, (m) => DITS[m]);

const n1 = decors.decorsCatalogue(new Date().toISOString()).find((d) => d.id === "decor-n1-halo-orange")!;
const recette = avocat.RECETTE_MONTAGE_AVOCAT;
function commande(v: (typeof VERSIONS)[number], extra: Partial<CommandeFabrication> = {}): CommandeFabrication {
  const corps = v.facultatif ? CORPS : CORPS.map((b) => ({ ...b, segments: b.segments.filter((s) => !s.facultatif) }));
  const blocs = [...v.ouverture, ...corps, ...v.fin];
  const segments = blocs.flatMap((b) => b.segments);
  const texteComplet = segments.map((s) => s.texte).join(" ");
  return {
    versionContrat: 2,
    moteurId: "montage-avocat",
    videoId: `g6-${v.code}`,
    formatId: "avocat",
    versionFormat: 2,
    profilRenduVersion: 1,
    dureeCibleSec: 30,
    ratios: ["9:16"],
    script: { blocs, texteComplet },
    distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", fournisseurVoix: "windows", visagesResolus: { "trois-quarts": { visageId: "vis-essai", levresNote: 92 } } }],
    styles: {
      lut: { id: "lut-avocat-v1", nom: "Axion clair-obscur (v1)", intensite: 70, cible: ["personnage", "illustrations", "rushs", "decor", "accessoire"], origine: "format" },
      sousTitres: { id: "st-avocat-v1", nom: "Avocat", valeur: elements.STYLE_SOUS_TITRES_AVOCAT },
      habillage: { id: "hab-avocat-v1", nom: "Avocat", valeur: elements.HABILLAGE_AVOCAT },
      styleMontage: { id: "sm-avocat-v1", nom: "Avocat", valeur: elements.STYLE_MONTAGE_AVOCAT },
      profilSon: { id: "ps-avocat-v1", nom: "Avocat", valeur: elements.PROFIL_SON_AVOCAT },
      musique: null,
      decor: { id: n1.id, nom: n1.nom, valeur: n1.valeur },
    },
    briques: { "sous-titres": true, etalonnage: true, illustrations: false, son: true, habillage: true, "texte-ecran": true, "mention-ia": false },
    entrees: {},
    reglages: { micro: true },
    plans: [],
    prononciations: [],
    texteDitParSegment: segments.map((s) => dire(s.texte)),
    mentionIA: { active: false },
    budgetMax: { centimes: 15000, devise: "EUR" },
    adresse: "vous",
    accessoires: [{ id: "acc-micro-podcast", nom: "Micro de podcast", valeur: elements.ACCESSOIRE_MICRO }],
    profilRealisme: avocat.formatAvocat.profilRendu?.realisme,
    profilRendu: avocat.formatAvocat.profilRendu,
    recetteMontage: recette,
    tauxUsdEur: 0.92,
    construiteLe: new Date().toISOString(),
    sousTitres: { base: "karaoke", intensite: "equilibre" },
    intensite: { niveau: "equilibre", bruitages: "aucun" },
    medias: {
      "decor-n1-halo-orange": { cle: "fond-1-halo-orange.jpg", mime: "image/jpeg" },
      "lut-avocat-v1": { cle: "axion-buffer-clair-obscur.cube", mime: "text/plain", tailleCube: 65 },
      "incrustation-appel-logo": { cle: "logo-appel.png", mime: "image/png" },
    },
    reseaux: RESEAUX,
    zonesProtegees: decl.zonesProtegeesUnion(RESEAUX)!,
    encadreTexte: v.encadre,
    partiesDeclinaison: { ouverture: v.ouverture.flatMap((b) => b.segments.map((s) => s.id)), fin: v.fin.flatMap((b) => b.segments.map((s) => s.id)), facultatifs: v.facultatif ? ["f1"] : [] },
    ...extra,
  } as unknown as CommandeFabrication;
}

const moteur = moteurs.creerMoteurMontageAvocat({ voix: () => voixWindows, stockage: () => stockageLocal, rendu: renduLocal });
async function fabriquer(c: CommandeFabrication, nom: string): Promise<{ travail: Travail; resultat: ResultatFabrication }> {
  let travail = await moteur.lancer(c, { travailId: `t-${nom}`, versionId: `ver-${nom}`, titre: nom, maintenant: Date.now() });
  for (let i = 0; i < 400; i++) {
    const r = await moteur.avancer(travail, c, Date.now() + i * 1000);
    travail = r.travail;
    if (travail.statut === "termine") return { travail, resultat: r.resultat! };
    if (travail.statut === "echec") throw new Error(`${nom} : ${JSON.stringify(travail.erreur)}`);
  }
  throw new Error(`${nom} : bloqué`);
}

/* --- 4. La mère, puis les 4 versions sur la mère --- */
const preuves: Record<string, unknown> = {};
const fichiers: Record<string, string> = {};
const mere = VERSIONS[0];
const cMere = commande(mere);
console.log(`mère ${mere.code} : estimation ${montants.formaterMontant((await moteur.estimer(cMere)).total)}`);
const rMere = await fabriquer(cMere, mere.code);
fichiers[mere.code] = join(ENTREES, plat(rMere.resultat.sorties[0].fichierCle));
const laMere = moteur.mereDeclinaison(rMere.resultat.projetMontage, { videoId: cMere.videoId, versionId: `ver-${mere.code}` })!;
const audioMere = join(ENTREES, plat(laMere.audioCle));
preuves[mere.code] = { role: "mere", dureeSec: laMere.dureeSec, plans: rMere.resultat.plans?.length, estimation: (await moteur.estimer(cMere)).total, coupesImposees: decl.coupesImposees(laMere.segments, cMere.partiesDeclinaison) };

const pcm = (f: string) => {
  const b = spawnSync("ffmpeg", ["-v", "error", "-i", f, "-f", "s16le", "-ac", "1", "-ar", "48000", "-"], { maxBuffer: 1 << 28 }).stdout;
  return new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2);
};
const sonMere = pcm(audioMere);
for (const v of VERSIONS.slice(1)) {
  const refaits = [...v.ouverture, ...v.fin].flatMap((b) => b.segments.map((s) => s.id));
  const c = commande(v, { variante: { id: `var-${v.code}`, code: v.code, reseau: v.reseau, videoMereId: cMere.videoId, tranches: { debutRemplaceSec: 0, finRemplaceSec: 0 }, segmentsRefaits: refaits, mere: laMere, typeDerive: "variante-reseau" } });
  const estimation = (await moteur.estimer(c)).total;
  console.log(`${v.code} : estimation ${montants.formaterMontant(estimation)} (début et fin seulement)`);
  const r = await fabriquer(c, v.code);
  fichiers[v.code] = join(ENTREES, plat(r.resultat.sorties[0].fichierCle));
  const projet = r.resultat.projetMontage as { assemblage?: { morceaux: { entree: string; deSec: number; aSec: number; versSec: number }[]; jointures: { t: number; visible: boolean; serre?: boolean }[] }; audioMaitre?: { fichierCle: string } };
  // Le corps est celui de la mère : mêmes échantillons, hors des 12 ms de fondu de chaque bord.
  const son = pcm(join(ENTREES, plat(projet.audioMaitre!.fichierCle)));
  const corps = (projet.assemblage?.morceaux ?? []).filter((m) => m.entree === "mere").map((m) => {
    const a = Math.round((m.versSec + 0.05) * 48000);
    const n = Math.round((m.aSec - m.deSec - 0.1) * 48000);
    let meilleur = { decalage: 0, ecarts: Infinity };
    for (let d = -150; d <= 150; d++) {
      const depart = Math.round((m.deSec + 0.05) * 48000) + d;
      let e = 0;
      for (let k = 0; k < Math.min(n, 2000); k++) if (son[a + k] !== sonMere[depart + k]) e++;
      if (e < meilleur.ecarts) meilleur = { decalage: d, ecarts: e };
    }
    const depart = Math.round((m.deSec + 0.05) * 48000) + meilleur.decalage;
    // WAV 16 bits relu en flottant puis réécrit : un échantillon peut bouger d'UN pas de quantification (1/32768).
    let ecarts = 0;
    let ecartMax = 0;
    for (let k = 0; k < n; k++) {
      const e = Math.abs(son[a + k] - sonMere[depart + k]);
      if (e > 1) ecarts++;
      ecartMax = Math.max(ecartMax, e);
    }
    return { de: m.deSec, a: m.aSec, echantillons: n, differentsDePlusDUnPas: ecarts, ecartMaxEnPas: ecartMax };
  });
  const p = moteurs.creerMoteurMontageAvocat ? null : null;
  void p;
  const zone = largeur.zoneDe("9:16", [v.reseau]);
  preuves[v.code] = { role: "variante-reseau", estimation, dureeSec: r.resultat.plans?.at(-1)?.finSec, morceaux: projet.assemblage?.morceaux, jointures: projet.assemblage?.jointures, corpsIdentiqueALaMere: corps, zoneReseau: zone, sousTitresSurUnion: largeur.zoneDe("9:16", RESEAUX) };
}

/* --- 5. G6b : une prise « je lis » calée sur le texte validé (sortie réelle de l'aligneur enregistrée au lot D3) --- */
const VOIX_ESSAI = join(RACINE, "tests", "fixtures", "voix-essai.wav");
const prise = join(ENTREES, "prise-0042-AV-TT-L-1.mp4");
if (!existsSync(prise)) {
  spawnSync("ffmpeg", ["-v", "error", "-y", "-stream_loop", "-1", "-i", join(RACINE, "public", "demo", "rushs", "couloir.mp4"), "-i", VOIX_ESSAI, "-t", "10.92", "-map", "0:v", "-map", "1:a", "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=25", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", prise]);
}
const CALE = JSON.parse(readFileSync(join(RACINE, "tests", "fixtures", "d3-calage-voix-essai.json"), "utf8")) as ResultatAlignement;
const aligneurEnregistre: FournisseurAlignement = { id: "studio-aligneur", type: "alignement", nom: "Calage", reelPrevu: "studio-aligneur", mode: "reel", capacites: { asynchrone: true, accordExige: false }, soumettre: async () => {}, suivre: async () => ({ statut: "termine", resultat: CALE }) } as unknown as FournisseurAlignement;
const moteurJeLis = moteurs.creerMoteurMontageAvocat({ stockage: () => stockageLocal, rendu: renduLocal, alignement: () => aligneurEnregistre });
const segJeLis = [
  { id: "l1", texte: "Vous recevez un PV de 135 € ?" },
  { id: "l2", texte: "Surtout, ne le payez pas tout de suite." },
  { id: "l3", texte: "Je vous explique pourquoi, en trois points." },
];
const cJeLis = {
  ...commande(VERSIONS[1]),
  videoId: "g6b-0042-AV-TT-L",
  script: { blocs: [bloc("bl1", "accroche", [segJeLis[0]]), bloc("bl2", "coeur", [segJeLis[1]]), bloc("bl3", "appel", [segJeLis[2]])], texteComplet: segJeLis.map((s) => s.texte).join(" ") },
  texteDitParSegment: ["Vous recevez un pé vé de cent trente-cinq euros ?", segJeLis[1].texte, segJeLis[2].texte],
  distribution: [{ role: "Face caméra", source: "rush", modeAngles: "un-angle" }],
  prises: [{ id: "p1", partie: "version", cle: plat("prise-0042-AV-TT-L-1.mp4"), mime: "video/mp4", dureeSec: 10.92, segmentIds: ["l1", "l2", "l3"] }],
  encadreTexte: "Le PV qui attend",
  partiesDeclinaison: { ouverture: ["l1"], fin: ["l3"], facultatifs: [] },
} as unknown as CommandeFabrication;
let travailJL = await moteurJeLis.lancer(cJeLis, { travailId: "t-jl", versionId: "ver-jl", titre: "je lis", maintenant: Date.now() });
let resultatJL: ResultatFabrication | undefined;
for (let i = 0; i < 400 && travailJL.statut !== "termine"; i++) {
  const r = await moteurJeLis.avancer(travailJL, cJeLis, Date.now() + i * 1000);
  travailJL = r.travail;
  resultatJL = r.resultat ?? resultatJL;
  if (travailJL.statut === "echec") throw new Error(JSON.stringify(travailJL.erreur));
}
fichiers["0042-AV-TT-L"] = join(ENTREES, plat(resultatJL!.sorties[0].fichierCle));
preuves["0042-AV-TT-L"] = { role: "je-lis", estimation: (await moteurJeLis.estimer(cJeLis)).total, motsSousTitres: (resultatJL!.sousTitres ?? []).flatMap((s) => s.mots.map((m) => `${m.mot}@${m.debutSec.toFixed(2)}`)), projet: (resultatJL!.projetMontage as { assemblage?: unknown }).assemblage };

/* --- 6. Copies courtes (540 × 960), planches et preuves --- */
for (const [code, f] of Object.entries(fichiers)) {
  spawnSync("ffmpeg", ["-v", "error", "-y", "-i", f, "-vf", "scale=540:-2", "-c:v", "libx264", "-crf", "30", "-preset", "slow", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", join(SORTIE, `${code}.mp4`)]);
}
const image = (f: string, t: number, sortie: string) => spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(2), "-i", f, "-frames:v", "1", "-vf", "scale=360:-2", sortie]);
// Planche « versions » : pour chaque version, l'ouverture (encadré), le corps, l'appel (incrustation).
const lignes: string[] = [];
for (const v of VERSIONS) {
  const f = fichiers[v.code];
  const d = Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).stdout.toString());
  const imgs = [1.2, d * 0.5, d - 1.0].map((t, i) => {
    const o = join(TRAVAIL, `${v.code}-${i}.png`);
    image(f, t, o);
    return o;
  });
  const ligne = join(TRAVAIL, `ligne-${v.code}.png`);
  spawnSync("ffmpeg", ["-v", "error", "-y", ...imgs.flatMap((x) => ["-i", x]), "-filter_complex", "[0][1][2]hstack=inputs=3", ligne]);
  lignes.push(ligne);
}
spawnSync("ffmpeg", ["-v", "error", "-y", ...lignes.flatMap((x) => ["-i", x]), "-filter_complex", `${lignes.map((_, i) => `[${i}]`).join("")}vstack=inputs=${lignes.length}`, join(SORTIE, "planche-5-versions.png")]);
// Planche « raccords » : la dernière image avant et la première après chaque raccord de la version TikTok.
const tt = preuves["0042-AV-TT"] as { jointures?: { t: number }[] };
const raccords = (tt.jointures ?? []).map((j, i) => {
  const a = join(TRAVAIL, `raccord-${i}-avant.png`);
  const b = join(TRAVAIL, `raccord-${i}-apres.png`);
  image(fichiers["0042-AV-TT"], Math.max(0, j.t - 0.08), a);
  image(fichiers["0042-AV-TT"], j.t + 0.04, b);
  const l = join(TRAVAIL, `raccord-${i}.png`);
  spawnSync("ffmpeg", ["-v", "error", "-y", "-i", a, "-i", b, "-filter_complex", "[0][1]hstack=inputs=2", l]);
  return l;
});
if (raccords.length) spawnSync("ffmpeg", ["-v", "error", "-y", ...raccords.flatMap((x) => ["-i", x]), "-filter_complex", `${raccords.map((_, i) => `[${i}]`).join("")}vstack=inputs=${raccords.length}`, join(SORTIE, "planche-raccords-tiktok.png")]);
// Planche « je lis » : trois instants de la vidéo montée depuis la prise.
const jl = fichiers["0042-AV-TT-L"];
const jli = [1.0, 4.5, 8.5].map((t, i) => {
  const o = join(TRAVAIL, `jl-${i}.png`);
  image(jl, t, o);
  return o;
});
spawnSync("ffmpeg", ["-v", "error", "-y", ...jli.flatMap((x) => ["-i", x]), "-filter_complex", "[0][1][2]hstack=inputs=3", join(SORTIE, "planche-je-lis.png")]);

writeFileSync(join(SORTIE, "preuves.json"), JSON.stringify({ date: new Date().toISOString(), lot: "G6 + G6b", coutReel: "0 € (voix Windows, double d'essai, studio-rendu local, aligneur rejoué)", operations: compteurs, dureeTotaleSec: Math.round((Date.now() - T0) / 1000), versions: preuves }, null, 2) + "\n", "utf8");
await serveur.fermer();
console.log(`terminé → ${SORTIE}`);
