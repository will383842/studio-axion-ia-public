/**
 * TB-11 : moteur `montage-tableau` — parcours complet pas à pas, reprise après panne, retouche d'une page (seules ses
 * scènes refaites), refus lisibles (opération, ratio, réseau, sous-titres), découpage d'un script, fiche refusée.
 * Doubles seulement (aucun appel réel).
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "../../../src/domaine/types";
import type { ServiceRendu } from "../../../src/fournisseurs/types";
import type { MoteurVideo, ResultatFabrication } from "../../../src/moteurs/types";
import { obtenirMoteur } from "../../../src/moteurs";
import { trouverFormat } from "../../../src/formats";
import { ID_SCENE_FIN } from "../../../src/moteurs/montage-tableau/fabriquer";
import { OPERATION_NON_PRISE_EN_CHARGE, appliquerOperationsTableau, moteurMontageTableau } from "../../../src/moteurs/montage-tableau";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { copie, ficheDemonstration, ficheErreurCorrigee, texteScriptDe } from "../regles/exemples";
import { banc } from "./doubles";

const T0 = Date.UTC(2026, 9, 11, 9, 0, 0);
const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });

/** Avance jusqu'à « termine » ou « echec » ; le travail fait l'aller-retour JSON entre deux tours (comme en base). */
async function jusquAuBout(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail) {
  let t = depart;
  let resultat: ResultatFabrication | undefined;
  const tours: string[][] = [];
  for (let n = 0; n < 200; n++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    tours.push(t.etapes.filter((e) => e.statut === "terminee").map((e) => e.cle));
    if (t.statut === "termine" || t.statut === "echec") return { travail: t, resultat, tours };
  }
  throw new Error(`Bloqué (${t.statut}).`);
}

describe("inscription", () => {
  it("le registre rend ce moteur ; le format le désigne et est actif", () => {
    expect(obtenirMoteur("montage-tableau")).toBe(moteurMontageTableau);
    const format = trouverFormat("tableau-anime");
    expect(format?.moteur).toBe("montage-tableau");
    expect(format?.statut).toBe("actif");
  });

  it("étapes du § 4.2, libellés parlants ; une fiche fournie saute le découpage", () => {
    const b = banc(ficheDemonstration);
    const avecFiche = b.moteur.etapes(b.commande(ficheDemonstration));
    expect(avecFiche.map((e) => e.cle)).toEqual(["fiche", "voix", "calage", "pages", "scenes", "montage", "controle"]);
    expect(avecFiche.map((e) => e.nom)).toEqual(expect.arrayContaining(["La voix", "Les pages", "Les finitions"]));
    const depuisScript = b.moteur.etapes({ ...b.commande(ficheDemonstration), entrees: {} });
    expect(depuisScript[0]).toMatchObject({ cle: "decoupage", nom: "Le découpage", dependDe: [] });
    expect(depuisScript[1].dependDe).toEqual(["decoupage"]);
  });

  it("estimation sans prix : voix au caractère, découpage seulement depuis un script", async () => {
    const b = banc(ficheDemonstration);
    const c = b.commande(ficheDemonstration);
    const e = await b.moteur.estimer(c);
    expect(e.total.centimes).toBe(0);
    expect(e.lignes.find((l) => l.etape === "Voix")).toMatchObject({ unite: "caractere", quantite: texteScriptDe(ficheDemonstration).length });
    expect(e.lignes.map((l) => l.etape)).not.toContain("Découpage");
    expect((await b.moteur.estimer({ ...c, entrees: {} })).lignes.map((l) => l.etape)).toContain("Découpage");
  });

  it("refus au lancement : sans voix, ou sans fiche ni script", () => {
    const b = banc(ficheDemonstration);
    const c = b.commande(ficheDemonstration);
    expect(b.moteur.refusAuLancement?.(c)).toBeNull();
    expect(b.moteur.refusAuLancement?.({ ...c, distribution: [] })?.code).toBe("TABLEAU_SANS_VOIX");
    expect(b.moteur.refusAuLancement?.({ ...c, entrees: {}, script: { blocs: [], texteComplet: " " } })?.code).toBe("TABLEAU_SANS_FICHE");
  });
});

