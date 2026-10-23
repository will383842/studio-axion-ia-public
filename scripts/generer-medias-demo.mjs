// Génère les médias de démonstration dans public/demo/ avec ffmpeg (aucun visage réel).
// Usage : node scripts/generer-medias-demo.mjs   (ffmpeg dans le PATH ; police Arial Black de Windows ou FONT=/chemin/police.ttf)
//         node scripts/generer-medias-demo.mjs --complements   (seulement la section 8 : rushs neutres + exemples des formats à venir)
// Style : noir chaud #16120F, lueur orange, grand titre crème (comme les visuels Buffer).
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RACINE = join(process.cwd(), "public");
const DEMO = join(RACINE, "demo");
const POLICE = process.env.FONT ?? "C:/Windows/Fonts/ariblk.ttf";
const POLICE_TEXTE = process.env.FONT_TEXTE ?? "C:/Windows/Fonts/arialbd.ttf";
const TMP = mkdtempSync(join(tmpdir(), "studio-demo-"));

const FOND = "0x16120F";
const CREME = "0xF3EDE4";
const ORANGE = "0xE07040";
const ORANGE_FONCE = "0xC65A2E";

const TOUT = !process.argv.includes("--complements");

for (const d of ["", "rushs", "formats", "vignettes", "lut", "illustrations", "miniatures", "personnages", "habillage", "marque", "musiques", "bruitages"]) mkdirSync(join(DEMO, d), { recursive: true });
mkdirSync(join(RACINE, "icones"), { recursive: true });

let n = 0;
function texte(contenu) {
  const f = join(TMP, `t${n++}.txt`);
  writeFileSync(f, contenu, "utf8");
  return f.replace(/\\/g, "/").replace(/:/g, "\\:");
}
const police = (p) => p.replace(/:/g, "\\:");

function ff(args, nom) {
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`ÉCHEC ${nom}\n${r.stderr}`);
    process.exit(1);
  }
  console.log("ok", nom);
}

/** Lueur orange radiale (image fixe) aux dimensions données. */
function lueur(l, h, cy = 0.32, force = 0.42) {
  const f = join(TMP, `lueur-${l}x${h}-${cy}-${force}.png`);
  if (existsSync(f)) return f;
  const g = (base, cible) => `${base}+(${cible}-${base})*${force}*exp(-((X-W/2)*(X-W/2)+(Y-H*${cy})*(Y-H*${cy}))/(2*(W*0.42)*(W*0.42)))`;
  ff(["-f", "lavfi", "-i", `color=c=${FOND}:s=${l}x${h}:d=1`, "-vf", `format=rgb24,geq=r='${g(22, 224)}':g='${g(18, 112)}':b='${g(15, 64)}',vignette=PI/5`, "-frames:v", "1", f], `lueur ${l}x${h}`);
  return f;
}

/** Couches drawtext communes : étiquette AXION-IA + titre animé + mention IA. */
function couchesTitre({ titre, l, h, taille, dureeTitre = 0.6, mentionIA = true, animer = true }) {
  const c = [`drawtext=fontfile='${police(POLICE_TEXTE)}':textfile='${texte("AXION-IA")}':fontcolor=${ORANGE}:fontsize=${Math.round(taille * 0.32)}:x=(w-text_w)/2:y=h*0.12`];
  // Une couche par ligne (le saut de ligne de drawtext affiche un carré avec certaines polices).
  const lignes = titre.split("\n");
  const plusLongue = Math.max(...lignes.map((x) => x.length));
  taille = Math.min(taille, Math.floor((l * 0.9) / (plusLongue * 0.74)));
  const haut = l < h ? 0.3 : 0.2;
  lignes.forEach((ligne, i) => {
    const debut = 0.3 + i * 0.12;
    const alpha = animer ? `alpha='min(1,max(0,(t-${debut})/${dureeTitre}))'` : "alpha=1";
    const base = `h*${haut}+${Math.round(i * taille * 1.12)}`;
    const y = animer ? `y='${base}+40*max(0,1-(t-${debut})/${dureeTitre})'` : `y='${base}'`;
    c.push(`drawtext=fontfile='${police(POLICE)}':textfile='${texte(ligne)}':fontcolor=${CREME}:fontsize=${taille}:x=(w-text_w)/2:${y}:${alpha}`);
  });
  if (mentionIA) c.push(`drawtext=fontfile='${police(POLICE_TEXTE)}':textfile='${texte("Réalisé avec l'IA")}':fontcolor=${CREME}@0.8:fontsize=${Math.round(l * 0.026)}:x=w-text_w-${Math.round(l * 0.04)}:y=${Math.round(h * 0.04)}:box=1:boxcolor=0x000000@0.35:boxborderw=8:enable='lt(t,3)'`);
  return c;
}

