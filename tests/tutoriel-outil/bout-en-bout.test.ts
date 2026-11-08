/**
 * Lot I · « Tutoriel d'outil » branché : script → voix HeyGen épinglée → calage et sous-titres → plan de scènes (lot C,
 * validé) → rendu `TutorielOutil` 4:5 → autres formats → fiche vidéo. Voix, Claude et rendu SIMULÉS (doubles, aucun
 * appel réel ; FFmpeg et Chrome absents du cloud : le rendu est un double qui rend « terminé »).
 */
import { describe, expect, it } from "vitest";
import { VOIX_MAITRE_HEYGEN_ID } from "@/briques/voix-maitre/voix-epinglee";
import { schemaPlanStrict, type PlanValide } from "@/briques/plan-scenes/schema";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurTutorielOutil, validerScriptTutoriel, CODE_OUTILS_NON_RELIES } from "@/moteurs/montage-tutoriel-outil";
import type { ResultatFabrication } from "@/moteurs/types";
import { commandeTutoriel, outilsDoubles, SCRIPT, une, type Journal } from "./doubles";

const T0 = Date.UTC(2026, 10, 8, 9);
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });

async function mener(moteur: ReturnType<typeof creerMoteurTutorielOutil>, c: CommandeFabrication, travail: Travail, jusqua = 400) {
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

describe("tutoriel d'outil : de bout en bout, avec doubles", () => {
  it("script collé → vidéo rendue en 4:5 puis 9:16, voix épinglée, plan validé, sous-titres, carte de fin", async () => {
    const j = journalVide();
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j)) });
    const c = commandeTutoriel();
    const t0 = await moteur.lancer(c, { travailId: "t-to", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
    expect(t0.etapes.map((e) => e.cle)).toEqual(["script", "voix", "calage", "plan", "montage", "exports"]);
    const { travail, resultat } = await mener(moteur, c, t0);

    expect(travail.statut).toBe("termine");
    expect(travail.erreur).toBeUndefined();
    // Voix : la seule voix HeyGen épinglée, lue une fois.
    expect(j.voix).toEqual([VOIX_MAITRE_HEYGEN_ID]);
    // Plan : un seul appel (Opus 5.5, JSON), aucun appel d'écriture (le script collé fait foi).
    expect(j.claude).toHaveLength(1);
    expect(j.claude[0].modele).toBe("claude-opus-5-5");
    expect(j.claude[0].json).toBe(true);
    expect(j.claude[0].messages[0].contenu).toContain(SCRIPT);

    // Rendu : la composition TutorielOutil, 4:5 d'abord (1080 × 1350), puis 9:16.
    const compositions = j.rendus.filter((d) => d.operation === "composition");
    expect(compositions.map((d) => d.parametres.composition)).toEqual(["TutorielOutil", "TutorielOutil"]);
    const p45 = compositions[0].parametres.proprietes as { plan: PlanValide; sousTitres?: { segments: unknown[] }; fin: { titre: string }; finMs: number };
    expect(p45.plan.format).toEqual({ largeur: 1080, hauteur: 1350, fps: 25 });
    expect(p45.plan.facecam).toBe(false);
    expect(schemaPlanStrict.safeParse(p45.plan).success).toBe(true);
    expect(p45.plan.scenes.every((s) => s.niveau === 1 || s.niveau === 2)).toBe(true);
    expect(p45.plan.scenes.some((s) => s.niveau === 2 && s.calques?.some((k) => k.piece === "curseur"))).toBe(true);
    expect(p45.sousTitres?.segments.length).toBeGreaterThan(0);
    expect(p45.fin.titre).toBe("Axion IA");
    expect(compositions[0].entrees.audio).toMatch(/^https:\/\/stockage\.test\//);
    const p916 = compositions[1].parametres.proprietes as { plan: PlanValide };
    expect(p916.plan.format).toEqual({ largeur: 1080, hauteur: 1920, fps: 25 });

    // Fiche vidéo : une sortie par format, sous-titres et projet de montage gardés (plan réutilisable).
    expect(resultat!.sorties.map((s) => s.ratio)).toEqual(["4:5", "9:16"]);
    expect(resultat!.sorties[0].resolution).toBe("1080x1350");
    expect(resultat!.sorties[0].dureeSec).toBeGreaterThan(0);
    expect(resultat!.sousTitres?.length).toBeGreaterThan(0);
    const projet = resultat!.projetMontage.tutoriel as { plan: { plan: PlanValide; source: string } };
    expect(projet.plan.source).toBe("llm");
    expect(resultat!.lignesReelles.every((l) => l.total.centimes === 0)).toBe(true);
  });

  it("titre ou idée : le script écrit attend Williams (pause, pas d'échec), puis la validation lance la suite", async () => {
    const j = journalVide();
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j)) });
    const c = commandeTutoriel({ script: { blocs: [], texteComplet: "" }, entrees: { tutorielOutil: { idee: "Créer un tableau de bord" } } });
    const t0 = await moteur.lancer(c, { travailId: "t-idee", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
    const arret = await mener(moteur, c, t0);
    expect(arret.travail.statut).toBe("en_file");
    expect(arret.travail.erreur).toBeUndefined();
    expect(arret.travail.parametres?.pause).toMatchObject({ code: "TO_SCRIPT_A_VALIDER", script: SCRIPT });
    expect(j.voix).toEqual([]);
    // Un second tour ne réécrit pas le script (aucun nouvel appel).
    const encore = await moteur.avancer(arret.travail, c, T0 + 5000);
    expect(j.claude).toHaveLength(1);
    expect(encore.travail.parametres?.pause).toMatchObject({ code: "TO_SCRIPT_A_VALIDER" });

    const modifie = `${SCRIPT} Essayez dès aujourd'hui.`;
    const fin = await mener(moteur, c, validerScriptTutoriel(encore.travail, modifie));
    expect(fin.travail.statut).toBe("termine");
    expect(j.claude[1].messages[0].contenu).toContain("Essayez dès aujourd'hui.");
    expect((fin.resultat!.projetMontage.tutoriel as { script: { texte: string; source: string } }).script).toMatchObject({ texte: modifie, source: "valide" });
  });

  it("Claude en panne : plan de repli, vidéo livrée avec une réserve « À vérifier », jamais un échec", async () => {
    const j = journalVide();
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j, { claudeEnPanne: true })) });
    const c = commandeTutoriel({ ratios: ["4:5"] });
    const t0 = await moteur.lancer(c, { travailId: "t-repli", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
    const { travail, resultat } = await mener(moteur, c, t0);
    expect(travail.statut).toBe("termine");
    expect(resultat!.noteQualite.alertes.some((a) => a.message.startsWith("À vérifier · Plan de scènes"))).toBe(true);
    expect((resultat!.projetMontage.tutoriel as { plan: { source: string } }).plan.source).toBe("repli");
  });

  it("une autre voix que la voix épinglée est refusée avant toute lecture (rien n'est dépensé)", async () => {
    const j = journalVide();
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j, { idVoix: "f22784b5aaaa" })) });
    const c = commandeTutoriel();
    const { travail } = await mener(moteur, c, await moteur.lancer(c, { travailId: "t-voix", versionId: "ver-1", titre: "Tuto", maintenant: T0 }));
    expect(travail.statut).toBe("echec");
    expect(travail.erreur?.code).toBe("VOIX_NON_EPINGLEE");
    expect(j.voix).toEqual([]);
  });

  it("rendu en panne passagère : nouvelle demande, la vidéo sort quand même", async () => {
    const j = journalVide();
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j, { renduEchecs: 1 })) });
    const c = commandeTutoriel({ ratios: ["4:5"] });
    const { travail } = await mener(moteur, c, await moteur.lancer(c, { travailId: "t-rendu", versionId: "ver-1", titre: "Tuto", maintenant: T0 }));
    expect(travail.statut).toBe("termine");
    expect(j.rendus.filter((d) => d.operation === "composition").map((d) => d.idRendu)).toEqual(["t-rendu-4x5-0", "t-rendu-4x5-1"]);
  });

  it("sans outils reliés : pause claire, sans échec ni coût", async () => {
    const moteur = creerMoteurTutorielOutil({ outils: async () => null });
    const c = commandeTutoriel();
    const t = await moteur.lancer(c, { travailId: "t-sans", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
    const r = await moteur.avancer(t, c, T0 + 1000);
    expect(r.travail.statut).toBe("en_file");
    expect(r.travail.parametres?.pause).toMatchObject({ code: CODE_OUTILS_NON_RELIES });
    expect(r.travail.etapes.some((e) => e.statut === "echec")).toBe(false);
  });
});

