/**
 * T-EXT-52c · Retouche par plages : seules les scènes touchées sont rendues (muettes), puis recollées dans le fichier d'avant avec
 * la voix d'avant. Moteur réel ; voix, Claude et rendu SIMULÉS (doubles) : aucun appel réel, aucun rendu réel, 0 €.
 * Réglage éteint = aucune demande « plage » ni « recollage » (comportement d'avant).
 */
import { describe, expect, it } from "vitest";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import type { EtatRendu, ServiceRendu } from "@/fournisseurs/types";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { avecEmpreintes, scenesARerendre } from "@/briques/plan-scenes/empreinte";
import { avancerEtape, sortieGardee } from "@/moteurs/montage-tutoriel-outil/chaine";
import { creerMoteurTutorielOutil, type EtatTutoriel, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";

const T0 = Date.UTC(2026, 10, 8, 9);
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });
type Moteur = ReturnType<typeof creerMoteurTutorielOutil>;
const TROIS: CommandeFabrication["ratios"] = ["4:5", "9:16", "1:1"];
const NB_SCENES = 6;

/** Faux Claude : un plan de 6 scènes de même durée (une fenêtre d'application par scène), à partir des mots de la requête. */
function planSixScenes(requete: RequeteClaude): string {
  const lignes = requete.messages[0].contenu.split("\n").filter((l) => /^\d+\t/.test(l));
  const n = lignes.length;
  const ms = (i: number, col: 2 | 3) => Number(lignes[i].split("\t")[col]);
  const bornes = Array.from({ length: NB_SCENES + 1 }, (_, k) => Math.floor((k * n) / NB_SCENES));
  return JSON.stringify({
    version: "plan-scenes-1",
    habillage: { fond: "ivoire", accent: "terracotta" },
    scenes: Array.from({ length: NB_SCENES }, (_, k) => ({
      id: `s${k + 1}`,
      version: 1,
      mots: { premier: bornes[k], dernier: bornes[k + 1] - 1 },
      debutMs: ms(bornes[k], 2),
      finMs: k === NB_SCENES - 1 ? ms(n - 1, 3) : ms(bornes[k + 1], 2),
      niveau: 1,
      position: "plein",
      transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 },
      piece: "fenetre-app",
      parametres: { titre: "Tableaux", onglets: ["Accueil", "Ventes"], ongletActif: k % 2, contenu: "formulaire" },
    })),
  });
}

function outils(j: Journal, partielle?: boolean, plus: Partial<OutilsTutoriel> = {}): OutilsTutoriel {
  const base = outilsDoubles(j);
  const claude: OutilsTutoriel["claude"] = async (requete) => {
    if (!requete.json) return base.claude!(requete);
    j.claude.push(requete);
    return { texte: planSixScenes(requete), modeleDemande: requete.modele, modele: requete.modele, replis: [], stopReason: "end_turn", jetons: { entree: 10, sortie: 10 } } as unknown as ReponseClaude;
  };
  return { ...base, claude, ...(partielle === undefined ? {} : { retouchePartielle: partielle }), ...plus };
}

async function mener(moteur: Moteur, c: CommandeFabrication, travail: Travail, jusqua = 800) {
  let t = travail;
  for (let i = 1; i <= jusqua; i++) {
    const r = await moteur.avancer(t, c, T0 + i * 1000);
    t = r.travail;
    if (r.resultat || t.statut === "echec") return { travail: t, resultat: r.resultat };
  }
  throw new Error(`pas fini : ${t.statut}`);
}

const etatDe = (t: Travail) => (t.parametres as { tutoriel: EtatTutoriel }).tutoriel;

async function premiere(partielle: boolean | undefined) {
  const j = journalVide();
  const moteur = creerMoteurTutorielOutil({ outils: une(outils(j, partielle)) });
  const c = commandeTutoriel({ ratios: TROIS });
  const { travail } = await mener(moteur, c, await moteur.lancer(c, { travailId: "t-v1", versionId: "ver-1", titre: "Tuto", maintenant: T0 }));
  return { j, etat: etatDe(travail), c };
}

