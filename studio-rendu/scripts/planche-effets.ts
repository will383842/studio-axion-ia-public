/**
 * PLANCHE DE VALIDATION DES EFFETS SPÉCIAUX (facecam lot F3) : une vidéo de 5 s par effet, 1080 × 1920, 25 i/s,
 * MP4 < 3 Mo, et une page HTML unique pour Will.
 *
 * Chaîne identique à la production : un plateau de démonstration est d'abord rendu en MP4 (personne dessinée, main
 * pilotée par une piste simulée), puis il sert de « piste montée » aux compositions d'effets ; la piste de main
 * donnée au calcul des poses est échantillonnée comme MediaPipe (une image sur 6, bruit de détection) et la lumière
 * est mesurée sur une image du plateau (`estimerLumiere`).
 *
 * Usage (depuis `studio-rendu/`) :
 *   npx tsx scripts/planche-effets.ts                    → les vidéos + la page, dans docs/facecam/planche-effets/
 *   npx tsx scripts/planche-effets.ts --images vitre      → images fixes de contrôle d'un effet (dans .planche-effets/)
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/chrome               → navigateur sans affichage à utiliser
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { COMPOSITION_OBJET_MAIN, COMPOSITION_PLATEAU_DEMO, COMPOSITION_TRANSITION, preparerObjetMain } from "../../src/briques/effets-speciaux/demande";
import { caracterePrise, carteEnvironnement, estimerLumiere } from "../../src/briques/effets-speciaux/lumiere";
import { synthetiserVerre, wavMono16 } from "../../src/briques/effets-speciaux/son-verre";
import type { EchantillonMainDetaille } from "../../src/briques/effets-speciaux/main";
import { bornerDureeTransition, pointHorsVisage } from "../../src/briques/effets-speciaux/transitions";
import type { BoitePx, ObjetMain, ProprietesEffetObjetMain, ProprietesEffetTransition, StyleTransition } from "../../src/briques/effets-speciaux/types";
import type { EchantillonVisage } from "../../src/briques/realisation/piste";
import { CATALOGUE_MOTION } from "../../src/briques/motion/catalogue";
import { servirDossier } from "../src/composition/serveur-fichiers";
import { VISAGE_PLATEAU, type ProprietesPlateau } from "../compositions/commune/effets/PlateauEffets";
import { COMPOSITION_PLATEAU_PHOTO, flottement, PLATEAU_PHOTO, transformationMain, type CleTransformation } from "../compositions/commune/effets/PlateauPhoto";
import { copyFileSync } from "node:fs";

const racine = resolve(import.meta.dirname, "..");
const sortie = resolve(racine, "../docs/facecam/planche-effets");
const travail = resolve(racine, ".planche-effets");
mkdirSync(sortie, { recursive: true });
mkdirSync(travail, { recursive: true });

const args = process.argv.slice(2);
const imagesSeules = args.includes("--images");
const choisis = args.filter((a) => !a.startsWith("--"));
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c));
// Lot I : délai par image relevé (vitre + carte, canevas logiciel : une image dépassait 30 s sur 4 cœurs chargés).
const reglages = { browserExecutable: navigateur ?? null, chromiumOptions: { gl: "swangle" as const }, timeoutInMilliseconds: 180_000 };

const L = 1080;
const H = 1920;
const FPS = 25;
const IMAGES = 125;
const serveUrl = await bundle({ entryPoint: resolve(racine, "compositions/index.ts") });
// Les vidéos intermédiaires sont servies en local, comme les entrées d'un vrai rendu (`servirDossier`).
const serveur = await servirDossier(travail);
const adresse = (fichier: string) => `${serveur.base}/${fichier.split("/").pop()}`;

/* ------------------------------------------------------------------ */
/* Pistes simulées                                                     */
/* ------------------------------------------------------------------ */

const hasard = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const boiteVisagePlateau = (serre = 1): BoitePx => {
  const v = VISAGE_PLATEAU;
  return [v.cx - v.rx * serre, v.cy - v.ry * serre, 2 * v.rx * serre, 2 * v.ry * serre];
};