function video({ nom, titre, sousTitres, l = 720, h = 1280, duree = 10 }) {
  const taille = Math.round(l * (l < h ? 0.105 : 0.06));
  const couches = couchesTitre({ titre, l, h, taille });
  const pas = duree / sousTitres.length;
  sousTitres.forEach((s, i) => {
    couches.push(
      `drawtext=fontfile='${police(POLICE)}':textfile='${texte(s)}':fontcolor=${i % 2 ? CREME : ORANGE}:fontsize=${Math.round(taille * 0.55)}:x=(w-text_w)/2:y=h*${l < h ? 0.72 : 0.8}:box=1:boxcolor=${FOND}@0.55:boxborderw=14:enable='between(t,${(i * pas + 0.8).toFixed(2)},${((i + 1) * pas + 0.6).toFixed(2)})'`,
    );
  });
  couches.push(`drawbox=x=0:y=ih-${Math.round(h * 0.006)}:w='iw*t/${duree}':h=${Math.round(h * 0.006)}:color=${ORANGE_FONCE}:t=fill`);
  const fond = lueur(l, h, l < h ? 0.32 : 0.4);
  const sortie = join(DEMO, `${nom}.mp4`);
  ff(
    [
      "-loop", "1", "-framerate", "30", "-t", String(duree), "-i", fond,
      "-f", "lavfi", "-t", String(duree), "-i", "sine=f=220:sample_rate=44100",
      "-f", "lavfi", "-t", String(duree), "-i", "sine=f=329.63:sample_rate=44100",
      "-filter_complex",
      `[0:v]scale=${l}:${h},format=yuv420p,${couches.join(",")}[v];[1:a][2:a]amix=inputs=2,volume=0.08,afade=t=in:d=1,afade=t=out:st=${duree - 1.5}:d=1.5[a]`,
      "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "64k", "-shortest", sortie,
    ],
    `${nom}.mp4`,
  );
  ff(["-ss", "2.5", "-i", sortie, "-frames:v", "1", "-q:v", "4", join(DEMO, `${nom}.jpg`)], `${nom}.jpg`);
  const ko = statSync(sortie).size / 1024;
  if (ko > 1500) console.warn(`  attention : ${nom}.mp4 fait ${Math.round(ko)} Ko`);
}

function affiche({ fichier, titre, l = 720, h = 1280, cy = 0.32, force = 0.42, mention = false }) {
  const taille = Math.round(l * (l < h ? 0.1 : 0.07));
  const couches = couchesTitre({ titre, l, h, taille, mentionIA: mention, animer: false });
  ff(["-i", lueur(l, h, cy, force), "-vf", `scale=${l}:${h},${couches.join(",")}`, "-frames:v", "1", "-q:v", "4", fichier], fichier.replace(RACINE, ""));
}

function image({ fichier, l, h, filtre }) {
  ff(["-f", "lavfi", "-i", filtre, "-frames:v", "1", "-q:v", "4", "-s", `${l}x${h}`, fichier], fichier.replace(RACINE, ""));
}