/**
 * Retouche au niveau de la chaîne : l'état de la version d'avant devient `parent` (plan, voix, fichiers rendus, empreintes) et le
 * plan retouché (scènes `touchees` changées) est le plan courant, avec ses scènes touchées calculées comme `pasPlanClassique`.
 * (Par `moteur.retoucher` + opération `planScenes`, `etatDepuisParent` remplace déjà le plan d'avant : voir la PR, HORS PERIMETRE.)
 */
async function retoucher(avant: EtatTutoriel, c: CommandeFabrication, partielle: boolean | undefined, touchees: number[], variante: { empreinteVoixAvant?: string; refuserRecollage?: boolean } = {}) {
  const j = journalVide();
  const base = outils(j, partielle);
  const service: ServiceRendu = {
    soumettre: (d) => base.rendu.service().soumettre(d),
    async etat(id): Promise<EtatRendu> {
      const e = await base.rendu.service().etat(id);
      const refus = variante.refuserRecollage && j.rendus.find((x) => x.idRendu === id)?.operation === "recollage-plages" && e.statut === "termine";
      return refus ? { statut: "echec", erreur: { code: "refuse", reessayable: false, message: "borne hors image clé" } as never } : e;
    },
  };
  const o: OutilsTutoriel = { ...base, rendu: { ...base.rendu, service: () => service } };
  const brut = structuredClone(avant.plan!.plan);
  for (const k of touchees) brut.scenes[k].parametres = { ...(brut.scenes[k].parametres as Record<string, unknown>), titre: `Tableaux ${k + 1}` } as never;
  const plan = avecEmpreintes(brut);
  const rendusAvant = Object.fromEntries(avant.rendus.map((r) => [r.ratio, sortieGardee(r)]));
  let etat: EtatTutoriel = {
    ...avant,
    rendus: [],
    reserves: [],
    empreintesFormats: undefined,
    regard: undefined,
    plan: { ...avant.plan!, plan, scenesTouchees: scenesARerendre(avant.plan!.plan, plan) },
    parent: { plan: avant.plan!.plan, audio: variante.empreinteVoixAvant ? { ...avant.audio!, empreinte: variante.empreinteVoixAvant } : avant.audio, rendus: rendusAvant, empreintesFormats: avant.empreintesFormats, fin: avant.fin },
  };
  for (const cle of ["montage", "exports"] as const) {
    for (let i = 0; i < 200; i++) {
      const pas = await avancerEtape(cle, etat, c, o, "t-r");
      etat = pas.etat;
      if (pas.statut === "faite") break;
      if (i === 199) throw new Error(`pas fini : ${cle}`);
    }
  }
  return { j, etat };
}

const plagesDe = (j: Journal) => j.rendus.filter((d) => d.operation === "composition" && d.parametres.mode === "plage");
const entieres = (j: Journal) => j.rendus.filter((d) => d.operation === "composition" && d.parametres.mode !== "plage");
const recollages = (j: Journal) => j.rendus.filter((d) => d.operation === "recollage-plages");
const url = (cle: string) => `https://stockage.test/${cle}`;