/* ------------------------------------------------------------------ */
/* Lot I2 : plateau photographique, main PAUME VERS LE HAUT            */
/* ------------------------------------------------------------------ */

/**
 * La main entre par le bas déjà ouverte paume vers le haut, se pose, bouge un peu (roulis, tangage dans l'image),
 * puis redescend hors champ : l'objet apparaît quand la paume est vue, la suit, et disparaît quand elle sort.
 */
const CLES_PHOTO: CleTransformation[] = [
  { t: 0, dx: 0, dy: 780, angle: 0 },
  { t: 0.3, dx: 0, dy: 780, angle: 0 },
  { t: 1.05, dx: -6, dy: 14, angle: 1.2 },
  { t: 1.4, dx: 0, dy: 0, angle: 0 },
  { t: 2.3, dx: -18, dy: 12, angle: -2.2 },
  { t: 3.1, dx: -4, dy: -10, angle: 1.8 },
  { t: 3.7, dx: 0, dy: 0, angle: 0 },
  { t: 4.45, dx: 0, dy: 780, angle: 0 },
  { t: 5, dx: 0, dy: 780, angle: 0 },
];

const PHOTOS = resolve(racine, "scripts/planche-photos");
const pointsPhoto = JSON.parse(readFileSync(resolve(PHOTOS, "points-main.json"), "utf8")) as { largeur: number; hauteur: number; cote: "gauche" | "droite"; points: [number, number, number][] };

/** Piste « MediaPipe » simulée : les 21 points de la photo, transformés comme la main, une image sur 6, bruit léger. */
function echantillonnerPaume(graine: number): EchantillonMainDetaille[] {
  const sortieMain: EchantillonMainDetaille[] = [];
  for (let i = 1; i < IMAGES; i += 6) {
    const t = i / FPS;
    const points = pointsPhoto.points.map((q, k) => {
      const [x, y, z] = transformationMain(CLES_PHOTO, t, [q[0] * pointsPhoto.largeur, q[1] * pointsPhoto.hauteur, q[2] * pointsPhoto.largeur]);
      const b = (n: number) => (hasard(graine * 31 + i * 7 + k * 3 + n) - 0.5) * 0.004;
      return [+(x / L + b(0)).toFixed(4), +(y / H + b(1)).toFixed(4), +(z / L + b(2)).toFixed(4)] as [number, number, number];
    });
    const cx = (points[0][0] + points[9][0]) / 2;
    const cy = (points[0][1] + points[9][1]) / 2;
    if (cy > 0.97) continue;
    sortieMain.push({ t: +t.toFixed(3), x: +cx.toFixed(4), y: +cy.toFixed(4), ouverte: true, points, cote: pointsPhoto.cote });
  }
  return sortieMain;
}

function pisteVisagePhoto(): EchantillonVisage[] {
  const [x, y, l, h] = PLATEAU_PHOTO.visage;
  const e: EchantillonVisage[] = [];
  for (let i = 0; i < IMAGES; i += 2) {
    const t = i / FPS;
    const f = flottement(t);
    e.push({ t, yeuxX: (x + l / 2 + f.x) / L, yeuxY: (y + h * 0.42 + f.y) / H, boite: [(x + f.x) / L, (y + f.y) / H, l / L, h / H], bouche: 0.2, confiance: 1 });
  }
  return e;
}

async function plateauPhoto(): Promise<string> {
  const fichier = resolve(travail, "plateau-photo.mp4");
  copyFileSync(resolve(PHOTOS, "personne.jpg"), resolve(travail, "personne.jpg"));
  copyFileSync(resolve(PHOTOS, "main.png"), resolve(travail, "main.png"));
  if (!existsSync(fichier)) await rendre(COMPOSITION_PLATEAU_PHOTO, { largeur: L, hauteur: H, fps: FPS, images: IMAGES, personne: adresse("personne.jpg"), main: adresse("main.png"), cles: CLES_PHOTO }, fichier, 12);
  return fichier;
}

