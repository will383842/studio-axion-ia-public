/**
 * Script local, hors CI. À lancer par la session qui déploie, sur 3 vraies vidéos ; zéro euro (rendu local).
 * Commande : pnpm exec tsx outils/segments/mesurer-rendu.ts <video1.json> <video2.json> <video3.json>
 *            pnpm exec tsx outils/segments/mesurer-rendu.ts --aide   (n'affiche que l'aide, ne rend rien)
 *
 * Chaque fichier JSON décrit une vidéo déjà fabriquée sur le poste :
 *   { "composition": "<id>", "props": { ... }, "scenes": [ { "nom": "scène 1", "debut": 0, "fin": 89 }, ... ] }
 * (images incluses des deux côtés). Pour chaque vidéo : chaque scène est rendue seule (frameRange), puis la vidéo
 * entière ; temps (ms) et taille (octets) sont mesurés. Le passage final (encodage maître) est mesuré s'il est
 * séparable, c'est-à-dire si le fichier JSON porte "passageFinal": { "entree": "<video.mp4>" } : réencodage local ffmpeg.
 * Remotion est pris dans studio-rendu/node_modules. Sortie : un tableau Markdown sur la sortie standard ;
 * rien n'est écrit dans le dépôt, rien n'est envoyé, aucun téléchargement.
 */

import { resolve as resoudre } from "node:path";
import { fileURLToPath } from "node:url";

export type GenreMesure = "scene" | "entier" | "final";

export interface MesureRendu {
  nom: string;
  genre: GenreMesure;
  images: number;
  ms: number;
  octets: number;
}

export interface LigneTableau extends MesureRendu {
  msParImage: number;
}

export interface TableauMesures {
  lignes: LigneTableau[];
  totaux: {
    scenes: { images: number; ms: number; octets: number };
    entier: { images: number; ms: number; octets: number };
  };
  /** Somme des temps des scènes / temps du rendu entier ; null si l'un des deux manque ou est nul. */
  rapport: number | null;
}

const parImage = (ms: number, images: number): number => (images > 0 ? ms / images : 0);

function somme(mesures: MesureRendu[]): { images: number; ms: number; octets: number } {
  return mesures.reduce(
    (t, m) => ({ images: t.images + m.images, ms: t.ms + m.ms, octets: t.octets + m.octets }),
    { images: 0, ms: 0, octets: 0 },
  );
}

/** Partie pure : lignes, totaux et rapport « somme des scènes / rendu entier ». Ne lève jamais. */
export function tableauMesures(mesures: MesureRendu[]): TableauMesures {
  const lignes = mesures.map((m) => ({ ...m, msParImage: parImage(m.ms, m.images) }));
  const scenes = somme(mesures.filter((m) => m.genre === "scene"));
  const entier = somme(mesures.filter((m) => m.genre === "entier"));
  const rapport = scenes.ms > 0 && entier.ms > 0 ? scenes.ms / entier.ms : null;
  return { lignes, totaux: { scenes, entier }, rapport };
}

/** Partie pure : tableau Markdown. */
export function enMarkdown(t: TableauMesures): string {
  const ligne = (nom: string, i: number, ms: number, o: number) =>
    `| ${nom} | ${i} | ${ms} | ${o} | ${parImage(ms, i).toFixed(2)} |`;
  const sortie = ["| Élément | Images | ms | Octets | ms par image |", "|---|---:|---:|---:|---:|"];
  for (const l of t.lignes) sortie.push(ligne(l.nom, l.images, l.ms, l.octets));
  if (t.lignes.length > 0) {
    sortie.push(ligne("**Somme des scènes**", t.totaux.scenes.images, t.totaux.scenes.ms, t.totaux.scenes.octets));
    sortie.push(ligne("**Rendu entier**", t.totaux.entier.images, t.totaux.entier.ms, t.totaux.entier.octets));
  }
  sortie.push("", `Somme des scènes / rendu entier : ${t.rapport === null ? "n/a" : t.rapport.toFixed(2)}`);
  return sortie.join("\n");
}