describe("parcours complet, pas à pas", () => {
  it("une étape par tour, voix lue une fois, chaque scène rendue, une composition, résultat 9:16", async () => {
    const b = banc(ficheDemonstration);
    const c = b.commande(ficheDemonstration);
    const t = await b.moteur.lancer(c, ctx("t-parcours"));
    expect(t.statut).toBe("en_file");
    const fin = await jusquAuBout(b.moteur, c, t);

    expect(fin.travail.statut).toBe("termine");
    expect(fin.travail.progression).toBe(100);
    // Pas à pas : jamais tout d'un coup ; les étapes se terminent dans l'ordre du graphe.
    expect(fin.tours.length).toBeGreaterThanOrEqual(6);
    expect(fin.tours[0]).toEqual(["fiche"]);
    expect(fin.tours.at(-1)).toEqual(["fiche", "voix", "calage", "pages", "scenes", "montage", "controle"]);
    expect(b.d.lectures()).toBe(1);
    expect(b.d.scenesSoumises()).toHaveLength(ficheDemonstration.scenes.length);
    expect(b.d.compositionsSoumises()).toHaveLength(1);

    const r = fin.resultat!;
    expect(r.sorties).toHaveLength(1);
    expect(r.sorties[0]).toMatchObject({ ratio: "9:16", resolution: "1080x1920" });
    expect(r.sorties[0].fichierCle).toBe(b.d.compositionsSoumises()[0].sortie.cle);
    // La voix lue pendant ce travail est comptée, au nom de son fournisseur.
    expect(r.lignesReelles.find((l) => l.etape === "Voix")?.total.centimes).toBeGreaterThan(0);
    expect((r.projetMontage.tableau as { journal: { etapes: Record<string, unknown> } }).journal.etapes).toHaveProperty("composition");
    expect(b.moteur.lignesPayees?.(fin.travail, c).map((l) => l.etape)).toEqual(["Voix"]);
  });

  it("sans outils reliés : échec lisible et réessayable, rien d'appelé", async () => {
    const b = banc(ficheDemonstration, null);
    const c = b.commande(ficheDemonstration);
    const fin = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-non-relie")));
    expect(fin.travail.statut).toBe("echec");
    expect(fin.travail.erreur).toMatchObject({ code: "TABLEAU_NON_RELIE", reessayable: true });
    expect(b.d.lectures()).toBe(0);
  });

  it("fiche refusée : échec à « La relecture de la fiche », non réessayable, aucune voix lue", async () => {
    const b = banc(ficheDemonstration);
    const mauvaise = copie(ficheDemonstration);
    mauvaise.scenes[0].elements[0] = { ...mauvaise.scenes[0].elements[0], texte: Array.from({ length: 45 }, (_, i) => `mot${i}`).join(" ") } as FicheTableau["scenes"][number]["elements"][number];
    const c = b.commande(mauvaise);
    const fin = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-refus")));
    expect(fin.travail.statut).toBe("echec");
    expect(fin.travail.etapes.find((e) => e.statut === "echec")?.cle).toBe("fiche");
    expect(fin.travail.erreur?.reessayable).toBe(false);
    expect(fin.travail.erreur?.messagePourWill).toMatch(/fiche de scènes/);
    expect(b.d.lectures()).toBe(0);
  });
});

describe("reprise après panne", () => {
  it("panne du rendu à la composition : « Réessayer » ne refait que les finitions (voix et scènes gardées)", async () => {
    const b = banc(ficheDemonstration);
    const c = b.commande(ficheDemonstration);
    b.d.pannes.renduOperation = "composition-complet";
    const enPanne = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-panne")));
    expect(enPanne.travail.statut).toBe("echec");
    expect(enPanne.travail.etapes.find((e) => e.statut === "echec")?.cle).toBe("montage");
    expect(enPanne.travail.erreur?.reessayable).toBe(true);
    expect(enPanne.travail.etapes.filter((e) => e.statut === "terminee").map((e) => e.cle)).toEqual(["fiche", "voix", "calage", "pages", "scenes"]);

    const repris = await b.moteur.reessayer(enPanne.travail, T0);
    expect(repris.tentatives).toBe(enPanne.travail.tentatives + 1);
    const fin = await jusquAuBout(b.moteur, c, repris);
    expect(fin.travail.statut).toBe("termine");
    expect(b.d.lectures()).toBe(1);
    expect(b.d.scenesSoumises()).toHaveLength(ficheDemonstration.scenes.length);
    expect(b.d.compositionsSoumises()).toHaveLength(1);
  });

  it("un rendu qui fait attendre : le moteur rend la main au lieu d'attendre, puis reprend au même endroit", async () => {
    const b = banc(ficheDemonstration);
    const vus = new Set<string>();
    const attentes = { n: 0 };
    const lent = (): ServiceRendu => {
      const vrai = b.d.outils.scenes.rendu();
      return {
        soumettre: (d) => vrai.soumettre(d),
        etat: async (id) => {
          if (!vus.has(id)) {
            vus.add(id);
            attentes.n++;
            return { statut: "en_cours", progression: 50 };
          }
          return vrai.etat(id);
        },
      };
    };
    const lentB = banc(ficheDemonstration, { scenes: { ...b.d.outils.scenes, rendu: lent } });
    const c = lentB.commande(ficheDemonstration);
    const fin = await jusquAuBout(lentB.moteur, c, await lentB.moteur.lancer(c, ctx("t-lent")));
    expect(fin.travail.statut).toBe("termine");
    expect(attentes.n).toBe(ficheDemonstration.scenes.length);
    // L'attente a rendu la main (au moins un tour de plus sur « Le dessin des scènes »), rien n'a été rendu deux fois.
    expect(fin.tours.filter((t) => t.at(-1) === "pages").length).toBeGreaterThanOrEqual(2);
    expect(b.d.scenesSoumises()).toHaveLength(ficheDemonstration.scenes.length);
  });

  it("panne du budget avant la voix : rien n'est payé, « Réessayer » repart de la voix", async () => {
    const b = banc(ficheDemonstration);
    const c = b.commande(ficheDemonstration);
    b.d.pannes.budget = true;
    const enPanne = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-budget")));
    expect(enPanne.travail.etapes.find((e) => e.statut === "echec")?.cle).toBe("voix");
    expect(enPanne.travail.erreur?.messagePourWill).toMatch(/budget/);
    expect(b.d.lectures()).toBe(0);
    b.d.pannes.budget = false;
    const fin = await jusquAuBout(b.moteur, c, await b.moteur.reessayer(enPanne.travail, T0));
    expect(fin.travail.statut).toBe("termine");
    expect(b.d.lectures()).toBe(1);
  });
});