describe("tutoriel d'outil : retouche par plages (52c)", () => {
  it("1 scène touchée sur 6 : par format, une demande `plage` MUETTE + un recollage avec le fichier et la voix d'avant", async () => {
    const { etat: avant, c } = await premiere(true);
    expect(avant.plan!.plan.scenes).toHaveLength(NB_SCENES);
    const r = await retoucher(avant, c, true, [2]);
    expect(r.etat.plan!.scenesTouchees).toEqual(["s3"]);
    expect(entieres(r.j)).toHaveLength(0);
    expect(plagesDe(r.j)).toHaveLength(3);
    expect(recollages(r.j)).toHaveLength(3);
    const voixAvant = avant.audio!.fichierCle!;
    for (const d of plagesDe(r.j)) {
      // Muet : aucune entrée « audio » ; mêmes propriétés complètes que le rendu d'origine (plan, finMs, sous-titres).
      expect(d.entrees.audio).toBeUndefined();
      expect(d.parametres).toMatchObject({ composition: "TutorielOutil", mode: "plage", recollable: true });
      expect(d.parametres.proprietes).toMatchObject({ plan: expect.objectContaining({ scenes: expect.any(Array) }), finMs: expect.any(Number) });
      expect((d.parametres.proprietes as { plan: { scenes: { id: string; parametres: { titre: string } }[] } }).plan.scenes[2].parametres.titre).toBe("Tableaux 3");
      expect(d.parametres.debut as number).toBeGreaterThanOrEqual(0);
      expect(d.parametres.fin as number).toBeGreaterThan(d.parametres.debut as number);
    }
    for (const ratio of TROIS) {
      const nom = ratio.replace(":", "x");
      const d = recollages(r.j).find((x) => x.idRendu === `t-r-${nom}-recollage-0`)!;
      const fichierAvant = avant.rendus.find((x) => x.ratio === ratio)!.sortie!.fichierCle;
      expect(d.entrees.avant).toBe(url(fichierAvant));
      expect(d.entrees.voix).toBe(url(voixAvant));
      expect(d.entrees["plage-0"]).toContain(`tutoriel-${nom}-plage0.mp4`);
      const p = d.parametres as { segments: { source: string }[]; voix?: string; avant: string; dureeSec: number };
      expect(p.segments.map((x) => x.source)).toEqual(["avant", "plage", "avant"]);
      expect(p.voix).toBe("voix");
      expect(p.avant).toBe("avant");
      expect(d.sortie.cle).toBe(`studio/test/videos/v-to/tutoriel-${nom}.mp4`);
      // Le recollage n'est soumis qu'après les plages.
      const i = (id: string) => r.j.rendus.findIndex((x) => x.idRendu === id);
      expect(i(`t-r-${nom}-recollage-0`)).toBeGreaterThan(i(`t-r-${nom}-plage0-0`));
      // Le fichier du format est celui du recollage, la voix n'a jamais été refaite.
      expect(r.etat.rendus.find((x) => x.ratio === ratio)!.sortie!.fichierCle).toBe(d.sortie.cle);
    }
    expect(r.j.voix).toHaveLength(0);
    expect(r.j.claude).toHaveLength(0);
  });

  it("5 scènes touchées sur 6 : rendu entier (aucune plage, aucun recollage)", async () => {
    const { etat: avant, c } = await premiere(true);
    const r = await retoucher(avant, c, true, [0, 1, 2, 3, 4]);
    expect(plagesDe(r.j)).toHaveLength(0);
    expect(recollages(r.j)).toHaveLength(0);
    expect(entieres(r.j)).toHaveLength(3);
    expect(entieres(r.j).every((d) => d.entrees.audio !== undefined)).toBe(true);
  });

  it("réglage éteint (absent ou false) : aucune demande plage ni recollage, 3 rendus entiers", async () => {
    for (const reglage of [undefined, false]) {
      const { etat: avant, c } = await premiere(reglage);
      const r = await retoucher(avant, c, reglage, [2]);
      expect(plagesDe(r.j)).toHaveLength(0);
      expect(recollages(r.j)).toHaveLength(0);
      expect(entieres(r.j).map((d) => d.idRendu).sort()).toEqual(["t-r-1x1-0", "t-r-4x5-0", "t-r-9x16-0"]);
    }
  });

  it("voix d'avant différente : le fichier d'avant ne peut plus servir, rendu entier", async () => {
    const { etat: avant, c } = await premiere(true);
    const r = await retoucher(avant, c, true, [2], { empreinteVoixAvant: "am-ancienne" });
    expect(plagesDe(r.j)).toHaveLength(0);
    expect(recollages(r.j)).toHaveLength(0);
    expect(entieres(r.j)).toHaveLength(3);
  });

  it("recollage refusé : retombée sur le rendu entier du format, réserve posée, fichier final rendu", async () => {
    const { etat: avant, c } = await premiere(true);
    const r = await retoucher(avant, c, true, [2], { refuserRecollage: true });
    expect(recollages(r.j)).toHaveLength(3);
    expect(entieres(r.j).map((d) => d.idRendu).sort()).toEqual(["t-r-1x1-0", "t-r-4x5-0", "t-r-9x16-0"]);
    expect(r.etat.reserves.filter((x) => x.includes("refait en entier"))).toHaveLength(3);
    expect(r.etat.rendus.every((x) => x.sortie?.fichierCle.endsWith(".mp4"))).toBe(true);
  });
});