/** Image RVB de la prise à l'instant t (comme la vignette de la chaîne). */
function imageRvb(video: string, t: number): Buffer {
  return execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", video, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 64 * 1024 * 1024 });
}

/* ------------------------------------------------------------------ */
/* Rendus                                                              */
/* ------------------------------------------------------------------ */

async function rendre(id: string, proprietes: Record<string, unknown>, fichier: string, crf = 20) {
  const composition = await selectComposition({ serveUrl, id, inputProps: proprietes, ...reglages });
  const debut = Date.now();
  await renderMedia({ composition, serveUrl, codec: "h264", crf, x264Preset: "slow", pixelFormat: "yuv420p", colorSpace: "bt709", imageFormat: "jpeg", jpegQuality: 95, muted: true, outputLocation: fichier, inputProps: proprietes, concurrency: 4, ...reglages });
  console.log(`${id} → ${fichier.split("/").pop()} : ${(statSync(fichier).size / 1e6).toFixed(2)} Mo en ${((Date.now() - debut) / 1000).toFixed(1)} s`);
}

async function images(id: string, proprietes: Record<string, unknown>, nom: string, instants: number[]) {
  const composition = await selectComposition({ serveUrl, id, inputProps: proprietes, ...reglages });
  for (const s of instants) {
    const output = resolve(travail, `${nom}-${String(Math.round(s * 100)).padStart(3, "0")}.png`);
    await renderStill({ composition, serveUrl, output, frame: Math.min(composition.durationInFrames - 1, Math.round(s * FPS)), inputProps: proprietes, ...reglages });
  }
  console.log(`${nom} : ${instants.length} images fixes dans ${travail}`);
}

/** Plateau rendu une fois (en cache) : la « piste montée » de démonstration. */
async function plateau(nom: string, p: Omit<ProprietesPlateau, "largeur" | "hauteur" | "fps" | "images">): Promise<string> {
  const fichier = resolve(travail, `plateau-${nom}.mp4`);
  if (!existsSync(fichier)) await rendre(COMPOSITION_PLATEAU_DEMO, { largeur: L, hauteur: H, fps: FPS, images: IMAGES, ...p }, fichier, 14);
  return fichier;
}

/** Bruitage de verre de la brique (synthèse maison, déterministe). */
function sonVerre(fichier: string) {
  writeFileSync(fichier, wavMono16(synthetiserVerre(48000)));
}

/** Pose le son à l'instant de l'effet et garde le fichier sous 3 Mo. */
function finaliser(video: string, fichier: string, son?: { wav: string; aSec: number }) {
  const argsSon = son ? ["-i", son.wav, "-filter_complex", `[1:a]adelay=${Math.round(son.aSec * 1000)}:all=1,apad=whole_dur=5[a]`, "-map", "0:v", "-map", "[a]", "-c:a", "aac", "-b:a", "128k", "-shortest"] : ["-map", "0:v", "-an"];
  let crf = 22;
  for (;;) {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", video, ...argsSon, "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", fichier]);
    const mo = statSync(fichier).size / 1e6;
    if (mo < 2.9 || crf >= 34) {
      console.log(`  → ${fichier.split("/").pop()} : ${mo.toFixed(2)} Mo (crf ${crf})`);
      return;
    }
    crf += 2;
  }
}

/* ------------------------------------------------------------------ */
/* Les effets de la planche                                            */
/* ------------------------------------------------------------------ */

interface FicheEffet {
  id: string;
  titre: string;
  phrase: string;
  detail: string;
}