describe("retouche", () => {
  async function fabriquee() {
    const b = banc(ficheDemonstration);
    const c = b.commande(ficheDemonstration);
    const fin = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-v1")));
    expect(fin.travail.statut).toBe("termine");
    const parent = { versionId: "ver-t-v1", projetMontage: fin.resultat!.projetMontage, pistes: [] };
    return { b, c, parent, scenesAvant: b.d.scenesSoumises().length };
  }

  it("fiche modifiée sur une page : seules les scènes qui montrent cette page sont refaites, la voix est reprise", async () => {
    const { b, parent, scenesAvant } = await fabriquee();
    const modifiee = copie(ficheDemonstration);
    // Page 2, scène s03 : le texte ÉCRIT change (le texte dit, donc la voix, reste le même).
    const ligne = modifiee.scenes[2].elements[0] as { texte: string };
    ligne.texte = "Demandez trois bonnes idées";
    const c2 = b.commande(modifiee);
    const t = await b.moteur.retoucher({ commande: c2, contexte: ctx("t-retouche"), planIds: [], consigne: "", parent });
    expect(t.type).toBe("retouche");
    const fin = await jusquAuBout(b.moteur, c2, t);
    expect(fin.travail.statut).toBe("termine");

    expect(b.d.lectures()).toBe(1);
    const refaites = b.d.scenesSoumises().slice(scenesAvant).map((d) => (d.parametres as { proprietes: { scene: { id: string } } }).proprietes.scene.id);
    // Les scènes qui MONTRENT la page 2 : les siennes (s03, s04 la redessine avec ce qui est déjà écrit) et la première
    // de la page suivante (s05 tourne la page 2). Aucune autre, ni la fin.
    const montrentPage2 = ficheDemonstration.scenes.filter((s, i, t) => s.page === 2 || (i > 0 && t[i - 1].page === 2 && s.page !== 2)).map((s) => s.id);
    expect(montrentPage2).toEqual(["s03", "s04", "s05"]);
    expect([...refaites].sort()).toEqual(montrentPage2);
    expect(refaites).not.toContain(ID_SCENE_FIN);
    expect(b.d.compositionsSoumises()).toHaveLength(2);
    // La voix reprise d'une version d'avant ne se paie pas deux fois.
    expect(fin.resultat!.lignesReelles.map((l) => l.etape)).not.toContain("Voix");
  });

  it("opération par bouton inconnue : refus lisible « non pris en charge », rien n'est refait", async () => {
    const { b, c, parent, scenesAvant } = await fabriquee();
    const t = await b.moteur.retoucher({ commande: c, contexte: ctx("t-op"), planIds: [], consigne: "", parent, operations: [{ type: "modifierTitre", texte: "Autre" }] });
    expect(t.type).toBe("retouche");
    expect(t.statut).toBe("echec");
    expect(t.erreur).toMatchObject({ code: OPERATION_NON_PRISE_EN_CHARGE, reessayable: false });
    expect(t.erreur?.messagePourWill).toMatch(/pas encore prise en charge/);
    expect((await b.moteur.avancer(t, c, T0)).travail.statut).toBe("echec");
    expect(b.d.scenesSoumises()).toHaveLength(scenesAvant);
    expect(appliquerOperationsTableau(ficheDemonstration, [])).toEqual({ ok: true, fiche: ficheDemonstration });
  });

  it("réexport 9:16 : tout est repris (ni voix, ni scène, ni composition refaites) ; autres ratios, réseaux et sous-titres seuls : refus lisibles", async () => {
    const { b, c, parent, scenesAvant } = await fabriquee();
    const x = await b.moteur.reexporter({ commande: c, contexte: ctx("t-x"), cible: { ratio: "9:16" }, parent });
    expect(x.type).toBe("reexport");
    const fin = await jusquAuBout(b.moteur, c, x);
    expect(fin.travail.statut).toBe("termine");
    expect(b.d.lectures()).toBe(1);
    expect(b.d.scenesSoumises()).toHaveLength(scenesAvant);
    expect(b.d.compositionsSoumises()).toHaveLength(1);

    for (const cible of [{ ratio: "1:1" as const }, { reseau: "tiktok" as const }]) {
      const refus = await b.moteur.reexporter({ commande: c, contexte: ctx("t-refus"), cible, parent });
      expect(refus).toMatchObject({ type: "reexport", statut: "echec", erreur: { code: "REEXPORT_NON_PRIS_EN_CHARGE", reessayable: false } });
    }
    const recalque = await b.moteur.recalquer!({ commande: c, contexte: ctx("t-st"), sousTitresId: "st", segments: [], parent });
    expect(recalque).toMatchObject({ type: "recalque-sous-titres", statut: "echec", erreur: { code: "RECALQUE_NON_PRIS_EN_CHARGE" } });
  });
});

