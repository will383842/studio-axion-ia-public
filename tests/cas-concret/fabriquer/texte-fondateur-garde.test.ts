/**
 * GV2-30 · cas concret : le texte affiché reste celui du fondateur, la voix est gardée fidèle au script fourni, et ce qui
 * n'a pas été contrôlé est dit. Chaîne branchée sur les doubles (aucun appel réel, rien de payé).
 */
import { describe, expect, it } from "vitest";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { fournisseurVoixSimulation } from "@/fournisseurs/simulation/autres";
import { ErreurFabricationCasConcret, fabriquerCasConcret, type CompteRenduCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { cleMot, motsLus } from "@/moteurs/montage-cas-concret/fiche";
import { estimerRetoucheCasConcret } from "@/moteurs/montage-cas-concret";
import { SCRIPT_V4_RECRUTEMENT } from "@/moteurs/montage-cas-concret/scripts-valides/recrutement-apporteurs";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { MoteurVideo, OperationMontage, ParentRetouche, ResultatFabrication } from "@/moteurs/types";
import { banc } from "../moteur/doubles";
import { doubles } from "./doubles";

const PRONONCIATION = { mot: "candidatures", prononciation: "candida tures" };
const reserves = (r: CompteRenduCasConcret) => r.reservesVoix ?? [];
const ecrans = (r: CompteRenduCasConcret) => r.fiche.ecrans.map((e) => e.texteDit).join(" ");

describe("GV2-30 · relecture à l'identique : le texte écrit reste celui du fondateur", () => {
  it("une phrase relue à l'identique avec une prononciation : la fiche calée et les sous-titres gardent le mot écrit", async () => {
    const d = doubles({ lecturesFautives: [1] });
    d.options.scriptValide = SCRIPT_V4_RECRUTEMENT;
    d.options.prononciations = [PRONONCIATION];
    const r = await fabriquerCasConcret(d.options);
    // La voix a bien relu (la première lecture est rejetée « mots » : relue telle quelle, jamais réécrite).
    expect(d.lus.filter((t) => t === d.lus[0]).length).toBeGreaterThanOrEqual(2);
    expect(d.lus.some((t) => t.includes("candida tures"))).toBe(true);
    expect(ecrans(r)).toContain("candidatures");
    expect(ecrans(r)).not.toContain("candida tures");
    const affiches = (r.sousTitres ?? []).flatMap((s) => s.mots.map((m) => m.mot)).join(" ");
    expect(affiches.toLowerCase()).not.toContain("candida tures");
  });
});

describe("GV2-30 · sous-titres : la ponctuation de fin d'écran est celle de la voix", () => {
  it("chaque fin de phrase d'écran porte son point dans les sous-titres ; une phrase coupée entre deux écrans n'en reçoit aucun", async () => {
    const d = doubles();
    // Écran 2 sans son point final (« … Oui, quinze minutes ») suivi d'un écran en majuscule (« Avant, … ») : une fin de phrase.
    d.options.scriptValide = { ...SCRIPT_V4_RECRUTEMENT, ecrans: SCRIPT_V4_RECRUTEMENT.ecrans.map((e, i) => (i === 1 ? { ...e, texteDit: e.texteDit.trim().replace(/\.$/u, "") } : e)) };
    const r = await fabriquerCasConcret(d.options);
    expect(r.fiche.ecrans[1].texteDit.trim().endsWith("minutes")).toBe(true);
    const fin = r.plan.fins[0];
    const ecransDuTexte = [...r.fiche.ecrans, ...fin.ecrans];
    const mots = (r.sousTitres ?? []).flatMap((s) => s.mots.map((m) => m.mot)).filter((m) => cleMot(m));
    let rang = 0;
    const sansPoint: string[] = [];
    const pointInvente: string[] = [];
    ecransDuTexte.forEach((e, i) => {
      rang += motsLus(e.texteDit).length;
      const dernier = mots[rang - 1];
      const suivant = ecransDuTexte[i + 1]?.texteDit.trim();
      const coupee = !!suivant && /^\p{Ll}/u.test(suivant);
      const ponctue = /[.?!…]["»”)\]]*$/u.test(dernier);
      if (!coupee && !ponctue) sansPoint.push(`${e.id} : « ${dernier} »`);
      if (coupee && ponctue && !/[.?!…]["»”)\]]*$/u.test(e.texteDit.trim())) pointInvente.push(`${e.id} : « ${dernier} »`);
    });
    expect(sansPoint).toEqual([]);
    expect(pointInvente).toEqual([]);
  });
});

describe("GV2-30 · style Karaoké : la base du style est celle de la commande de rendu", () => {
  it("un style Karaoké donne la base Karaoké au rendu des sous-titres", async () => {
    const d = doubles();
    d.options.styleSousTitres = { id: "st-karaoke", nom: "Karaoké", valeur: STYLE_SOUS_TITRES_AVOCAT };
    await fabriquerCasConcret(d.options);
    const bases = d.compositionsSoumises().map((c) => (c.parametres as { texte: { sousTitres: { base: string } } }).texte.sousTitres.base);
    expect(bases.length).toBeGreaterThan(0);
    for (const b of bases) expect(b).toBe("karaoke");
  });

  it("sans style choisi la base reste « minimal »", async () => {
    const d = doubles();
    await fabriquerCasConcret(d.options);
    const bases = d.compositionsSoumises().map((c) => (c.parametres as { texte: { sousTitres: { base: string } } }).texte.sousTitres.base);
    for (const b of bases) expect(b).toBe("minimal");
  });
});

describe("GV2-30 · voix sans heures de mots : le son est gardé entier", () => {
  it("mots approximatifs : aucun resserrage, la réserve est dite", async () => {
    const d = doubles();
    // Une voix qui ne rend aucune heure de mot : les mots sont estimés (aligneur simulé).
    d.options.outils.voix.voix = () => ({
      ...fournisseurVoixSimulation,
      async lire(demande) {
        return { ...(await fournisseurVoixSimulation.lire(demande)), mots: [] };
      },
    });
    const r = await fabriquerCasConcret(d.options);
    expect(reserves(r)).toContain("Voix sans heures des mots : sous-titres approximatifs, son gardé entier.");
    const finals = d.assemblages.filter((a) => a.recette);
    expect(finals.length).toBeGreaterThan(0);
    for (const a of finals) {
      // Le corps puis la fin, chacun entier, du début à la fin du son.
      expect(a.morceaux).toHaveLength(2);
      expect(a.morceaux.every((m) => m.deSec === 0 && m.aSec > 0)).toBe(true);
    }
  });

  it("chemin normal : aucune réserve de ce genre, les morceaux sont resserrés comme avant", async () => {
    const d = doubles();
    const r = await fabriquerCasConcret(d.options);
    expect(reserves(r).filter((x) => x.includes("sans heures"))).toEqual([]);
  });
});

describe("GV2-30 · script fourni : mots envoyés = mots fournis", () => {
  const lignes = SCRIPT_V4_RECRUTEMENT.ecrans.map((e) => e.texteDit.trim());
  const fourni = (texte: string) => ({ ...SCRIPT_V4_RECRUTEMENT, fourni: true as const, texteFourni: texte });

  it("la fiche diffère d'un mot du script fourni : arrêt AVANT toute voix, le mot est nommé", async () => {
    const d = doubles();
    const change = lignes.map((l, i) => (i === 1 ? l.replace("Oui,", "Non,") : l));
    d.options.scriptValide = fourni(change.join("\n"));
    const erreur = await fabriquerCasConcret(d.options).catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(ErreurFabricationCasConcret);
    const e = erreur as ErreurFabricationCasConcret;
    expect(e.etape).toBe("fiche");
    expect(e.raisons[0]).toBe("Ligne 2 : votre script dit « Non, », la fiche dit « Oui, ». Vérifiez le script.");
    expect(d.lus).toEqual([]);
    expect(d.reservationsVoix).toEqual([]);
  });

  it("script fourni identique à la fiche : pas d'arrêt", async () => {
    const d = doubles();
    d.options.scriptValide = fourni(lignes.join("\n"));
    const r = await fabriquerCasConcret(d.options);
    expect(r.fins.length).toBeGreaterThan(0);
  });
});

describe("GV2-30 · retouche d'un script du fondateur : la voix ne réécrit jamais", () => {
  const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);
  const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });
  async function jusquaLaFin(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail) {
    let t = depart;
    let resultat: ResultatFabrication | undefined;
    for (let n = 0; n < 200; n++) {
      const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000);
      t = r.travail;
      resultat = r.resultat ?? resultat;
      if (t.statut === "termine" || t.statut === "echec") return { travail: t, resultat };
    }
    throw new Error(`Bloqué (${t.statut}).`);
  }

  it("une voix qui dit un mot différent : la reformulation n'est jamais appelée", async () => {
    const fautives: number[] = [];
    const b = banc({ retouches: true, scriptValide: "catalogue", lecturesFautives: fautives });
    const c = b.commande();
    const fin = await jusquaLaFin(b.moteur, c, await b.moteur.lancer(c, ctx("t-1")));
    expect(fin.travail.statut).toBe("termine");
    const parent: ParentRetouche = { versionId: "ver-t-1", projetMontage: JSON.parse(JSON.stringify(fin.resultat!.projetMontage)), pistes: [] };
    // La première lecture de la retouche avale un mot : la prise est rejetée « mots ».
    fautives.push(b.d.lus.length + 1);
    const roles = b.d.roles.length;
    const operation = [{ type: "changer-phrase", ecranId: "e05", avant: "notre annonce", apres: "notre petite annonce" }] as unknown as OperationMontage[];
    expect(estimerRetoucheCasConcret(c, operation, parent).refus).toBeNull();
    const t = await b.moteur.retoucher({ commande: c, contexte: ctx("t-2"), planIds: [], consigne: "Changer une phrase", operations: operation, parent });
    const apres = await jusquaLaFin(b.moteur, c, t);
    expect(apres.travail.statut).toBe("termine");
    // Le texte du fondateur n'est jamais réécrit : ni appel d'écriture, ni appel de reformulation.
    expect(b.d.roles.slice(roles)).toEqual([]);
  });
});

describe("GV2-30 · contrôle de fin de voix : ce qui n'est pas contrôlé est dit", () => {
  it("un son illisible (`lireSon` rend null) : la réserve est posée", async () => {
    const d = doubles();
    d.options.outils.voix.lireSon = async () => null;
    const r = await fabriquerCasConcret(d.options);
    expect(reserves(r)).toContain("Fin de voix non contrôlée (son illisible).");
  });

  it("sans `lireSon` (simulation, doubles de test) : rien à dire", async () => {
    const d = doubles();
    const r = await fabriquerCasConcret(d.options);
    expect(reserves(r).filter((x) => x.includes("non contrôlée"))).toEqual([]);
  });
});