const FICHES: FicheEffet[] = [
  { id: "main-logo", titre: "Logo Axion posé sur la paume", phrase: "« Monteur, pose le logo Axion dans ma main »", detail: "Le « A » en métal anodisé orange, debout sur un petit socle en aluminium brossé, REPOSE sur la paume tournée vers le haut. Il apparaît en fondu avec un léger éclat quand la paume s'ouvre, suit la main sans retard (roulis, tangage, lacet) et disparaît quand elle se ferme, se retourne ou sort." },
  { id: "main-telephone", titre: "Téléphone posé sur la paume", phrase: "« Monteur, mets un téléphone dans ma main »", detail: "Un smartphone modélisé comme un vrai (cadre métal brossé, verre avant et arrière, bloc photo, écran allumé) posé à plat sur la paume, incliné vers la caméra pour que l'écran se lise ; reflets tirés de l'image de la prise, lumière et grain accordés." },
  { id: "vitre", titre: "Vitre qui se brise", phrase: "« Monteur, brise l'écran quand je dis “stop” »", detail: "L'image se fissure depuis un point hors du visage, les éclats tombent avec un flou de mouvement et révèlent le plan suivant. Bruitage de verre (facultatif)." },
  { id: "vitre-carte", titre: "Vitre qui révèle une carte", phrase: "« Monteur, brise l'écran et révèle “Le temps perdu” »", detail: "Même effet ; derrière la vitre, une carte titre de la bibliothèque motion." },
  { id: "pli", titre: "L'écran se plie", phrase: "« Monteur, plie l'écran quand je passe au deuxième point »", detail: "L'image se replie comme une feuille, en vraie perspective, puis s'envole et révèle le plan suivant." },
  { id: "zoom", titre: "Zoom à travers l'écran", phrase: "« Monteur, fais un zoom à travers l'écran sur “maintenant” »", detail: "La caméra plonge dans l'image, qui s'ouvre en iris sur le plan suivant (cerclé d'orange)." },
];

const effets = choisis.length ? FICHES.filter((f) => choisis.some((c) => f.id.startsWith(c))) : FICHES;
const DEBUT_TRANSITION = 50;
const wavVerre = resolve(travail, "verre.wav");
sonVerre(wavVerre);

