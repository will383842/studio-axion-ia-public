/**
 * Lot J · « Démo facecam » branchée : facecam + écran réel (ou une seule vidéo) → transcription de SA voix → calage
 * (service d'alignement) → sous-titres → plan de scènes autour de l'écran (lot C) → rendu `DemoFacecam` 4:5 → autres
 * formats → fiche vidéo. Transcription, alignement, Claude et rendu SIMULÉS (doubles, aucun appel réel ; FFmpeg et Chrome
 * absents du cloud : le rendu est un double qui rend « terminé »).
 */
import { describe, expect, it } from "vitest";
import { schemaPlanStrict, type PlanValide } from "@/briques/plan-scenes/schema";
import { seChevauchent, ZONE_VISAGE, ZONES } from "@/briques/plan-scenes/zones";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurDemoFacecam, CODE_OUTILS_DEMO_NON_RELIES } from "@/moteurs/montage-demo-facecam";
import { zoomA, type ProprietesDemoFacecam } from "@/moteurs/montage-demo-facecam/proprietes";
import type { ResultatFabrication } from "@/moteurs/types";
import { commandeDemo, journalVide, outilsDoubles, PAROLE, une } from "./doubles";

const T0 = Date.UTC(2026, 10, 8, 9);

async function mener(moteur: ReturnType<typeof creerMoteurDemoFacecam>, c: CommandeFabrication, travail: Travail, jusqua = 400) {
  let t = travail;
  let resultat: ResultatFabrication | undefined;
  for (let i = 0; i < jusqua; i++) {
    const r = await moteur.avancer(t, c, T0 + i * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
  }
  return { travail: t, resultat };
}

const ctx = (travailId: string) => ({ travailId, versionId: "ver-1", titre: "Démo", maintenant: T0 });
const compositions = (j: ReturnType<typeof journalVide>) => j.rendus.filter((d) => d.operation === "composition");
const props = (d: { parametres: Record<string, unknown> }) => d.parametres.proprietes as ProprietesDemoFacecam;

describe("démo facecam : de bout en bout, avec doubles", () => {
  it("facecam + écran → transcription de sa voix, calage, plan autour de l'écran, rendu 4:5 puis 9:16, fiche", async () => {
    const j = journalVide();
    const moteur = creerMoteurDemoFacecam({ outils: une(outilsDoubles(j)) });
    const c = commandeDemo();
    const t0 = await moteur.lancer(c, ctx("t-df"));
    expect(t0.etapes.map((e) => e.cle)).toEqual(["reception", "transcription", "calage", "plan", "montage", "exports"]);
    const { travail, resultat } = await mener(moteur, c, t0);
    expect(travail.statut).toBe("termine");
    expect(travail.erreur).toBeUndefined();

    // Sa voix réelle : la prise facecam est transcrite, puis calée par le service d'alignement (aucune voix de synthèse).
    expect(j.transcriptions).toHaveLength(1);
    expect(j.transcriptions[0].source).toBe("https://stockage.test/studio/test/prises/facecam.mp4");
    expect(j.alignements).toHaveLength(1);
    expect(j.alignements[0].audio).toBe("https://stockage.test/studio/test/prises/facecam.mp4");
    expect(j.alignements[0].texte).toBe(PAROLE);

    // Plan : un seul appel (Opus 5.5, JSON), en « face caméra » (rien sur le visage).
    expect(j.claude).toHaveLength(1);
    expect(j.claude[0].modele).toBe("claude-opus-5-5");
    expect(j.claude[0].json).toBe(true);
    expect(j.claude[0].messages[0].contenu).toContain("Face caméra : oui");

    const [d45, d916] = compositions(j);
    expect(compositions(j).map((d) => d.parametres.composition)).toEqual(["DemoFacecam", "DemoFacecam"]);
    // Les deux vidéos arrivent par les entrées (le son est celui de la facecam).
    expect(Object.keys(d45.entrees).sort()).toEqual(["videoEcran", "videoFacecam"]);
    const p = props(d45);
    expect(p.mode).toBe("deux");
    expect(p.format).toEqual({ largeur: 1080, hauteur: 1350, fps: 25 });
    // Moitié / moitié : l'écran en haut, la facecam en bas, sans recouvrement.
    expect(p.disposition).toBe("haut-bas");
    expect(p.ecran).toEqual({ x: 0, y: 0, largeur: 1080, hauteur: 674 });
    expect(p.facecam).toEqual({ x: 0, y: 674, largeur: 1080, hauteur: 676 });
    // Le plan vit DANS la moitié de l'écran : il ne peut pas passer devant le visage.
    expect(p.plan.format).toEqual({ largeur: 1080, hauteur: 674, fps: 25 });
    expect(p.plan.facecam).toBe(true);
    expect(p.plan.habillage).toEqual({ fond: "ivoire", accent: "terracotta" });
    expect(schemaPlanStrict.safeParse(p.plan).success).toBe(true);
    expect(p.plan.scenes.every((s) => s.niveau === 1 || s.niveau === 2)).toBe(true);
    for (const s of p.plan.scenes) expect(seChevauchent(ZONES[s.position], ZONE_VISAGE)).toBe(false);
    // Fausse fenêtre opaque → légende ; surlignage du clic (curseur) gardé ; zoom de la composition → zoom sur l'écran réel.
    expect(p.plan.scenes.some((s) => s.piece === "fenetre-app" || s.piece === "zoom-camera")).toBe(false);
    const s2 = p.plan.scenes.find((s) => s.niveau === 2)!;
    expect(s2.calques?.map((k) => k.piece)).toEqual(["curseur", "legende"]);
    expect(p.zooms.length).toBeGreaterThan(0);
    for (const z of p.zooms) {
      expect(z.facteur).toBeLessThanOrEqual(1.35);
      expect(z.finMs).toBeGreaterThan(z.debutMs);
    }
    const z = p.zooms[0];
    expect(zoomA(p.zooms, z.debutMs).facteur).toBe(1);
    expect(zoomA(p.zooms, (z.debutMs + z.finMs) / 2).facteur).toBeGreaterThan(1);
    // Sous-titres calés sur les mots CALÉS (+30 ms du double d'alignement), durée de Williams, carte de fin Axion.
    expect(p.sousTitres?.segments.length).toBeGreaterThan(0);
    const premier = (p.sousTitres!.segments[0] as unknown as { mots: { debutSec: number }[] }).mots[0];
    expect(premier.debutSec).toBeCloseTo(0.03, 3);
    expect(p.dureeMs).toBeGreaterThan(0);
    expect(p.fin.titre).toBe("Axion IA");
    expect(props(d916).format).toEqual({ largeur: 1080, hauteur: 1920, fps: 25 });
    expect(props(d916).plan.format).toEqual({ largeur: 1080, hauteur: 960, fps: 25 });

    // Fiche vidéo : une sortie par format, aucun prix, projet de montage réutilisable.
    expect(resultat!.sorties.map((s) => s.ratio)).toEqual(["4:5", "9:16"]);
    expect(resultat!.sorties[0].resolution).toBe("1080x1350");
    expect(resultat!.sousTitres?.length).toBeGreaterThan(0);
    expect(resultat!.lignesReelles.every((l) => l.total.centimes === 0)).toBe(true);
    const projet = resultat!.projetMontage.demoFacecam as { parole: { source: string }; scenesTouchees: string[] };
    expect(projet.parole.source).toBe("aligneur");
    expect(projet.scenesTouchees).toEqual(p.plan.scenes.map((s) => s.id));
    // Les deux vidéos calées par leur début : une remarque, jamais un refus.
    expect(resultat!.noteQualite.alertes.some((a) => a.gravite === "info" && a.message.includes("calées par leur début"))).toBe(true);
  });

  it("une seule vidéo déjà en écran partagé : gardée telle quelle, plan hors du visage, pas de zoom (remarque)", async () => {
    const j = journalVide();
    const moteur = creerMoteurDemoFacecam({ outils: une(outilsDoubles(j)) });
    const c = commandeDemo({ ratios: ["4:5"], entrees: { demoFacecam: { videoUniqueCle: "studio/test/prises/partage.mp4" } } });
    const { travail, resultat } = await mener(moteur, c, await moteur.lancer(c, ctx("t-un")));
    expect(travail.statut).toBe("termine");
    const p = props(compositions(j)[0]);
    expect(Object.keys(compositions(j)[0].entrees)).toEqual(["videoUnique"]);
    expect(p.mode).toBe("unique");
    expect(p.plan.format).toEqual({ largeur: 1080, hauteur: 1350, fps: 25 });
    expect(p.zooms).toEqual([]);
    for (const s of p.plan.scenes) expect(seChevauchent(ZONES[s.position], ZONE_VISAGE)).toBe(false);
    expect(resultat!.noteQualite.alertes.some((a) => a.message.includes("pas de zoom"))).toBe(true);
  });

  it("démo longue : la durée est celle de Williams (remarque, aucun refus)", async () => {
    const j = journalVide();
    const moteur = creerMoteurDemoFacecam({ outils: une(outilsDoubles(j, { pasSec: 6 })) });
    const c = commandeDemo({ ratios: ["4:5"] });
    expect(moteur.refusAuLancement?.(c)).toBeNull();
    const { travail, resultat } = await mener(moteur, c, await moteur.lancer(c, ctx("t-long")));
    expect(travail.statut).toBe("termine");
    expect(props(compositions(j)[0]).dureeMs).toBeGreaterThan(150_000);
    expect(resultat!.noteQualite.alertes.some((a) => a.gravite === "info" && a.message.includes("Démo longue"))).toBe(true);
  });

  it("transcription en panne : la vidéo sort quand même, avec une réserve « À vérifier · Sous-titres »", async () => {
    const j = journalVide();
    const moteur = creerMoteurDemoFacecam({ outils: une(outilsDoubles(j, { transcriptionEnPanne: true })) });
    const c = commandeDemo({ ratios: ["4:5"], prises: [{ id: "p1", partie: "version", cle: "x", mime: "video/mp4", dureeSec: 42, segmentIds: [] }] });
    const { travail, resultat } = await mener(moteur, c, await moteur.lancer(c, ctx("t-panne")));
    expect(travail.statut).toBe("termine");
    expect(j.transcriptions).toHaveLength(3);
    expect(j.alignements).toHaveLength(0);
    expect(props(compositions(j)[0]).dureeMs).toBe(42_000);
    expect(resultat!.noteQualite.alertes.some((a) => a.gravite === "attention" && a.message.startsWith("À vérifier · Sous-titres"))).toBe(true);
  });

  it("Claude en panne : plan simple, réserve « À vérifier · Plan », jamais d'échec", async () => {
    const j = journalVide();
    const moteur = creerMoteurDemoFacecam({ outils: une(outilsDoubles(j, { claudeEnPanne: true })) });
    const c = commandeDemo({ ratios: ["4:5"] });
    const { travail, resultat } = await mener(moteur, c, await moteur.lancer(c, ctx("t-claude")));
    expect(travail.statut).toBe("termine");
    expect(resultat!.noteQualite.alertes.some((a) => a.message.startsWith("À vérifier · Plan de scènes"))).toBe(true);
  });

  it("sans outils reliés : pause claire ; sans vidéo : pause qui le dit, sans échec", async () => {
    const sans = creerMoteurDemoFacecam({ outils: async () => null });
    const c = commandeDemo();
    const a = await sans.avancer(await sans.lancer(c, ctx("t-0")), c, T0);
    expect(a.travail.parametres?.pause).toMatchObject({ code: CODE_OUTILS_DEMO_NON_RELIES });
    expect(a.travail.statut).toBe("en_file");

    const moteur = creerMoteurDemoFacecam({ outils: une(outilsDoubles(journalVide())) });
    const vide = commandeDemo({ entrees: {} });
    const { travail } = await mener(moteur, vide, await moteur.lancer(vide, ctx("t-vide")));
    expect(travail.statut).toBe("en_file");
    expect(travail.erreur).toBeUndefined();
    expect(travail.parametres?.pause).toMatchObject({ code: "DF_VIDEO_ABSENTE" });
  });

  it("retouche, même prise : rien n'est retranscrit ni recomposé, aucune scène touchée ; réexport 1:1 sans appel", async () => {
    const j1 = journalVide();
    const moteur1 = creerMoteurDemoFacecam({ outils: une(outilsDoubles(j1)) });
    const c = commandeDemo({ ratios: ["4:5"] });
    const premier = await mener(moteur1, c, await moteur1.lancer(c, ctx("t-v1")));
    const parent = { projetMontage: premier.resultat!.projetMontage } as never;
    const planAvant = (premier.resultat!.projetMontage.demoFacecam as { plan: PlanValide }).plan;

    const j2 = journalVide();
    const moteur2 = creerMoteurDemoFacecam({ outils: une(outilsDoubles(j2)) });
    const t = await moteur2.retoucher!({ commande: c, contexte: { ...ctx("t-v2"), versionId: "ver-2" }, parent } as never);
    const { travail, resultat } = await mener(moteur2, c, t);
    expect(travail.statut).toBe("termine");
    expect(j2.transcriptions).toHaveLength(0);
    expect(j2.alignements).toHaveLength(0);
    expect(j2.claude).toHaveLength(0);
    const projet = resultat!.projetMontage.demoFacecam as { plan: PlanValide; scenesTouchees: string[] };
    expect(projet.scenesTouchees).toEqual([]);
    expect(projet.plan.scenes.map((s) => s.empreinte)).toEqual(planAvant.scenes.map((s) => s.empreinte));

    const j3 = journalVide();
    const moteur3 = creerMoteurDemoFacecam({ outils: une(outilsDoubles(j3)) });
    const r = await moteur3.reexporter!({ commande: c, contexte: { ...ctx("t-v3"), versionId: "ver-3" }, cible: { ratio: "1:1" }, parent } as never);
    const fin = await mener(moteur3, c, r);
    expect(fin.travail.statut).toBe("termine");
    expect(j3.claude).toHaveLength(0);
    expect(j3.transcriptions).toHaveLength(0);
    expect(props(compositions(j3)[0]).format).toEqual({ largeur: 1080, hauteur: 1080, fps: 25 });
    expect(fin.resultat!.sorties.map((s) => s.ratio)).toEqual(["1:1"]);
  });
});