describe("retouches : parties touchées seulement", () => {
  async function premiereVersion(j: Journal) {
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j)) });
    const c = commandeTutoriel({ ratios: ["4:5"] });
    const { resultat } = await mener(moteur, c, await moteur.lancer(c, { travailId: "t-v1", versionId: "ver-1", titre: "Tuto", maintenant: T0 }));
    return { moteur, c, parent: { versionId: "ver-1", projetMontage: resultat!.projetMontage, pistes: [] } };
  }

  it("même texte : le plan d'avant est repris tel quel (aucun appel Claude), la voix n'est pas relue", async () => {
    const j = journalVide();
    const { moteur, c, parent } = await premiereVersion(j);
    const t = await moteur.retoucher({ commande: c, contexte: { travailId: "t-r", versionId: "ver-2", titre: "Retouche", maintenant: T0 }, planIds: [], consigne: "Refaire", parent });
    expect(t.type).toBe("retouche");
    const { travail, resultat } = await mener(moteur, c, t);
    expect(travail.statut).toBe("termine");
    expect(j.claude).toHaveLength(1);
    expect(j.voix).toHaveLength(1);
    const plan = resultat!.projetMontage.tutoriel as { plan: { source: string; scenesTouchees: string[] } };
    expect(plan.plan).toMatchObject({ source: "repris", scenesTouchees: [] });
  });

  it("phrase ajoutée : nouveau plan, les scènes aux mêmes mots gardent leur contenu, seules les changées sont touchées", async () => {
    const j = journalVide();
    const { moteur, parent } = await premiereVersion(j);
    const ancien = (parent.projetMontage.tutoriel as { plan: { plan: PlanValide } }).plan.plan;
    const c2 = commandeTutoriel({ ratios: ["4:5"], script: { blocs: [], texteComplet: `${SCRIPT} Essayez dès aujourd'hui.` } });
    const t = await moteur.retoucher({ commande: c2, contexte: { travailId: "t-r2", versionId: "ver-2", titre: "Retouche", maintenant: T0 }, planIds: [], consigne: "Ajouter une phrase", parent });
    const { travail, resultat } = await mener(moteur, c2, t);
    expect(travail.statut).toBe("termine");
    const retenu = (resultat!.projetMontage.tutoriel as { plan: { plan: PlanValide; scenesTouchees: string[] } }).plan;
    expect(retenu.scenesTouchees.length).toBeGreaterThan(0);
    expect(retenu.scenesTouchees.length).toBeLessThanOrEqual(retenu.plan.scenes.length);
    // La première scène (mêmes mots) garde sa pièce et ses paramètres.
    expect(retenu.plan.scenes[0].piece).toBe(ancien.scenes[0].piece);
    expect(retenu.plan.scenes[0].parametres).toEqual(ancien.scenes[0].parametres);
  });

  it("réexport d'un format : seul le rendu est refait (ni voix, ni Claude)", async () => {
    const j = journalVide();
    const { moteur, c, parent } = await premiereVersion(j);
    const t = await moteur.reexporter({ commande: c, contexte: { travailId: "t-x", versionId: "ver-3", titre: "Format", maintenant: T0 }, cible: { ratio: "1:1" }, parent });
    expect(t.etapes.map((e) => e.cle)).toEqual(["montage"]);
    const { travail, resultat } = await mener(moteur, c, t);
    expect(travail.statut).toBe("termine");
    expect(j.claude).toHaveLength(1);
    expect(j.voix).toHaveLength(1);
    expect(resultat!.sorties.map((s) => s.ratio)).toEqual(["1:1"]);
  });
});