for (const f of effets) {
  const brut = resolve(travail, `${f.id}-brut.mp4`);
  let proprietes: Record<string, unknown>;
  let composition: string;
  let instantsControle: number[];
  let son: { wav: string; aSec: number } | undefined;
  if (f.id.startsWith("main-")) {
    const objet: ObjetMain = f.id === "main-logo" ? "logo-axion" : "telephone";
    const video = await plateauPhoto();
    // Lumière, reflets, flou et grain mesurés sur la prise (image à 2 s : la main est posée).
    const rvb = imageRvb(video, 2);
    const mains = echantillonnerPaume(f.id === "main-logo" ? 3 : 11);
    const proche = mains.reduce((a, b) => (Math.abs(b.t - 2) < Math.abs(a.t - 2) ? b : a));
    const xs = proche.points!.map((q) => q[0] * L);
    const ys = proche.points!.map((q) => q[1] * H);
    const zoneMain: [number, number, number, number] = [Math.min(...xs) - 40, Math.min(...ys) - 40, Math.max(...xs) - Math.min(...xs) + 80, Math.max(...ys) - Math.min(...ys) + 80];
    const prep = preparerObjetMain({
      objet,
      debutPriseSec: 0.3,
      finPriseSec: 4.9,
      mains,
      visage: pisteVisagePhoto(),
      priseVersMontee: (s) => s,
      monteeVersPrise: (s) => s,
      cadre: { x: 0, y: 0, largeur: 1, hauteur: 1 },
      largeur: L,
      hauteur: H,
      lumiere: estimerLumiere(rvb, L, H, PLATEAU_PHOTO.visage),
      environnement: carteEnvironnement(rvb, L, H),
      prise: caracterePrise(rvb, L, H, zoneMain),
      graine: 5,
    });
    if (!prep.ok) throw new Error(`Paume introuvable dans la piste simulée (${prep.analyse.raison}).`);
    const pp = prep.parametres.proprietes as ProprietesEffetObjetMain;
    console.log(`${f.id} : paume vers le haut ${prep.analyse.debutSec.toFixed(2)}-${prep.analyse.finSec.toFixed(2)} s ; lumière ${JSON.stringify(pp.lumiere)} ; prise ${JSON.stringify(pp.prise)}`);
    const poses = pp.poses;
    const debutImg = Math.round(prep.debutSec * FPS);
    const vide = { ...poses[0], visible: 0, eclat: -1, fuite: -1 };
    const toutes = Array.from({ length: IMAGES }, (_, i) => (i >= debutImg && i - debutImg < poses.length ? poses[i - debutImg] : vide));
    proprietes = { ...pp, images: IMAGES, source: adresse(video), debutSourceImage: 0, poses: toutes, surEchantillonnage: 2 } as unknown as Record<string, unknown>;
    composition = COMPOSITION_OBJET_MAIN;
    instantsControle = [0.9, 1.2, 1.6, 2.3, 3.1, 3.7, 4.2];
  } else {
    const style: StyleTransition = f.id.startsWith("vitre") ? "vitre-brisee" : f.id === "pli" ? "ecran-plie" : "zoom-traversant";
    const serreB = 1.28;
    const planA = await plateau("plan-a", { main: [], serre: 1 });
    const planB = await plateau("plan-b", { main: [], serre: serreB, mur: "#35251B" });
    let apres = { source: adresse(planB), debutImage: DEBUT_TRANSITION };
    if (f.id === "vitre-carte") {
      const carte = resolve(travail, "carte-titre.mp4");
      if (!existsSync(carte))
        await rendre(CATALOGUE_MOTION.titre.composition, { ratio: "9:16", largeur: L, hauteur: H, hauteurVideo: H, disposition: "plein-ecran", fps: FPS, images: 75, modele: "titre", donnees: { variante: "titre", surTitre: "Ce qui coûte cher", titre: "Le temps *perdu*", motCle: "perdu", sousTitre: "2 heures par jour" } }, carte, 14);
      apres = { source: adresse(carte), debutImage: 0 };
    }
    const duree = bornerDureeTransition(null, style);
    const visageB = boiteVisagePlateau(serreB);
    const p: ProprietesEffetTransition = {
      largeur: L,
      hauteur: H,
      fps: FPS,
      images: IMAGES,
      style,
      avant: { source: adresse(planA), debutImage: DEBUT_TRANSITION - 1 },
      apres,
      debutEffetImage: DEBUT_TRANSITION,
      dureeEffetImages: Math.round(duree * FPS),
      point: pointHorsVisage(L, H, visageB, undefined, style),
      ...(f.id === "vitre-carte" ? {} : { visageApres: visageB }),
      graine: 11,
    };
    proprietes = p as unknown as Record<string, unknown>;
    composition = COMPOSITION_TRANSITION;
    const d0 = DEBUT_TRANSITION / FPS;
    instantsControle = [d0 - 0.04, d0 + 0.08, d0 + 0.2, d0 + 0.4, d0 + duree * 0.6, d0 + duree * 0.85, d0 + duree + 0.04];
    if (style === "vitre-brisee") son = { wav: wavVerre, aSec: d0 };
  }
  if (imagesSeules) {
    await images(composition, proprietes, f.id, instantsControle);
    continue;
  }
  await rendre(composition, proprietes, brut, 16);
  finaliser(brut, resolve(sortie, `${f.id}.mp4`), son);
}