if (TOUT) {
/* ---------- 1. Vidéos (3 en 9:16 + 1 en 16:9) ---------- */
video({ nom: "avocat-droits", titre: "MON PATRON\nPEUT-IL LIRE\nMES MAILS ?", sousTitres: ["IL A LE DROIT…", "PAS POUR TOUT.", "UN MOT VOUS PROTÈGE :", "« PERSONNEL »."] });
video({ nom: "avocat-licenciement", titre: "LICENCIÉ\nPAR SMS :\nC'EST LÉGAL ?", sousTitres: ["LA RÉPONSE : NON.", "IL FAUT UNE LETTRE.", "GARDEZ CE SMS.", "C'EST UNE PREUVE."] });
video({ nom: "motion-chiffres", titre: "3 CHIFFRES\nSUR L'IA\nEN PME", sousTitres: ["1 TÂCHE SUR 3", "2 H PAR JOUR", "90 % DES DIRIGEANTS", "COMMENCEZ PETIT."], duree: 9 });
video({ nom: "podcast-entretien", titre: "L'IA VA-T-ELLE\nREMPLACER\nLES AVOCATS ?", sousTitres: ["« AU DÉBUT, JE N'Y CROYAIS PAS. »", "« PUIS UN CLIENT M'A MONTRÉ… »", "« DEUX HEURES PAR JOUR. »"], l: 1280, h: 720, duree: 12 });

/* ---------- 2. Vignettes de vidéos (affiches fixes) ---------- */
const TITRES = [
  "L'IA PEUT-ELLE\nREMPLACER MON\nCOMPTABLE ?",
  "TÉLÉTRAVAIL :\nQUI PAIE\nL'ÉLECTRICITÉ ?",
  "MES DONNÉES\nDANS CHATGPT :\nQUEL RISQUE ?",
  "CLAUSE DE\nNON-CONCURRENCE :\nUN PIÈGE ?",
  "RUPTURE\nCONVENTIONNELLE\nEN 3 ÉTAPES",
  "HEURES SUP\nNON PAYÉES :\nQUE FAIRE ?",
  "RGPD :\n5 ERREURS\nDE PME",
  "ARRÊT MALADIE\nET CONGÉS\nPAYÉS",
  "CRÉER UN DEVIS\nEN 2 MINUTES",
  "CE QUE J'AI\nAPPRIS CETTE\nSEMAINE",
];
TITRES.forEach((t, i) => affiche({ fichier: join(DEMO, "vignettes", `v-${String(i + 1).padStart(2, "0")}.jpg`), titre: t, cy: 0.25 + (i % 3) * 0.08, force: 0.35 + (i % 4) * 0.05 }));
affiche({ fichier: join(DEMO, "vignettes", "h-01.jpg"), titre: "LE STUDIO\nPODCAST", l: 1280, h: 720, cy: 0.45 });
affiche({ fichier: join(DEMO, "vignettes", "h-02.jpg"), titre: "DIRIGEANT DE PME :\nL'IA AU QUOTIDIEN", l: 1280, h: 720, cy: 0.45 });

/* ---------- 3. LUT : avant / après ---------- */
const SOLEIL = "(130*exp(-((X-W*0.68)*(X-W*0.68)+(Y-H*0.52)*(Y-H*0.52))/(2*3600)))";
const scene = `color=c=black:s=960x540:d=1,format=rgb24,geq=r='min(255,if(lt(Y,H*0.55),70+170*Y/(H*0.55),70-40*(Y-H*0.55)/(H*0.45))+${SOLEIL})':g='min(255,if(lt(Y,H*0.55),110+60*Y/(H*0.55),52-25*(Y-H*0.55)/(H*0.45))+0.8*${SOLEIL})':b='min(255,if(lt(Y,H*0.55),175-95*Y/(H*0.55),42-20*(Y-H*0.55)/(H*0.45))+0.4*${SOLEIL})'`;
image({ fichier: join(DEMO, "lut", "avant.jpg"), l: 960, h: 540, filtre: `${scene},drawtext=fontfile='${police(POLICE)}':textfile='${texte("AVANT")}':fontcolor=${CREME}@0.85:fontsize=40:x=32:y=h-72` });
const LUTS = {
  "axion-chaud": "colorbalance=rs=0.12:gs=0.02:bs=-0.12:rm=0.1:bm=-0.08,eq=saturation=1.25:contrast=1.08",
  neutre: "eq=saturation=0.95:contrast=1.02:brightness=0.02",
  cinema: "curves=preset=strong_contrast,colorbalance=rs=-0.1:bs=0.12:rh=0.12:bh=-0.1,eq=saturation=1.1",
};
for (const [nom, f] of Object.entries(LUTS)) {
  image({ fichier: join(DEMO, "lut", `${nom}.jpg`), l: 960, h: 540, filtre: `${scene},${f},drawtext=fontfile='${police(POLICE)}':textfile='${texte("APRÈS")}':fontcolor=${CREME}@0.85:fontsize=40:x=32:y=h-72` });
}

/* ---------- 4. Illustrations (12) ---------- */
const ILLUS = [
  ["TRIBUNAL", "0x3B2F2A", "0x8C6A4F"],
  ["CONTRAT", "0x2B2622", "0xC9B79C"],
  ["BUREAU", "0x1D2733", "0xC65A2E"],
  ["ACCORD", "0x2F3B2E", "0xD9A066"],
  ["ÉCRAN", "0x10202E", "0x4F8FC0"],
  ["SMS", "0x241A2E", "0xB06AC9"],
  ["FACTURES", "0x2E2A1A", "0xE3A64B"],
  ["RÉUNION", "0x1E2A2A", "0x8FB08A"],
  ["VILLE", "0x0F1424", "0xE07040"],
  ["CLAVIER", "0x1A1A1A", "0x9AA5B1"],
  ["CROISSANCE", "0x13261C", "0x6FCF97"],
  ["CAFÉ", "0x2A1C14", "0xB8865B"],
];
ILLUS.forEach(([mot, c0, c1], i) =>
  image({
    fichier: join(DEMO, "illustrations", `illu-${String(i + 1).padStart(2, "0")}.jpg`),
    l: 720,
    h: 1280,
    filtre: `gradients=s=720x1280:c0=${c0}:c1=${c1}:c2=${FOND}:nb_colors=3:type=${i % 2 ? "radial" : "linear"}:seed=${i + 3}:speed=0,vignette=PI/4,drawtext=fontfile='${police(POLICE)}':textfile='${texte(mot)}':fontcolor=${CREME}@0.92:fontsize=84:x=(w-text_w)/2:y=h*0.62`,
  }),
);

/* ---------- 5. Miniatures, personnages, habillage, marque ---------- */
affiche({ fichier: join(DEMO, "miniatures", "mini-1.jpg"), titre: "LA RÉPONSE\nVA VOUS\nSURPRENDRE", cy: 0.2, force: 0.5 });
affiche({ fichier: join(DEMO, "miniatures", "mini-2.jpg"), titre: "CE QUE\nPERSONNE\nNE DIT", cy: 0.5, force: 0.45 });
affiche({ fichier: join(DEMO, "miniatures", "mini-3.jpg"), titre: "À SAVOIR\nAVANT\nLUNDI", cy: 0.7, force: 0.4 });
for (const [nom, lettre, cy] of [["will", "W", 0.45], ["will-34", "W", 0.3], ["clara", "C", 0.5], ["sophie", "S", 0.55]]) {
  ff(["-i", lueur(512, 512, cy, 0.6), "-vf", `scale=512:512,drawtext=fontfile='${police(POLICE)}':textfile='${texte(lettre)}':fontcolor=${CREME}:fontsize=220:x=(w-text_w)/2:y=(h-text_h)/2`, "-frames:v", "1", "-q:v", "3", join(DEMO, "personnages", `${nom}.jpg`)], `personnages/${nom}.jpg`);
}
affiche({ fichier: join(DEMO, "habillage", "axion.jpg"), titre: "AXION-IA\nABONNEZ-VOUS", cy: 0.6, force: 0.55 });
affiche({ fichier: join(DEMO, "habillage", "sobre.jpg"), titre: "AXION-IA", cy: 0.5, force: 0.25 });
affiche({ fichier: join(DEMO, "indisponible.jpg"), titre: "BIENTÔT", cy: 0.5, force: 0.3 });
ff(["-f", "lavfi", "-i", `color=c=${ORANGE_FONCE}:s=512x512`, "-vf", `drawtext=fontfile='${police(POLICE)}':textfile='${texte("A")}':fontcolor=${CREME}:fontsize=300:x=(w-text_w)/2:y=(h-text_h)/2`, "-frames:v", "1", join(DEMO, "marque", "logo.png")], "marque/logo.png");

/* ---------- 6. Icônes de l'application (PWA) ---------- */
for (const [nom, taille, marge] of [["icone-180", 180, 1], ["icone-192", 192, 1], ["icone-512", 512, 1], ["icone-maskable-512", 512, 0.7]]) {
  ff(["-f", "lavfi", "-i", `color=c=${ORANGE_FONCE}:s=${taille}x${taille}`, "-vf", `drawtext=fontfile='${police(POLICE)}':textfile='${texte("A")}':fontcolor=${CREME}:fontsize=${Math.round(taille * 0.62 * marge)}:x=(w-text_w)/2:y=(h-text_h)/2`, "-frames:v", "1", join(RACINE, "icones", `${nom}.png`)], `icones/${nom}.png`);
}

/* ---------- 7. Sons ---------- */
const son = (fichier, filtre, duree) => ff(["-f", "lavfi", "-i", filtre, "-t", String(duree), "-ac", "1", "-b:a", "64k", fichier], fichier.replace(RACINE, ""));
son(join(DEMO, "essai-voix.mp3"), "sine=f=523.25,volume=0.2,afade=t=in:d=0.05,afade=t=out:st=0.8:d=0.5,apad=pad_dur=0.2", 1.5);
[[220, 0.12], [261.63, 0.12], [196, 0.1], [293.66, 0.12]].forEach(([f, v], i) =>
  son(join(DEMO, "musiques", `m-${i + 1}.mp3`), `sine=f=${f},volume=${v},tremolo=f=${2 + i}:d=0.4,afade=t=in:d=1,afade=t=out:st=6.5:d=1.5`, 8),
);
const BRUITAGES = [
  "anoisesrc=c=pink:a=0.3,highpass=f=800,afade=t=in:d=0.3,afade=t=out:st=0.3:d=0.5",
  "sine=f=60,volume=0.8,afade=t=out:st=0.05:d=0.5",
  "sine=f=880,volume=0.3,afade=t=out:st=0.02:d=0.15",
  "anoisesrc=c=white:a=0.4,highpass=f=3000,afade=t=out:st=0.01:d=0.04",
  "sine=f=1318.5,volume=0.25,afade=t=out:st=0.05:d=0.8",
  "anoisesrc=c=brown:a=0.15,lowpass=f=600",
];
BRUITAGES.forEach((f, i) => son(join(DEMO, "bruitages", `b-${i + 1}.mp3`), f, i === 5 ? 8 : 1));
}