describe("découpage (vidéo partie d'un script)", () => {
  const fiche = ficheErreurCorrigee;
  const entreeDecoupage = {
    structure: fiche.structure,
    serie: fiche.serie,
    douleur: fiche.douleur,
    gesteMinute: fiche.gesteMinute,
    preuves: [{ id: "matiere-demo-questions", resume: "Même demande, avec et sans les trois questions." }],
    dessins: [
      { id: "point-interrogation", motsCles: ["question", "doute"] },
      { id: "bulle", motsCles: ["parole", "réponse"] },
    ],
    habillage: fiche.habillage,
    stylo: fiche.stylo,
    ratio: fiche.ratio,
  };

  function commandeScript(b: ReturnType<typeof banc>): CommandeFabrication {
    return { ...b.commande(fiche), entrees: {}, script: { blocs: [], texteComplet: texteScriptDe(fiche) } };
  }

  it("un appel Claude (double), puis la chaîne ; la fiche découpée est gardée pour les retouches", async () => {
    let appels = 0;
    const b = banc(fiche, {
      decoupage: {
        entree: entreeDecoupage,
        outils: {
          appeler: async () => {
            appels++;
            // Claude recopie les champs fixes reçus (dont la version de la vidéo).
            return { ok: true, simule: false, donnees: JSON.stringify({ ...fiche, versionId: "ver-t-script" }) };
          },
          budget: { reserver: async () => ({ ok: true }) },
        },
      },
    });
    const c = commandeScript(b);
    const fin = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-script")));
    expect(fin.travail.statut).toBe("termine");
    expect(fin.tours[0]).toEqual(["decoupage"]);
    expect(appels).toBe(1);
    expect((fin.resultat!.projetMontage.tableau as { fiche?: FicheTableau }).fiche?.scenes).toHaveLength(fiche.scenes.length);

    // Retouche sans nouvelle fiche : pas de second découpage.
    const t = await b.moteur.retoucher({ commande: c, contexte: ctx("t-script-r"), planIds: [], consigne: "", parent: { versionId: "v", projetMontage: fin.resultat!.projetMontage, pistes: [] } });
    expect(t.etapes.map((e) => e.cle)).not.toContain("decoupage");
    expect((await jusquAuBout(b.moteur, c, t)).travail.statut).toBe("termine");
    expect(appels).toBe(1);
  });

  it("découpage non relié : refus lisible, non réessayable", async () => {
    const b = banc(fiche);
    const c = commandeScript(b);
    const fin = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-sans-decoupage")));
    expect(fin.travail.statut).toBe("echec");
    expect(fin.travail.erreur).toMatchObject({ code: "TABLEAU_DECOUPAGE_NON_RELIE", reessayable: false });
  });
});