if (!imagesSeules) {
  const cartes = FICHES.map(
    (f) => `<figure>
      <video src="${f.id}.mp4" autoplay muted loop playsinline controls preload="metadata"></video>
      <figcaption><strong>${f.titre}</strong><q>${f.phrase.replace(/^« | »$/g, "")}</q><span>${f.detail}</span></figcaption>
    </figure>`,
  ).join("\n    ");
  writeFileSync(
    resolve(sortie, "index.html"),
    `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Effets spéciaux face caméra</title>
<style>
  :root { --fond: #16120F; --surface: #211A15; --orange: #C65A2E; --orange-vif: #E07040; --creme: #F6EEE0; --attenue: #A79E92; --filet: #3A322B; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--fond); color: var(--creme); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; padding: 32px 16px 64px; }
  header { max-width: 1200px; margin: 0 auto 28px; }
  h1 { font-size: 28px; margin: 0 0 6px; letter-spacing: -0.01em; }
  h1 b { color: var(--orange-vif); }
  header p { color: var(--attenue); margin: 0 0 6px; max-width: 760px; }
  header p.note { color: var(--creme); background: var(--surface); border-left: 3px solid var(--orange-vif); padding: 10px 14px; border-radius: 8px; }
  header p.note b { color: var(--orange-vif); font-weight: 600; }
  main { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 22px; }
  figure { margin: 0; background: var(--surface); border-radius: 18px; overflow: hidden; box-shadow: 0 0 0 1px var(--filet); }
  video { display: block; width: 100%; aspect-ratio: 9 / 16; background: #0C0A08; }
  figcaption { padding: 14px 16px 16px; display: grid; gap: 6px; }
  figcaption strong { font-size: 17px; }
  figcaption q { color: var(--orange-vif); font-size: 14px; font-weight: 600; quotes: "« " " »"; }
  figcaption span { color: var(--attenue); font-size: 14px; }
  .regles { max-width: 1200px; margin: 28px auto 0; color: var(--attenue); font-size: 14px; }
  .regles li { margin: 4px 0; }
</style>
</head>
<body>
<header>
  <h1>Effets spéciaux — <b>à la demande</b></h1>
  <p>Jamais posés tout seuls : seulement quand vous les demandez (« Monteur, … » au tournage, ou dans « Discuter avec mon monteur »). Chaque vidéo dure 5 s (1080 × 1920, 25 i/s).</p>
  <p class="note"><b>Effets « main » (nouvelle version) :</b> l'objet est posé sur la <b>paume tournée vers le haut</b>, main à plat devant soi, comme si on y posait un téléphone. Le plateau est un montage de deux <b>vraies photos</b> libres (une personne, une main paume vers le haut — photos de test publiées avec MediaPipe) : la main y bouge d'un bloc et ses doigts ne se replient pas, ce qui ne permet pas tout. <b>L'essai final se fera sur une vraie prise de Will</b> (main suivie par MediaPipe, lumière, reflets et grain mesurés sur la prise). Main retournée ou paume montrée de face : pas d'effet, « Effet non réussi — Réessayer » avec le conseil « montrez la paume ouverte vers le haut ».</p>
  <p>Les quatre transitions restent sur le plateau dessiné (piste simulée).</p>
</header>
<main>
    ${cartes}
</main>
<ul class="regles">
  <li>Le visage n'est jamais caché ; un seul effet fort à la fois ; une transition dure de 0,6 à 1,5 s, calée sur le mot demandé.</li>
  <li>Main pas trouvée assez longtemps : la vidéo sort sans l'effet, avec « Effet non réussi — Réessayer ».</li>
  <li>Sur vos vraies prises, la main est suivie par MediaPipe (21 points : poignet, jointures, orientation de la paume) ; la lumière (direction, température), les reflets, le flou et le grain de l'objet sont mesurés sur la prise.</li>
  <li>Option « ultra réaliste » (payante, coupée par défaut, seulement sur demande) : un passage de 3 à 5 s peut être retouché par IA (Higgsfield, Kling Omni Edit avec une image de référence de l'objet). Rien n'est envoyé tant que vous ne l'activez pas.</li>
</ul>
</body>
</html>
`,
  );
  console.log(`Page : ${resolve(sortie, "index.html")}`);
}
await serveur.fermer();
// Lecture du WAV pour vérifier qu'il existe (et éviter un fichier vide en cas d'erreur silencieuse).
if (readFileSync(wavVerre).length < 1000) throw new Error("Bruitage de verre vide.");
