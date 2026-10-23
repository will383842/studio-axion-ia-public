/**
 * CHAÎNE « ÉQUIPE » (livrée éteinte) : rédacteur en chef, scénariste, accroches, relecteur unique, puis déclinaisons.
 * SIMULATION seulement : aucun appel, aucune clé, 0 $.
 *  - déroulé complet, dans l'ordre, et préparation par le code (objectif, cible, appel de la banque, extraits de Will) ;
 *  - test « influenceur IA » : un nouvel angle, une fois ;
 *  - filtre des accroches par le code, la mieux notée gardée ;
 *  - relecteur : priorité fixe, 5 corrections au plus, jamais la perte d'une citation d'ancrage ;
 *  - règles de Will dans les consignes du chef et du relecteur ;
 *  - pire cas sous le plafond d'un sujet ; socle canonique en cache intact, aucun format de sortie, effort moyen.
 */
import { describe, expect, it } from "vitest";
import { corpsRequete } from "@/fournisseurs/claude/client";
import { MODELE_ECRITURE, MODELE_JUGE } from "@/fournisseurs/claude/tarifs";
import { roleCourtAngle } from "@/generateur/chaine-courte";
import { executerChaineEquipe, pireCasChaineEquipe, preparerEquipe, ROLES_CHAINE_EQUIPE, texteDitEquipe, type EtatChaineEquipe } from "@/generateur/chaine-equipe";
import { pireCasChaine } from "@/generateur/pire-cas";
import { estimationRealisteRole } from "@/generateur/roles/estimation";
import { CONSIGNE_EQUIPE_ACCROCHES, filtrerAccroches, type AccrocheEquipe } from "@/generateur/roles/equipe-accroches";
import { appelEquipe, cibleEquipe, extraitsWillTournants, motifsAccrocheRefusee, objectifEquipe, REGLES_WILL, violationsReglesWill } from "@/generateur/roles/equipe-commun";
import { AXES_RELECTURE, CONSIGNE_EQUIPE_RELECTEUR, trierCorrections, type CorrectionEquipe } from "@/generateur/roles/equipe-relecteur";
import { CONSIGNE_EQUIPE_CHEF } from "@/generateur/roles/equipe-chef";
import { CONSIGNE_EQUIPE_SCENARISTE, EVALUATIONS_EQUIPE_SCENARISTE, reperesManques } from "@/generateur/roles/equipe-scenariste";
import { MOTS_PAR_PHRASE_MAX, REGLE_EMPHASE, REGLE_PHRASES_COURTES } from "@/generateur/roles/prose";
import { construireRequete, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import { versionsRoles } from "@/generateur/roles";
import { blocsEnCache } from "@/generateur/contexte";
import { Attente, type ExecuteurRoles } from "@/generateur/chaine";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import { CONTEXTE_BANC, SUJETS_BANC } from "./banc/registre-banc-g4";
import { etapeZeroBanc, executeurSimule, TOURNURES_G4 } from "../helpers/g4";

const contexteWill = { interdits: CONTEXTE_BANC.interdits, promessesInterdites: CONTEXTE_BANC.promessesInterdites, rolesDestinataires: CONTEXTE_BANC.rolesDestinataires, termesVagues: CONTEXTE_BANC.termesVagues };
const options = { tournures: TOURNURES_G4, contexteWill };

function donnees(i = 0) {
  const z = etapeZeroBanc(SUJETS_BANC[i]);
  if (!z.ok) throw new Error(z.manque.ceQuIlFaudrait);
  return z.donnees;
}

describe("déroulé complet en simulation", () => {
  it("chef → scénariste → accroches → relecteur, une version notée et contrôlée", async () => {
    const d = donnees();
    const { executeur, appels } = executeurSimule();
    const r = await executerChaineEquipe(d, executeur, options);
    expect(r.statut).toBe("terminee");
    if (r.statut !== "terminee") return;
    expect(appels.map((a) => a.role)).toEqual(["equipe-chef", "equipe-scenariste", "equipe-accroches", "equipe-relecteur"]);
    expect(r.etat.etape).toBe(5);
    expect(r.version.violations.length).toBeGreaterThanOrEqual(0);
    expect(r.version.note.globale).toBeGreaterThan(0);
    expect(r.etat.finalistes?.length).toBeGreaterThan(0);
    expect(r.version.declinaison.accroche).toBe(r.etat.finalistes![0].dit);
    expect(texteDitEquipe(r.etat, r.version)).toContain(r.version.declinaison.accroche);
    // Préparation par le code, gardée dans l'état.
    const p = r.etat.equipe!.preparation!;
    expect(p.structure).toBe(d.choix.structure);
    expect(p.extraits).toHaveLength(3);
    // L'appel final est celui de la banque, choisi par le code.
    const a = p.appels[r.version.reseau];
    if (a) expect(r.version.appel.texte).toBe(a.texte);
  });

  it("chaque rôle reçoit ce qu'il lui faut : structure, objectif, cible, extraits de Will, décision du chef, corps, matières", async () => {
    const d = donnees();
    const { executeur, appels } = executeurSimule();
    await executerChaineEquipe(d, executeur, options);
    const v = (role: string) => appels.find((a) => a.role === role)!.entree.variable;
    for (const role of ["equipe-chef", "equipe-scenariste", "equipe-accroches"]) {
      expect(v(role), role).toContain(`<structure_imposee>${d.choix.structure}</structure_imposee>`);
      expect(v(role), role).toMatch(/<objectif_video>(notoriete|conversation|diagnostic)<\/objectif_video>/);
      expect(v(role), role).toMatch(/<cible taille="(TPE|PME|ETI|GE)">/);
      expect(v(role), role).toContain("<modeles_will_du_sujet>");
    }
    expect(v("equipe-scenariste")).toContain("<decision_chef>");
    expect(v("equipe-accroches")).toContain("<corps>");
    expect(v("equipe-accroches")).toContain("<familles>");
    const rel = v("equipe-relecteur");
    expect(rel).toContain("<grille>");
    expect(rel).toContain("<alertes_code>");
    for (const id of d.choix.ancrages.map((a) => a.matiereId)) expect(rel).toContain(`id="${id}"`);
  });

  it("production : une version par réseau, les autres par la déclinaison (Sonnet), l'appel remis à celui de la banque", async () => {
    const d = donnees();
    const reseaux = d.sujet.reseaux;
    expect(reseaux.length).toBeGreaterThan(1);
    const { executeur, appels } = executeurSimule();
    const r = await executerChaineEquipe(d, executeur, { ...options, reseaux });
    expect(r.statut).toBe("terminee");
    if (r.statut !== "terminee") return;
    expect(appels.filter((a) => a.role === "declinaison")).toHaveLength(reseaux.length - 1);
    expect(r.etat.versions!.map((x) => x.reseau)).toEqual(reseaux);
    for (const x of r.etat.versions!) {
      const a = r.etat.equipe!.preparation!.appels[x.reseau];
      if (a) expect(x.appel.texte, x.reseau).toBe(a.texte);
    }
  });

  it("reprise : un état sauvé après le script repart aux accroches, sans repayer le chef ni le scénariste", async () => {
    const d = donnees();
    const sauves: EtatChaineEquipe[] = [];
    await executerChaineEquipe(d, executeurSimule().executeur, options, undefined, async (e) => void sauves.push(structuredClone(e)));
    const apresScript = sauves.find((e) => e.etape === 2)!;
    const { executeur, appels } = executeurSimule();
    const r = await executerChaineEquipe(d, executeur, options, apresScript);
    expect(r.statut).toBe("terminee");
    expect(appels.map((a) => a.role)).toEqual(["equipe-accroches", "equipe-relecteur"]);
  });
});

describe("rédacteur en chef : test « un influenceur IA pourrait-il dire cela ? »", () => {
  const chef = (reponse: "oui" | "non") => (entree: EntreeRole) => ({ ...(ROLES_CHAINE_EQUIPE.chef.simuler(entree) as object), testInfluenceur: { reponse, raison: "test" } });

  it("oui : un nouvel angle est demandé UNE fois, avec l'angle refusé", async () => {
    const { executeur, appels } = executeurSimule({ "equipe-chef": chef("oui") });
    const r = await executerChaineEquipe(donnees(), executeur, options);
    expect(r.statut).toBe("terminee");
    const chefs = appels.filter((a) => a.role === "equipe-chef");
    expect(chefs).toHaveLength(2);
    expect(chefs[0].entree.variable).not.toContain("<angle_refuse>");
    expect(chefs[1].entree.variable).toContain("<angle_refuse>");
    expect(r.etat.equipe?.angleRefuse).toBeDefined();
  });

  it("reprise après un 2e appel arrêté (plafond) : le 1er, déjà payé, n'est jamais repayé ; on repart avec l'angle refusé", async () => {
    const d = donnees();
    let n = 0;
    const sauves: EtatChaineEquipe[] = [];
    const { executeur } = executeurSimule({
      "equipe-chef": (entree) => {
        if (++n === 2) throw new Attente("plafond-atteint", "plafond");
        return chef("oui")(entree);
      },
    });
    const r1 = await executerChaineEquipe(d, executeur, options, undefined, async (e) => void sauves.push(structuredClone(e)));
    expect(r1.statut).toBe("attente");
    const etat = sauves.at(-1)!;
    expect(etat.equipe?.angleRefuse).toBeDefined();
    const { executeur: e2, appels } = executeurSimule({ "equipe-chef": chef("non") });
    const r2 = await executerChaineEquipe(d, e2, options, etat);
    expect(r2.statut).toBe("terminee");
    const chefs = appels.filter((a) => a.role === "equipe-chef");
    expect(chefs).toHaveLength(1);
    expect(chefs[0].entree.variable).toContain("<angle_refuse>");
  });

  it("non : un seul appel", async () => {
    const { executeur, appels } = executeurSimule({ "equipe-chef": chef("non") });
    await executerChaineEquipe(donnees(), executeur, options);
    expect(appels.filter((a) => a.role === "equipe-chef")).toHaveLength(1);
  });
});

describe("préparation par le code (étape 0, gratuite)", () => {
  it("objectif déduit du brief, conversation par défaut", () => {
    expect(objectifEquipe({ objectif: "conversation", idee: "Les relances" })).toBe("conversation");
    expect(objectifEquipe({ objectif: "rendez-vous", idee: "Les relances" })).toBe("diagnostic");
    expect(objectifEquipe({ objectif: "conversation", idee: "Faire un diagnostic de ses process" })).toBe("diagnostic");
    expect(objectifEquipe({ objectif: "notoriete", idee: "Les relances" })).toBe("notoriete");
  });

  it("cible = taille (PME par défaut) + fonction si fournie", () => {
    expect(cibleEquipe(undefined)).toMatchObject({ taille: "PME" });
    expect(cibleEquipe("DRH d'ETI")).toMatchObject({ taille: "ETI", fonction: "DRH" });
    expect(cibleEquipe("artisans du bâtiment").taille).toBe("TPE");
    expect(cibleEquipe("grands groupes").taille).toBe("GE");
    expect(cibleEquipe("dirigeant de PME")).toMatchObject({ taille: "PME", fonction: "dirigeant" });
  });

  it("appel pris dans la banque des fins selon le réseau et l'objectif, jamais avec un mot ou un cadeau à remplir", () => {
    const q = appelEquipe("tiktok", "conversation", 0)!;
    expect(q.objectif).toBe("QUESTION");
    expect(q.type).toBe("question-expert");
    expect(appelEquipe("instagram", "diagnostic", 0)?.objectif).toBe("RENDEZ_VOUS");
    expect(appelEquipe("facebook", "notoriete", 0)?.objectif).toBe("PARTAGER");
    for (const r of ["instagram", "facebook", "tiktok", "youtube-shorts", "linkedin"] as const) for (const o of ["notoriete", "conversation", "diagnostic"] as const) expect(appelEquipe(r, o, 3)?.texte ?? "").not.toMatch(/\{/);
    // LinkedIn : la légende de la banque sert de phrase (rien n'est dit sinon).
    expect(appelEquipe("linkedin", "conversation", 0)?.texte).toBeTruthy();
  });

  it("rotation de 3 extraits de Will, espacés, qui changent d'un sujet à l'autre", () => {
    const a = extraitsWillTournants(0).map((x) => x.code);
    const b = extraitsWillTournants(1).map((x) => x.code);
    expect(a).toHaveLength(3);
    expect(new Set(a).size).toBe(3);
    expect(a).not.toEqual(b);
    const d = donnees();
    expect(preparerEquipe(d, d.sujet.reseaux)).toEqual(preparerEquipe(d, d.sujet.reseaux));
  });
});

describe("accroches : filtre par le code", () => {
  const cible = { taille: "PME" as const };
  const debit = 2.5;
  const acc = (dit: string, note: number, famille = `f-${note}`): AccrocheEquipe => ({ famille, dit, ecrit: "", note, raison: "", preuveIds: [], matiereIds: [] });

  it("élimine : 1re phrase trop longue ou trop lente, ni chiffre ni « pour qui », pré-roll ou salut", () => {
    expect(motifsAccrocheRefusee("Les dirigeants de PME qui relancent encore leurs devis à la main chaque vendredi soir perdent tout.", { debit, cible })[0]).toMatch(/12 au plus/);
    expect(motifsAccrocheRefusee("Dirigeants de PME : vos devis dorment dans un tiroir depuis lundi.", { debit, cible }).join()).toMatch(/avant 3 s/);
    expect(motifsAccrocheRefusee("Vos devis dorment. Voici pourquoi.", { debit, cible }).join()).toMatch(/ni chiffre ni « pour qui »/);
    expect(motifsAccrocheRefusee("Bonjour ! Dirigeant de PME ?", { debit, cible }).join()).toMatch(/pré-roll ou salut/);
    expect(motifsAccrocheRefusee("Aujourd'hui on va parler des PME.", { debit, cible }).join()).toMatch(/pré-roll ou salut/);
    expect(motifsAccrocheRefusee("Dirigeant de PME ? Vos devis dorment.", { debit, cible })).toEqual([]);
    expect(motifsAccrocheRefusee("3 heures perdues. Chaque semaine.", { debit, cible })).toEqual([]);
  });

  it("garde la mieux notée parmi celles qui passent ; une famille déjà prise est éliminée", () => {
    const f = filtrerAccroches([acc("Bonjour ! Dirigeant de PME ?", 10), acc("Dirigeant de PME ? Vos devis dorment.", 6), acc("Patron de PME ? Voici ce qu'on retire.", 8), acc("En PME, tout part de là.", 9, "f-8")], { debit, cible });
    expect(f.retenue?.note).toBe(8);
    expect(f.gardees.map((a) => a.note)).toEqual([8, 6]);
    expect(f.eliminees.map((e) => e.motifs.join())).toEqual([expect.stringMatching(/salut/), expect.stringMatching(/déjà prise/)]);
  });

  it("élimine aussi les accroches contraires aux règles de Will et les familles hors liste", () => {
    const f = filtrerAccroches(
      [
        acc("Dirigeant de PME ? Cet outil vient de sortir.", 10),
        acc("PME : ce nouvel outil change tout.", 9),
        acc("OpenAI vient d'annoncer ça aux PME.", 8),
        acc("PME : ce n'est pas un outil, c'est une méthode.", 7),
        acc("Dirigeant de PME à Villeexemple ? Écoutez.", 6),
        acc("Dirigeant de PME ? Une méthode incroyable.", 5),
        acc("Dirigeant de PME ? Vos devis dorment.", 4, "hors-liste"),
        acc("Patron de PME ? Voici ce qu'on retire.", 3),
      ],
      { debit, cible, famillesPermises: ["f-10", "f-9", "f-8", "f-7", "f-6", "f-5", "f-3"] },
    );
    expect(f.retenue?.note).toBe(3);
    expect(f.eliminees.map((e) => e.motifs.join())).toEqual([...Array(6).fill(expect.stringMatching(/règle de Will/)), expect.stringMatching(/hors liste/)]);
  });

  it("de bout en bout : une accroche « vient de sortir », même la mieux notée, n'est jamais retenue", async () => {
    const { executeur } = executeurSimule({
      "equipe-accroches": (entree) => {
        const s = ROLES_CHAINE_EQUIPE.accroches.simuler(entree) as { accroches: AccrocheEquipe[]; premiereLigne: string };
        return { ...s, accroches: s.accroches.map((a, i) => (i === 0 ? { ...a, dit: "Dirigeant de PME ? Ce nouvel outil vient de sortir.", note: 10 } : { ...a, note: i })) };
      },
    });
    const r = await executerChaineEquipe(donnees(), executeur, options);
    expect(r.statut).toBe("terminee");
    if (r.statut !== "terminee") return;
    expect(r.version.declinaison.accroche).not.toMatch(/vient de sortir/);
    expect(r.etat.journal.find((j) => j.role === "equipe-accroches")?.echecs?.join(" ")).toMatch(/règle de Will/);
  });

  it("de bout en bout : aucune accroche ne passe → arrêt « sortie inutilisable », rien d'inventé", async () => {
    const { executeur } = executeurSimule({ "equipe-accroches": (entree) => ({ ...(ROLES_CHAINE_EQUIPE.accroches.simuler(entree) as { accroches: AccrocheEquipe[]; premiereLigne: string }), accroches: [acc("Bonjour à tous, aujourd'hui on parle de vos devis et de vos relances.", 9)] }) });
    const r = await executerChaineEquipe(donnees(), executeur, options);
    expect(r.statut).toBe("arretee");
    expect(r.etat.arret?.type).toBe("SORTIE_INVALIDE");
    expect(r.etat.arret?.etape).toBe(3);
  });

  it("de bout en bout : l'accroche retenue est la mieux notée qui passe, les éliminées sont au journal", async () => {
    const { executeur } = executeurSimule({
      "equipe-accroches": (entree) => {
        const s = ROLES_CHAINE_EQUIPE.accroches.simuler(entree) as { accroches: AccrocheEquipe[]; premiereLigne: string };
        return { ...s, accroches: s.accroches.map((a, i) => (i === 0 ? { ...a, dit: "Salut ! On parle des devis aujourd'hui.", note: 10 } : { ...a, note: i })) };
      },
    });
    const r = await executerChaineEquipe(donnees(), executeur, options);
    expect(r.statut).toBe("terminee");
    if (r.statut !== "terminee") return;
    expect(r.version.declinaison.accroche).not.toMatch(/^Salut/);
    expect(r.etat.journal.find((j) => j.role === "equipe-accroches")?.echecs?.join(" ")).toMatch(/éliminée « Salut/);
  });
});

describe("relecteur unique : juge, ne perd jamais l'ancrage", () => {
  it("priorité fixe (conformité > positionnement > rétention > clarté et voix), 5 corrections au plus", () => {
    const c = (axe: CorrectionEquipe["axe"], i: number): CorrectionEquipe => ({ axe, ou: "segment", segmentIndex: i, texte: "x", motif: `${axe}-${i}` });
    const t = trierCorrections([c("clarte-voix", 0), c("retention", 1), c("conformite", 2), c("positionnement", 3), c("clarte-voix", 4), c("conformite", 5), c("retention", 6)]);
    expect(t.map((x) => x.motif)).toEqual(["conformite-2", "conformite-5", "positionnement-3", "retention-1", "retention-6"]);
    expect(AXES_RELECTURE).toEqual(["conformite", "positionnement", "retention", "clarte-voix"]);
  });

  it("une correction qui fait perdre la citation d'ancrage est refusée, le texte reste, la trace est au journal", async () => {
    const d = donnees();
    const { executeur } = executeurSimule({
      "equipe-relecteur": (entree) => {
        const seg = [...entree.variable.matchAll(/<segment index="(\d+)" marqueurs="([^"]*)">/g)].find((x) => x[2].split(",").includes("ancrage"));
        return { verdicts: AXES_RELECTURE.map((axe) => ({ axe, ok: false, remarque: "" })), corrections: seg ? [{ axe: "clarte-voix", ou: "segment", segmentIndex: Number(seg[1]), texte: "Phrase sans la citation.", motif: "resserrer" }] : [] };
      },
    });
    const r = await executerChaineEquipe(d, executeur, options);
    expect(r.statut).toBe("terminee");
    if (r.statut !== "terminee") return;
    const textes = r.etat.corps![0].blocs!.flatMap((b) => b.segments).map((s) => s.texte);
    expect(textes).not.toContain("Phrase sans la citation.");
    expect(r.etat.journal.find((j) => j.role === "equipe-relecteur")?.echecs?.join(" ")).toContain("C31");
  });

  it("une correction qui enfreint une règle de Will est refusée par le code ; une correction sûre est appliquée", async () => {
    const d = donnees();
    const { executeur } = executeurSimule({
      "equipe-relecteur": (entree) => {
        const segs = [...entree.variable.matchAll(/<segment index="(\d+)" marqueurs="([^"]*)">/g)].filter((x) => !x[2].split(",").includes("ancrage") && !x[2].split(",").includes("exception"));
        return {
          verdicts: AXES_RELECTURE.map((axe) => ({ axe, ok: true, remarque: "" })),
          corrections: [
            { axe: "positionnement", ou: "segment", segmentIndex: Number(segs[0][1]), texte: "Faites-le vous-même, c'est simple.", motif: "test" },
            { axe: "clarte-voix", ou: "segment", segmentIndex: Number(segs[1][1]), texte: "On le retire. Tout de suite.", motif: "resserrer" },
          ],
        };
      },
    });
    const r = await executerChaineEquipe(d, executeur, options);
    expect(r.statut).toBe("terminee");
    if (r.statut !== "terminee") return;
    const textes = r.etat.corps![0].blocs!.flatMap((b) => b.segments).map((s) => s.texte);
    expect(textes).not.toContain("Faites-le vous-même, c'est simple.");
    expect(r.etat.equipe?.refusees?.join(" ")).toMatch(/faites-le vous-même/);
    // La correction sûre est gardée, sauf si le recontrôle l'écarte (plus de garde-fous rouges qu'avant).
    const ecartee = r.etat.equipe?.refusees?.some((x) => x.includes("recontrôle"));
    expect(textes.includes("On le retire. Tout de suite.") || ecartee).toBe(true);
  });

  it("relecture inutilisable : la version est gardée et marquée « non relue »", async () => {
    const base = executeurSimule().executeur;
    const executeur: ExecuteurRoles = {
      executer: async (role, entree) => (role.id === "equipe-relecteur" ? { ok: true, simule: true, invalide: "sortie hors schéma", coutUsd: 0, modele: "simulation", stopReason: "end_turn" } : base.executer(role, entree)),
    };
    const r = await executerChaineEquipe(donnees(), executeur, options);
    expect(r.statut).toBe("terminee");
    if (r.statut !== "terminee") return;
    expect(r.etat.nonRelue).toMatch(/pas relue/);
    expect(r.version.violations.some((v) => v.controle === "NON-RELUE")).toBe(true);
  });
});

describe("règles de Will dans les consignes", () => {
  it("chef, scénariste, accroches et relecteur portent toutes les règles (une seule source) ; le scénariste porte aussi celles de la prose (14 mots, emphase)", () => {
    for (const c of [CONSIGNE_EQUIPE_CHEF, CONSIGNE_EQUIPE_SCENARISTE, CONSIGNE_EQUIPE_ACCROCHES, CONSIGNE_EQUIPE_RELECTEUR]) {
      expect(c).toContain(REGLES_WILL);
      expect(c).toContain("faites-le vous-même");
      expect(c).toContain("vient de sortir");
      expect(c).toContain("nouvelle fonctionnalité");
      expect(c).toContain("vient d'annoncer");
      expect(c).toMatch(/TPE, PME, ETI ou grand groupe/);
      expect(c).toContain("ce n'est pas X, c'est Y");
      expect(c).toContain("superlatif");
      for (const interdit of ["aucun gain garanti", "chiffre sans source", "faux client"]) expect(c).toContain(interdit);
    }
    expect(CONSIGNE_EQUIPE_RELECTEUR).toMatch(/CONFORMITÉ[\s\S]*POSITIONNEMENT[\s\S]*RÉTENTION[\s\S]*CLARTÉ ET VOIX/);
    expect(CONSIGNE_EQUIPE_SCENARISTE).toContain(REGLE_PHRASES_COURTES);
    expect(CONSIGNE_EQUIPE_SCENARISTE).toContain(REGLE_EMPHASE);
    expect(MOTS_PAR_PHRASE_MAX).toBe(14);
    expect(CONSIGNE_EQUIPE_SCENARISTE).toMatch(/avant 40 %/);
    expect(CONSIGNE_EQUIPE_SCENARISTE).toMatch(/entre 50 et 70 %/);
  });

  it("le code repère les infractions aux règles de Will", () => {
    expect(violationsReglesWill("Cet outil vient de sortir.").map((x) => x.id)).toEqual(["WILL-NOUVEAUTE"]);
    expect(violationsReglesWill("Ce n'est pas un outil, c'est une méthode.").map((x) => x.id)).toEqual(["WILL-PAS-X-Y"]);
    expect(violationsReglesWill("Une solution incroyable.").map((x) => x.id)).toEqual(["WILL-SUPERLATIF"]);
    expect(violationsReglesWill("Faites-le vous-même.").map((x) => x.id)).toEqual(["WILL-DIY"]);
    expect(violationsReglesWill("Basés à Villeexemple.").map((x) => x.id)).toEqual(["WILL-INTERDIT"]);
    // Certification Certifexemple : les deux ordres, accents et casse ignorés (liste unique du socle) ; le mot seul passe.
    for (const t of ["Nous sommes certifiés Certifexemple.", "Un organisme Certifexemple certifié.", "CERTIFEXEMPLE CERTIFIEE", "Certification Certifexemple obtenue."]) expect(violationsReglesWill(t).map((x) => x.id), t).toEqual(["WILL-INTERDIT"]);
    expect(violationsReglesWill("Une formation finançable par Certifexemple.")).toEqual([]);
    expect(violationsReglesWill("Voici ce qu'on met en place pour vos devis.")).toEqual([]);
    expect(violationsReglesWill("Dans un monde où tout change, plongeons.").map((x) => x.id)).toEqual(["WILL-TIC"]);
  });

  it("le script du scénariste est évalué sur les règles de Will (segments, publication)", () => {
    const ev = EVALUATIONS_EQUIPE_SCENARISTE.find((e) => e.id === "EQS-03")!;
    const s = { segments: [{ texte: "Faites-le vous-même ce soir.", marqueurs: [] }], version: { publication: { texte: "Ce nouvel outil vient de sortir." } } } as unknown as Parameters<typeof ev.verifier>[0];
    expect(ev.verifier(s, {} as Parameters<typeof ev.verifier>[1]).join()).toMatch(/WILL-DIY[\s\S]*WILL-NOUVEAUTE/);
  });

  it("repères de temps : gain avant 40 %, relance entre 50 et 70 %", () => {
    const s = (marqueurs: string[], n = 10) => ({ texte: Array(n).fill("mot").join(" "), marqueurs });
    expect(reperesManques([s([]), s([]), s([]), s([]), s(["relance"]), s(["livraison"]), s([]), s([]), s([]), s([])])).toHaveLength(2);
    expect(reperesManques([s(["livraison"]), s([]), s([]), s([]), s([]), s(["relance"]), s([]), s([]), s([]), s([])])).toEqual([]);
  });
});

describe("coût : pire cas, cache canonique, effort et modèles", () => {
  it("pire cas sous le plafond d'un sujet (1,50 $), le chef compté deux fois ; même entrée que pireCasChaine(« equipe »)", () => {
    const d = donnees();
    const un = pireCasChaineEquipe(d, { reseau: d.sujet.reseaux[0] });
    expect(un.usd).toBeLessThanOrEqual(1.5);
    expect(un.detail.find((x) => x.role === "equipe-chef")?.appels).toBe(2);
    expect(un.appels).toBe(5);
    const tous = pireCasChaine("equipe", { donnees: d, options: { reseaux: d.sujet.reseaux } });
    expect(tous.usd).toBeLessThanOrEqual(1.5);
    expect(tous.appels).toBe(5 + d.sujet.reseaux.length - 1);
  });

  it("estimation réaliste d'un réseau (rôles jamais mesurés : entrée + un quart de la sortie) : sous le pire cas", async () => {
    const d = donnees();
    const { executeur, appels } = executeurSimule();
    await executerChaineEquipe(d, executeur, options);
    const roles = Object.values(ROLES_CHAINE_EQUIPE) as DefinitionRole[];
    const total = appels.reduce((t, a) => t + estimationRealisteRole(roles.find((r) => r.id === a.role)!, a.entree), 0);
    expect(total).toBeGreaterThan(0.1);
    expect(total).toBeLessThan(pireCasChaineEquipe(d).usd);
  });

  it("une reprise après le relecteur ne compte que les déclinaisons", () => {
    const d = donnees();
    const p = pireCasChaineEquipe(d, { reseaux: d.sujet.reseaux }, { version: 1, etape: 4, coutUsd: 0, journal: [] });
    expect(p.detail.every((x) => x.role === "declinaison")).toBe(true);
  });

  it("même socle canonique en cache 1 h que les autres rôles ; aucun format de sortie ; effort moyen fixe ; Opus pour relire le cache", () => {
    const d = donnees();
    const cache = blocsEnCache(d, parametresGenerateur(d.sujet.formatId));
    const prefixe = (role: DefinitionRole) => {
      const s = corpsRequete(construireRequete(role, { contexte: cache, variable: "v" })).system as { text: string; cache_control?: { ttl?: string } }[];
      return JSON.stringify(s.slice(0, s.findIndex((b) => b.cache_control?.ttl === "1h") + 1));
    };
    const reference = prefixe(roleCourtAngle);
    for (const role of Object.values(ROLES_CHAINE_EQUIPE) as DefinitionRole[]) {
      expect(prefixe(role), role.id).toBe(reference);
      const corps = corpsRequete(construireRequete(role, { contexte: cache, variable: "v" })) as { output_config: Record<string, unknown> };
      expect(corps.output_config, role.id).toEqual({ effort: "medium" });
      expect(role.effort, role.id).toBe("medium");
      expect(role.modele, role.id).toBe(MODELE_ECRITURE);
      expect(construireRequete(role, { contexte: cache, variable: "v" }).systeme.at(-1)!.texte, role.id).toContain("<schema_sortie>");
    }
    expect(MODELE_ECRITURE).not.toBe(MODELE_JUGE);
  });

  it("les rôles « équipe » sont dans la fiche figée des versions", () => {
    const v = versionsRoles();
    for (const r of Object.values(ROLES_CHAINE_EQUIPE)) expect(v[r.id]).toBe(r.version);
  });
});
