/**
 * Harnais V2 : la VRAIE chaîne face caméra (`avancerChaine`) contre le VRAI studio-aligneur (HTTP local), un faux R2
 * local (GET/PUT) et, si V2_HABILLAGE=1, le VRAI studio-rendu (STUDIO_RENDU_ESSAI=1). Un tour toutes les 2 s.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { avancerChaine, etatChaineInitial, livraisonChaine, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { creerFacecamHttp } from "@/fournisseurs/facecam/client";
import { obtenirServiceRendu } from "@/fournisseurs/rendu/client";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import type { CommandeFabrication } from "@/domaine/types";

const R2 = process.env.V2_R2 ?? "http://127.0.0.1:4700";
const url = (cle: string) => `${R2}/${cle}`;
const info = JSON.parse(readFileSync(process.env.V2_MOTS!, "utf-8")) as { dureeSec: number; texte: string };
const sortieEtat = process.env.V2_ETAT ?? "/tmp/claude-0/v2/etat.json";
const commande = {
  videoId: process.env.V2_VIDEO ?? "v2",
  formatId: "facecam",
  moteurId: "montage-facecam",
  ratios: (process.env.V2_RATIOS ?? "9:16").split(","),
  dureeCibleSec: 60,
  script: { blocs: [], texteComplet: process.env.V2_SANS_TEXTE ? "" : info.texte },
  distribution: [{ role: "Face caméra", source: "rush" }],
  prises: [{ id: "p1", partie: "version", cle: process.env.V2_PRISE ?? "prises/iphone.mov", mime: "video/quicktime", dureeSec: info.dureeSec, segmentIds: [] }],
  briques: { etalonnage: true, "sous-titres": true, "mention-ia": false },
  styles: { lut: null },
  entrees: JSON.parse(process.env.V2_ENTREES ?? "{}"),
  reglages: {},
  plans: [],
  prononciations: [],
} as unknown as CommandeFabrication;

const deps: DependancesChaine = {
  facecam: creerFacecamHttp(process.env.V2_ALIGNEUR ?? "http://127.0.0.1:4200", { cle: "cle-essai" }),
  urlLecture: async (c) => url(c),
  urlDepot: async (c) => url(c),
  lireJsonGz: async (c) => {
    const r = await fetch(url(c));
    return r.ok ? JSON.parse(gunzipSync(Buffer.from(await r.arrayBuffer())).toString("utf-8")) : null;
  },
  ecrireJsonGz: async (c, d) => {
    const r = await fetch(url(c), { method: "PUT", body: gzipSync(Buffer.from(JSON.stringify(d))) });
    if (!r.ok) throw new Error(String(r.status));
  },
  glossaire: ["Axion-IA"],
  ...(process.env.V2_HABILLAGE === "1"
    ? {
        habillage: {
          rendu: () => obtenirServiceRendu({ STUDIO_RENDU_URL: "http://127.0.0.1:4100", STUDIO_RENDU_CLE: "cle-essai" }),
          recette: RECETTE_COMPOSITION_FACECAM,
          signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([k, v]) => [k, url(v)])), depots: Object.fromEntries(depots.map((d) => [d.cle, url(d.cle)])) }),
          cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
        },
      }
    : {}),
};

async function main() {
  let etat: EtatChaine = process.env.V2_REPRENDRE ? JSON.parse(readFileSync(sortieEtat, "utf-8")) : etatChaineInitial();
  const t0 = Date.now();
  let avant = "";
  const max = Number(process.env.V2_TOURS ?? 2000);
  for (let i = 0; i < max && !etat.fini && !etat.echec; i++) {
    etat = await avancerChaine(etat, commande, { travailId: process.env.V2_TRAVAIL ?? "t-v2", versionId: "ver-1" }, deps);
    writeFileSync(sortieEtat, JSON.stringify(etat, null, 1));
    const resume = Object.entries(etat.travaux).map(([k, t]) => `${k}:${t!.statut}${t!.essais ? `(e${t!.essais})` : ""}${t!.progression !== undefined && t!.statut === "soumis" ? `${t!.progression}%` : ""}`).join(" ") + ` mots:${etat.mots?.statut ?? "-"} hab:${etat.habillage ? (etat.habillage.sortie ? "sortie" : etat.habillage.composition ? JSON.stringify(Object.fromEntries(Object.entries(etat.habillage.composition).map(([r, x]) => [r, (x as { phase?: string })?.phase]))) : `cartes ${etat.habillage.cartes.map((c) => c.statut[0]).join("")}`) : "-"} decl:${etat.declinaisons ? JSON.stringify(Object.fromEntries(Object.entries((etat.declinaisons as unknown as { formats?: Record<string, { cadrage?: { statut?: string } }> }).formats ?? {}).map(([r, f]) => [r, f.cadrage?.statut ?? "?"]))) : "-"}`;
    if (resume !== avant) {
      console.log(`[${((Date.now() - t0) / 1000).toFixed(0)} s] ${resume}`);
      for (const [k, t] of Object.entries(etat.travaux)) if (t?.statut === "echec") console.log(`   ${k} : ${JSON.stringify(t.erreur)}`);
      avant = resume;
    }
    await new Promise((r) => setTimeout(r, Number(process.env.V2_TICK_MS ?? 2000)));
  }
  console.log("FIN", JSON.stringify({ fini: etat.fini, echec: etat.echec, sauts: etat.sauts }));
  const l = livraisonChaine(etat);
  console.log("LIVRAISON", JSON.stringify({ montageCle: l.montageCle, dureeSec: l.dureeSec, version: l.version, alertes: l.alertes }, null, 1));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
