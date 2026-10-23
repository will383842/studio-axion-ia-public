/**
 * L6 · après `rendre-l6.mts` : sous-titres témoins incrustés (heures de mots de `voix4.json`, 3 à 4 mots, Inter Bold,
 * encre sur l'ivoire comme la chaîne), planche des images clés (une rangée par vidéo, un écran par colonne, code de la
 * mise en page dessous) et page `VOIR-L6.html`. Local, gratuit.
 *
 * Usage : pnpm exec tsx outils/maquettes-variete/planche-l6.mts [nom de vidéo…]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const { FIN_APRES_DERNIER_MOT_SEC } = await import("../../src/formats/cas-concret");
const { calerFiche } = await import("../../src/moteurs/montage-cas-concret/calage");
const { ficheV4, finV4, motsV4 } = await import("../v4-fidelite/fiche-v4");

const RACINE = resolve(import.meta.dirname, "../..");
const SORTIE = join(RACINE, "outils/maquettes-variete/sortie/l6");
const POLICES = join(RACINE, "docs/formats/v4-reference/polices");
const ffmpeg = (a: string[]) => execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...a], { stdio: ["ignore", "pipe", "pipe"] });

type Ecran = { id: string; type: string; fond: string; miseEnPage: string; raccordEntree?: string; fondFort?: boolean };
const tirages = JSON.parse(readFileSync(join(SORTIE, "tirages.json"), "utf8")) as { video: string; format: string; combinaison: string; ecrans: Ecran[] }[];
const nomDe = (t: { video: string; format: string }) => `${t.video}${t.format === "4:5" ? "-4x5" : ""}`;

// Heures des écrans (même calage que le rendu).
const calage = calerFiche(ficheV4(), finV4(), motsV4(RACINE), { finApresDernierMotSec: FIN_APRES_DERNIER_MOT_SEC });
if (!calage.ok) throw new Error(calage.problemes.join("\n"));
const heures = [...calage.fiche.ecrans, ...calage.fin!.ecrans].map((e) => ({ id: e.id, debut: e.debutMs! / 1000, fin: e.finMs! / 1000 }));
const mots = motsV4(RACINE);

/** Sous-titres ASS : groupes de 3 à 4 mots, centre à 85 % (9:16) ou 88 % (4:5), encre sur l'ivoire, ivoire ailleurs. */
function ass(t: (typeof tirages)[number]): string {
  const H = t.format === "4:5" ? 1350 : 1920;
  const y = Math.round(H * (t.format === "4:5" ? 0.88 : 0.85));
  const hms = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`;
  const lignes: string[] = [];
  const encreDe = (id: string) => {
    const f = t.ecrans.find((x) => x.id === id);
    return f?.fond === "ivoire" && !f.fondFort && !f.miseEnPage.startsWith("chi-aplat") ? "&H000C1015" : "&H00FFFFFF";
  };
  for (let i = 0; i < mots.length; i += 4) {
    const g = mots.slice(i, i + 4);
    const debut = g[0]!.debutSec;
    const fin = Math.max(g.at(-1)!.finSec, (mots[i + 4]?.debutSec ?? g.at(-1)!.finSec + 0.3) - 0.02);
    // Comme la chaîne (couleur par plage d'écran) : la phrase est coupée aux changements d'écran, chaque morceau à la
    // couleur de SON écran.
    for (const h of heures) {
      const a = Math.max(debut, h.debut);
      const b = Math.min(fin, h.fin);
      if (b - a > 0.01) lignes.push(`Dialogue: 0,${hms(a)},${hms(b)},Base,,0,0,0,,{\\pos(540,${y})\\c${encreDe(h.id)}}${g.map((m) => m.mot).join(" ")}`);
    }
  }
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: ${H}\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Base,Inter,58,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,40,40,0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${lignes.join("\n")}\n`;
}