const AIDE = `Script local, hors CI. À lancer par la session qui déploie, sur 3 vraies vidéos ; zéro euro (rendu local).
Commande : pnpm exec tsx outils/segments/mesurer-rendu.ts <video1.json> <video2.json> <video3.json>
Format d'un fichier : { "composition": "<id>", "props": {}, "scenes": [{ "nom": "scène 1", "debut": 0, "fin": 89 }], "passageFinal": { "entree": "<video.mp4>" } }
Sortie : tableau Markdown sur la sortie standard. Rien n'est écrit, rien n'est envoyé.`;

interface Fiche {
  composition: string;
  props?: Record<string, unknown>;
  scenes: { nom: string; debut: number; fin: number }[];
  passageFinal?: { entree: string };
}

async function principal(args: string[]): Promise<void> {
  if (args.length === 0 || args.includes("--aide") || args.includes("--help")) {
    console.log(AIDE);
    return;
  }
  const { readFileSync, statSync, mkdtempSync, rmSync } = await import("node:fs");
  const { join, resolve } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const { spawnSync } = await import("node:child_process");
  const { createRequire } = await import("node:module");
  const exigerRendu = createRequire(resolve("studio-rendu", "package.json"));
  const { bundle } = exigerRendu("@remotion/bundler") as { bundle: (o: { entryPoint: string }) => Promise<string> };
  const { renderMedia, selectComposition } = exigerRendu("@remotion/renderer") as {
    renderMedia: (o: Record<string, unknown>) => Promise<unknown>;
    selectComposition: (o: Record<string, unknown>) => Promise<{ durationInFrames: number } & Record<string, unknown>>;
  };

  const dossier = mkdtempSync(join(tmpdir(), "mesure-rendu-"));
  const serveUrl = await bundle({ entryPoint: resolve("studio-rendu", "compositions", "index.ts") });
  try {
    for (const chemin of args) {
      const fiche = JSON.parse(readFileSync(chemin, "utf8")) as Fiche;
      const composition = await selectComposition({ serveUrl, id: fiche.composition, inputProps: fiche.props ?? {} });
      const mesures: MesureRendu[] = [];
      const rendre = async (nom: string, genre: GenreMesure, plage: [number, number] | null) => {
        const sortie = join(dossier, `${mesures.length}.mp4`);
        const t0 = Date.now();
        await renderMedia({
          composition,
          serveUrl,
          codec: "h264",
          outputLocation: sortie,
          inputProps: fiche.props ?? {},
          ...(plage ? { frameRange: plage } : {}),
        });
        const images = plage ? plage[1] - plage[0] + 1 : composition.durationInFrames;
        mesures.push({ nom: `${fiche.composition} · ${nom}`, genre, images, ms: Date.now() - t0, octets: statSync(sortie).size });
      };
      for (const s of fiche.scenes) await rendre(s.nom, "scene", [s.debut, s.fin]);
      await rendre("vidéo entière", "entier", null);
      if (fiche.passageFinal) {
        const sortie = join(dossier, `final-${mesures.length}.mp4`);
        const t0 = Date.now();
        const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", fiche.passageFinal.entree, "-c:v", "libx264", "-crf", "18", "-c:a", "aac", sortie]);
        if (r.status === 0) {
          mesures.push({ nom: `${fiche.composition} · passage final`, genre: "final", images: composition.durationInFrames, ms: Date.now() - t0, octets: statSync(sortie).size });
        } else {
          console.error(`passage final ignoré pour ${fiche.composition} : ffmpeg a échoué (code ${r.status ?? "inconnu"}) ${String(r.stderr ?? "").trim()}`);
        }
      }
      console.log(`\n### ${fiche.composition}\n`);
      console.log(enMarkdown(tableauMesures(mesures)));
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

if (process.argv[1] && resoudre(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