/* ---------- 8. Rushs neutres (images « filmées », SANS mention IA) + exemples des formats à venir ---------- */
function rushNeutre({ nom, mot, c0, c1, duree = 6 }) {
  const sortie = join(DEMO, "rushs", `${nom}.mp4`);
  ff(
    [
      "-f", "lavfi", "-t", String(duree), "-i", `gradients=s=720x1280:c0=${c0}:c1=${c1}:c2=${FOND}:nb_colors=3:type=linear:speed=0.02:r=30`,
      "-vf", `vignette=PI/4,drawtext=fontfile='${police(POLICE_TEXTE)}':textfile='${texte(mot)}':fontcolor=${CREME}@0.75:fontsize=44:x=(w-text_w)/2:y=h*0.86,format=yuv420p`,
      "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "32", "-movflags", "+faststart", sortie,
    ],
    `rushs/${nom}.mp4`,
  );
  ff(["-ss", "1", "-i", sortie, "-frames:v", "1", "-q:v", "4", join(DEMO, "rushs", `${nom}.jpg`)], `rushs/${nom}.jpg`);
}
rushNeutre({ nom: "couloir", mot: "COULOIR", c0: "0x2B2622", c1: "0x8C6A4F" });
rushNeutre({ nom: "clavier", mot: "CLAVIER", c0: "0x1A1A1A", c1: "0x9AA5B1" });
rushNeutre({ nom: "depot", mot: "VIDÉO DÉPOSÉE (ESSAI)", c0: "0x1D2733", c1: "0x4F8FC0" });

// Exemples des formats « bientôt » (fiche du format, PLAN B.6.1). Créateur B : style pas encore défini, pas d'exemple inventé.
video({ nom: "formats/ecran-partage", titre: "CRÉER UN DEVIS\nEN 2 MINUTES", sousTitres: ["J'OUVRE L'OUTIL…", "JE COLLE MON TEXTE.", "ET VOILÀ LE DEVIS."], duree: 8 });
video({ nom: "formats/ugc", titre: "J'AI GAGNÉ\n2 H PAR JOUR", sousTitres: ["JE PERDAIS MON TEMPS.", "UN AMI M'EN A PARLÉ.", "JE LE CONSEILLE."], duree: 8 });
video({ nom: "formats/selfie", titre: "IL FAUT QUE\nJE VOUS\nRACONTE…", sousTitres: ["CE MATIN, UN CLIENT…", "IL AVAIT SIGNÉ SANS LIRE.", "LISEZ LA DERNIÈRE PAGE."], duree: 8 });

rmSync(TMP, { recursive: true, force: true });
console.log("Médias de démonstration prêts dans public/demo/");