// Arguments : noms des vidéos dont les sous-titres sont à incruster (sans argument : toutes, une seule fois après le rendu).
const aIncruster = process.argv.slice(2);
for (const t of tirages) {
  if (aIncruster.length && !aIncruster.includes(nomDe(t))) continue;
  const mp4 = join(SORTIE, `${nomDe(t)}.mp4`);
  // Toujours depuis la copie sans sous-titres (jamais deux fois sur la même vidéo).
  const brute = join(tmpdir(), "rendu-l6-sans-sous-titres", `${nomDe(t)}.mp4`);
  if (!existsSync(brute)) continue;
  const fichierAss = join(SORTIE, `${nomDe(t)}.ass`);
  writeFileSync(fichierAss, ass(t));
  const tmp = join(SORTIE, `${nomDe(t)}-st.mp4`);
  ffmpeg(["-i", brute, "-vf", `ass=${fichierAss}:fontsdir=${POLICES}`, "-c:v", "libx264", "-crf", "30", "-preset", "medium", "-c:a", "copy", tmp]);
  renameSync(tmp, mp4);
  execFileSync("rm", [fichierAss]);
}

// Planche : une rangée par vidéo 9:16 (3 graines), un écran par colonne, mise en page écrite dessous.
const rangs: string[] = [];
for (const t of tirages.filter((x) => x.format === "9:16")) {
  const entrees: string[] = [];
  const filtres: string[] = [];
  t.ecrans.forEach((e, i) => {
    entrees.push("-i", join(SORTIE, "images", `${nomDe(t)}-${e.id}.jpg`));
    const code = e.miseEnPage.split(" · ")[0]!.replace("v4", "v4") + (e.raccordEntree ? ` +${e.raccordEntree.split("-")[0]}` : "") + (e.fondFort ? " (fond fort)" : "");
    filtres.push(`[${i}]scale=216:384,pad=216:430:0:0:white,drawtext=fontfile=${join(POLICES, "Inter-Bold.ttf")}:text='${e.id} ${code.replace(/'/g, "")}':fontsize=13:x=6:y=396:fontcolor=black[i${i}]`);
  });
  const sortie = join(SORTIE, `rang-${t.video}.jpg`);
  ffmpeg([...entrees, "-filter_complex", `${filtres.join(";")};${t.ecrans.map((_, i) => `[i${i}]`).join("")}hstack=inputs=${t.ecrans.length}`, "-q:v", "4", sortie]);
  rangs.push(sortie);
}
ffmpeg([...rangs.flatMap((r) => ["-i", r]), "-filter_complex", `${rangs.map((_, i) => `[${i}]`).join("")}vstack=inputs=${rangs.length}`, "-q:v", "4", join(SORTIE, "planche-l6.jpg")]);
for (const r of rangs) execFileSync("rm", [r]);

// Page de visionnage.
const cartes = tirages
  .map((t) => {
    const lignes = t.ecrans.map((e) => `<li><b>${e.id}</b> ${e.type} · ${e.fond}${e.fondFort ? " (fond fort)" : ""} — ${e.miseEnPage}${e.raccordEntree ? ` <i>(raccord ${e.raccordEntree})</i>` : ""}</li>`).join("");
    return `<section><h2>${t.video} · ${t.format}</h2><video controls preload="metadata" src="${nomDe(t)}.mp4" style="width:100%;max-width:${t.format === "4:5" ? 432 : 360}px"></video><ul>${lignes}</ul></section>`;
  })
  .join("\n");
writeFileSync(
  join(SORTIE, "VOIR-L6.html"),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cas concret L6</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#f4efe6;color:#15100c}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}section{background:#fff;border-radius:16px;padding:16px}h1{font-size:22px}h2{font-size:16px}li{font-size:13px;margin:2px 0}img{width:100%;border-radius:12px}</style></head>
<body><h1>Cas concret · L6 : mises en page branchées (fiche réelle « recrutement-apporteurs », 3 graines)</h1>
<p>Rendu local (Chromium), voix et heures de mots de la v4, sous-titres témoins. Chaque écran indique la mise en page tirée par le moteur.</p>
<p><img src="planche-l6.jpg" alt="Planche : image clé de chaque écran des 3 vidéos"></p>
<main>${cartes}</main></body></html>
`,
);
console.log("planche, sous-titres et page écrits dans", SORTIE);
