/** ESS-6L : le résultat de la vidéo longue ne dit que le vrai (taille mesurée, son non mesuré signalé). Aucun appel réel. */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { avancerVideoLongue } from "@/moteurs/montage-video-longue/chaine";
import { lireEntreesVideoLongue } from "@/moteurs/montage-video-longue/entrees";
import { definitionVideoLongue } from "@/moteurs/montage-video-longue";

const chapitres = [{ id: "c1", titre: "Pourquoi", texte: "un deux trois quatre cinq" }];
const cmd = (sansVoix: boolean) => ({ videoId: "v", ratios: ["16:9"], distribution: [], entrees: { videoLongue: { chapitres, sansVoix } } }) as unknown as CommandeFabrication;

async function resultat(sansVoix: boolean, taille?: number) {
  const voix = { lire: async () => ({ mots: [{ mot: "un", debutSec: 0, finSec: 1 }], dureeSec: 1, morceaux: [{}] }) };
  const deps = { voix, monter: async () => ({ fichierCle: "k" }), monterPas: async () => ({ fini: { fichierCle: "k", ...(taille === undefined ? {} : { taille }) } }) } as never;
  const def = definitionVideoLongue(() => deps);
  const c = cmd(sansVoix);
  const entrees = lireEntreesVideoLongue(c);
  const ctx = { commande: c, entrees, travailId: "t", versionId: "v", tentative: 1, etapes: def.etapesFabrication };
  let etat = def.etatInitial(entrees, c);
  for (let i = 0; i < 12 && !etat.fini && !etat.echec; i++) etat = await avancerVideoLongue(etat, ctx, deps);
  return def.resultat(c, etat, entrees);
}

describe("ESS-6L résultat honnête", () => {
  it("la taille est celle que le collage a mesurée", async () => {
    expect((await resultat(true, 3_700_000)).sorties[0].taille).toBe(3_700_000);
  });
  it("taille inconnue : 0, jamais inventée", async () => {
    expect((await resultat(true)).sorties[0].taille).toBe(0);
  });
  it("sans voix : alerte claire, niveau obligatoire -70, vignette vide", async () => {
    const r = await resultat(true);
    expect(r.sorties[0].rapportQualite.niveauSonoreLufs).toBe(-70);
    expect(r.sorties[0].vignetteCle).toBe("");
    expect(r.sorties[0].rapportQualite.alertes.map((a) => a.message)).toContain("Son : vidéo sans voix, aucun niveau mesuré");
    expect(r.noteQualite.alertes.map((a) => a.message)).toContain("Son : vidéo sans voix, aucun niveau mesuré");
  });
  it("avec voix et sans mesure : son non vérifié et alerte « à vérifier »", async () => {
    const r = await resultat(false);
    expect(r.sorties[0].rapportQualite.verifie.son).toBe(false);
    const msg = "À vérifier · Son : niveau non mesuré (la valeur affichée est la cible)";
    expect(r.sorties[0].rapportQualite.alertes.map((a) => a.message)).toContain(msg);
    expect(r.noteQualite.alertes.map((a) => a.message)).toContain(msg);
  });
});
