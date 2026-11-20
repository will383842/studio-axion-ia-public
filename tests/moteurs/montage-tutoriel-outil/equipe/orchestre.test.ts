/**
 * T-EXT-55 · orchestre de l'équipe (pur). Faux rôles : la simulation déterministe de chaque rôle (aucun appel, 0 €).
 */
import { describe, expect, it } from "vitest";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { roleAnalyste } from "@/moteurs/montage-tutoriel-outil/equipe/analyste";
import { roleChefDeProjet } from "@/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import { roleMaquettiste } from "@/moteurs/montage-tutoriel-outil/equipe/maquettiste";
import { roleScenariste } from "@/moteurs/montage-tutoriel-outil/equipe/scenariste";
import { roleStrategeValeur } from "@/moteurs/montage-tutoriel-outil/equipe/strategie-valeur";
import { appliquerSortie, prochainPas, ROLES_TUTORIEL, type DossierLu, type EntreesEquipe, type EtatEquipe } from "@/moteurs/montage-tutoriel-outil/equipe/orchestre";
import type { DescriptionMaquette } from "@/moteurs/montage-tutoriel-outil/description-maquette";
import { empreinteDescription } from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import type { IdRole } from "@/moteurs/montage-tutoriel-outil/journal-roles";
import { dossierComplet, entreesCompletes, fauxScenariste } from "../../../tutoriel-outil/equipe-doubles";

const FAUX: Partial<Record<IdRole, DefinitionRole>> = {
  "chef-de-projet": roleChefDeProjet as DefinitionRole,
  analyste: roleAnalyste as DefinitionRole,
  stratege: roleStrategeValeur as DefinitionRole,
  scenariste: roleScenariste as DefinitionRole,
};

/** Fait tourner l'équipe jusqu'à une pause : la suite des rôles, le nombre d'appels payants, la pause. */
const parDefaut = (role: IdRole, entree: EntreeRole, _n: number, etat: EtatEquipe): unknown => (role === "scenariste" ? fauxScenariste(etat.fiche as never) : FAUX[role]!.simuler(entree));

async function courir(depart: EtatEquipe, entrees: EntreesEquipe, sortie: (role: IdRole, entree: EntreeRole, n: number, etat: EtatEquipe) => unknown = parDefaut) {
  let e = depart;
  const ordre: IdRole[] = [];
  const appels: IdRole[] = [];
  for (let i = 0; i < 40; i++) {
    const p = prochainPas(e, entrees);
    if ("fini" in p) return { e, ordre, appels, pause: null };
    if ("pause" in p) return { e: p.etat ?? e, ordre, appels, pause: p.pause };
    ordre.push(p.faire);
    if (!p.payant) {
      e = p.etat;
      continue;
    }
    appels.push(p.faire);
    const a = await appliquerSortie(e, p.faire, sortie(p.faire, p.entree, appels.filter((x) => x === p.faire).length, e), entrees);
    e = a.etat;
    if (!a.ok && a.bloquee) return { e, ordre, appels, pause: { code: "TO_EQUIPE_BLOQUEE", message: "" } };
  }
  throw new Error("boucle");
}

const demande = { phrase: "Suivre ses stocks sans tableur" };
const neuf = (): EtatEquipe => ({ demande, payes: {} });

describe("ROLES_TUTORIEL (lu par T-EXT-42)", () => {
  it("liste stable, 0 = règles seules", () => {
    expect(ROLES_TUTORIEL).toEqual([
      { id: "chef-de-projet", essaisMax: 1, payant: "si-a-trancher" },
      { id: "analyste", essaisMax: 1 },
      { id: "maquettiste", essaisMax: 1, payant: "si-manque" },
      { id: "stratege", essaisMax: 1 },
      { id: "scenariste", essaisMax: 2 },
      { id: "realisateur", essaisMax: 0 },
      { id: "controleur", essaisMax: 0 },
    ]);
    expect(Object.isFrozen(ROLES_TUTORIEL)).toBe(true);
  });
});

describe("prochainPas : dossier complet", () => {
  it("chef (règles, 0 appel) → analyste (règles) → stratège → scénariste → réalisateur → contrôleur → registre → pause à valider", async () => {
    const r = await courir(neuf(), entreesCompletes());
    expect(r.ordre).toEqual(["chef-de-projet", "analyste", "stratege", "scenariste", "realisateur", "controleur", "documentaliste"]);
    // Seuls le stratège et le scénariste parlent à Claude : le chef et l'analyste travaillent par règles.
    expect(r.appels).toEqual(["stratege", "scenariste"]);
    expect(r.pause?.code).toBe("TO_SCRIPT_A_VALIDER");
    expect(r.e.cahier && r.e.carte && r.e.fiche && r.e.propositionScripts && r.e.parcours && r.e.verdict && r.e.registre).toBeTruthy();
    // Rien n'est choisi à la place de Williams.
    expect(r.e.scriptChoisi).toBeUndefined();
    expect(r.e.registre?.fige).toBeUndefined();
  });

  it("même état, mêmes entrées : même pas (déterministe) ; l'état reçu n'est jamais modifié", () => {
    const e = neuf();
    const avant = JSON.stringify(e);
    expect(prochainPas(e, entreesCompletes())).toEqual(prochainPas(e, entreesCompletes()));
    expect(JSON.stringify(e)).toBe(avant);
  });

  it("contrôleur bloquant : pas d'arrêt silencieux, la pause à valider montre le verdict", async () => {
    const r = await courir(neuf(), entreesCompletes());
    const bloque = { ...r.e, verdict: { ...r.e.verdict!, verdict: "bloque" as const } };
    const p = prochainPas(bloque, entreesCompletes());
    expect(p).toMatchObject({ pause: { code: "TO_SCRIPT_A_VALIDER" } });
    expect("pause" in p && p.pause.message).toMatch(/contrôle/);
    expect("pause" in p && p.pause.message).not.toMatch(/échec|erreur/i);
  });

  it("phrases sans montant, sans étiquette interdite", async () => {
    const dossier: DossierLu = { ...dossierComplet(), fichiers: [] };
    const p = prochainPas(neuf(), { dossier });
    const phrases = [JSON.stringify(p)];
    for (const t of phrases) expect(t).not.toMatch(/€|\$|euros?|Douleur|Solution|À vous/);
  });
});

describe("prochainPas : cas particuliers", () => {
  it("« à trancher » seulement : un appel du chef (Opus), puis ses règles reprennent ; un avis incohérent est écarté", async () => {
    const entrees: EntreesEquipe = { dossier: { ...dossierComplet(), donnees: undefined, inventaire: { ...dossierComplet().inventaire, donnees: false } } };
    const p = prochainPas(neuf(), entrees);
    expect(p).toMatchObject({ faire: "chef-de-projet", payant: true });
    const bon = await appliquerSortie(neuf(), "chef-de-projet", { cas: 1, gabarits: ["G-Decision"], raison: "Données prévues" }, entrees);
    expect(bon.ok && bon.etat.decision?.certitude).toBe("sure");
    // Avis incohérent (cas 5 sans flux) : écarté, les règles gardent la main, jamais un échec.
    const mauvais = await appliquerSortie(neuf(), "chef-de-projet", { cas: 5, gabarits: ["G-Flux", "G-Decision"], raison: "x" }, entrees);
    expect(mauvais.ok).toBe(true);
    expect(mauvais.etat.decision?.cas).toBe(1);
    expect(mauvais.etat.decision?.raisons.join(" ")).toMatch(/avis écarté/);
    // Avec la décision posée, le pas suivant est le chef par règles (établit le cahier), sans appel.
    expect(prochainPas(bon.etat, entrees)).toMatchObject({ faire: "chef-de-projet", payant: false });
  });

  it("phrase seule (aucun dossier) : le chef met la demande en pause avec SA phrase, 0 appel", async () => {
    const r = await courir(neuf(), { dossier: null });
    expect(r.appels).toEqual([]);
    expect(r.pause?.code).toMatch(/^TO_(CAS_V2|DEMANDE_VIDE)$/);
    expect(r.pause?.message).toMatch(/rien n'a échoué|Aucune demande|raccourcissez/i);
  });

  it("manque que personne ne sait compléter : TO_DOSSIER_INCOMPLET, jamais un échec", () => {
    const base = prochainPas(neuf(), entreesCompletes());
    expect(base).toMatchObject({ faire: "chef-de-projet" });
    const e: EtatEquipe = { ...neuf(), cahier: { version: "cahier-tutoriel.v1", entree: "A", cas: 3, gabarits: ["G-Flux"], roles: [], manques: ["flux-automatisation"], scriptsFournis: [], fin: "aucune", ratios: ["4:5"], dureeCibleSec: [40, 55], raisons: [] } };
    const p = prochainPas(e, entreesCompletes());
    expect(p).toMatchObject({ pause: { code: "TO_DOSSIER_INCOMPLET" } });
    expect("pause" in p && p.pause.message).toBe("Il manque « flux-automatisation » : ajoutez-le à votre dossier. Rien n'a échoué.");
  });

  it("pièce que le maquettiste sait compléter, contexte absent : TO_DOSSIER_INCOMPLET ; contexte donné : maquettiste AVANT l'analyste", () => {
    const cahier = { version: "cahier-tutoriel.v1" as const, entree: "B" as const, cas: 1 as const, gabarits: ["G-Decision" as const], roles: [], manques: ["donnees-exemple"], scriptsFournis: [], fin: "aucune" as const, ratios: ["4:5" as const], dureeCibleSec: [40, 55] as const, raisons: [] };
    const e: EtatEquipe = { ...neuf(), cahier };
    expect(prochainPas(e, entreesCompletes())).toMatchObject({ pause: { code: "TO_DOSSIER_INCOMPLET" } });
    const avec: EntreesEquipe = { dossier: { ...dossierComplet(), contexteMaquettiste: { metier: "Atelier", carteZones: [{ id: "stocks", libelle: "Stocks" }], interdits: [] } } };
    expect(prochainPas(e, avec)).toMatchObject({ faire: "maquettiste", payant: true });
  });
});

describe("appliquerSortie : refus, essais, blocage", () => {
  it("sortie illisible du scénariste : remarques gardées, rejoué avec elles ; deux fois : bloqué (TO_EQUIPE_BLOQUEE)", async () => {
    const r = await courir(neuf(), entreesCompletes(), (role, entree, n, etat) => (role === "scenariste" ? { n } : parDefaut(role, entree, n, etat)));
    expect(r.appels.filter((x) => x === "scenariste")).toHaveLength(2);
    expect(r.pause).toMatchObject({ code: "TO_EQUIPE_BLOQUEE" });
    expect(r.e.propositionScripts).toBeUndefined();
    expect(r.e.remarques?.scenariste?.length).toBeGreaterThan(0);
  });

  it("le second essai reçoit les remarques du refus (donnée, jamais une consigne) ; l'entrée change donc l'empreinte", async () => {
    const e0 = (await courir(neuf(), entreesCompletes(), (role, entree, n, etat) => (role === "scenariste" ? { vide: true } : parDefaut(role, entree, n, etat)))).e;
    // Après deux refus l'équipe est bloquée ; avec un seul refus, le pas suivant rejoue le rôle avec ses remarques.
    const un = await appliquerSortie({ ...e0, appels: { scenariste: 0 }, remarques: undefined, propositionScripts: undefined }, "scenariste", { vide: true }, entreesCompletes());
    expect(un.ok).toBe(false);
    const rejoue = prochainPas(un.etat, entreesCompletes());
    expect(rejoue).toMatchObject({ faire: "scenariste", payant: true });
    const premier = prochainPas({ ...un.etat, remarques: undefined, appels: { scenariste: 0 } }, entreesCompletes());
    expect("empreinteEntree" in rejoue && "empreinteEntree" in premier && rejoue.empreinteEntree !== premier.empreinteEntree).toBe(true);
    expect("entree" in rejoue && rejoue.entree.variable).toContain("<remarques_precedentes>");
  });

  it("jamais d'exception : sortie nulle, absurde ou rôle sans appel", async () => {
    for (const brut of [null, undefined, 42, "texte", [], { a: 1 }]) {
      const a = await appliquerSortie(neuf(), "analyste", brut, entreesCompletes());
      expect(a.ok).toBe(false);
    }
    expect((await appliquerSortie(neuf(), "realisateur", {}, entreesCompletes())).ok).toBe(false);
  });
});

describe("V2-08 : le pas « pièce créée » (option phraseOuverte)", () => {
  const phrase = (p: string): EtatEquipe => ({ demande: { phrase: p }, payes: {} });
  const ATELIER = "un tableau de bord pour un atelier";
  const TRI = "je veux un tri d'e-mails";
  const vide: EntreesEquipe = { dossier: null };
  const ouvert: EntreesEquipe = { dossier: null, phraseOuverte: true };
  const FLUX_BRUT = { manque: "flux-automatisation", contenu: {} };

  it("sans l'option : les sorties d'une phrase sont celles d'aujourd'hui (TO_CAS_V2), avec ou sans `false` explicite", () => {
    for (const p of [ATELIER, TRI]) {
      const sans = prochainPas(phrase(p), vide);
      expect("pause" in sans && sans.pause.code).toBe("TO_CAS_V2");
      expect(prochainPas(phrase(p), vide, { phraseOuverte: false })).toEqual(sans);
      expect(prochainPas(phrase(p), { dossier: null, phraseOuverte: "true" as never })).toEqual(sans);
    }
  });

  it("sans l'option : un dossier donne exactement le même pas qu'avant", () => {
    const e = neuf();
    const entrees = entreesCompletes();
    expect(prochainPas(e, entrees, { phraseOuverte: false })).toEqual(prochainPas(e, entrees));
  });

  it("avec l'option, « un tableau de bord pour un atelier » : les règles classent (aucun appel du chef), puis le maquettiste reçoit la demande", async () => {
    const r = await courir(phrase(ATELIER), ouvert, sortiePhrase);
    expect(r.ordre).toEqual(["chef-de-projet", "maquettiste"]);
    expect(r.appels).toEqual(["maquettiste"]);
  });

  it("avec l'option : le pas du maquettiste est payant, porte la phrase en <demande> et la proposition 1", () => {
    let e = phrase(ATELIER);
    const p1 = prochainPas(e, ouvert);
    expect("faire" in p1 && p1.faire).toBe("chef-de-projet");
    if (!("faire" in p1) || p1.payant) throw new Error("le chef doit répondre par les règles");
    e = p1.etat;
    const p2 = prochainPas(e, ouvert);
    if (!("faire" in p2) || !p2.payant) throw new Error("pas de maquettiste");
    expect(p2.faire).toBe("maquettiste");
    expect(p2.entree.variable).toContain(`<demande>${ATELIER}</demande>`);
    expect(p2.entree.variable).toContain("<proposition>1</proposition>");
    expect(p2.entree.variable).toContain("<manque>maquette</manque>");
  });

  it("une proposition acceptée par les contrôles attend son aperçu, puis son choix ; rien d'autre n'est appelé", async () => {
    const fait = await courir(phrase(ATELIER), ouvert, sortiePhrase);
    expect(fait.pause?.code).toBe("TO_PIECE_A_CONSTRUIRE");
    expect(fait.e.pieceCreee?.statut).toBe("a-construire");
    expect(fait.appels).toEqual(["maquettiste"]);
    const p = fait.e.pieceCreee!;
    const avecApercu = { ...fait.e, pieceCreee: { ...p, apercu: { version: "apercu-piece.v1" as const, empreinteDescription: p.empreinte, images: [{ ecranId: "accueil", etat: "avant" as const, cle: "a.png" }], controle: { ok: true, defauts: [] } } } };
    expect("pause" in prochainPas(avecApercu, ouvert) && (prochainPas(avecApercu, ouvert) as { pause: { code: string } }).pause.code).toBe("TO_PIECE_A_VALIDER");
  });

  it("pièce gardée : l'analyste est sauté, le stratège est le pas suivant, les textes sont au registre « créés »", async () => {
    const fait = await courir(phrase(ATELIER), ouvert, sortiePhrase);
    const p = fait.e.pieceCreee!;
    const gardee = { ...fait.e, pieceCreee: { ...p, statut: "gardee" as const, apercu: { version: "apercu-piece.v1" as const, empreinteDescription: p.empreinte, images: [{ ecranId: "accueil", etat: "avant" as const, cle: "a.png" }], controle: { ok: true, defauts: [] } }, gardee: { empreinte: p.empreinte, le: "2026-11-20T10:00:00.000Z" } } };
    const suite = await courir(gardee, ouvert, sortiePhrase);
    expect(suite.ordre[0]).toBe("maquettiste");
    expect(suite.ordre).not.toContain("analyste");
    expect(suite.appels).toEqual(["stratege", "scenariste"]);
    expect(suite.pause?.code).toBe("TO_SCRIPT_A_VALIDER");
    const textes = suite.e.registre?.entrees.filter((x) => x.ou === "maquette") ?? [];
    expect(textes.length).toBeGreaterThan(0);
    expect(textes.every((x) => x.origine === "maquette-creee" && x.choisi === true)).toBe(true);
  });

  it("pièce corrigée après le « oui » : les anciens textes, la carte et la suite sont effacés ; au nouveau « oui », le registre porte les textes de la nouvelle pièce", async () => {
    const fait = await courir(phrase(ATELIER), ouvert, sortiePhrase);
    const p = fait.e.pieceCreee!;
    const apercuDe = (empreinte: string) => ({ version: "apercu-piece.v1" as const, empreinteDescription: empreinte, images: [{ ecranId: "accueil", etat: "avant" as const, cle: "a.png" }], controle: { ok: true, defauts: [] } });
    const gardee = { ...fait.e, pieceCreee: { ...p, statut: "gardee" as const, apercu: apercuDe(p.empreinte), gardee: { empreinte: p.empreinte, le: "2026-11-20T10:00:00.000Z" } } };
    const avant = await courir(gardee, ouvert, sortiePhrase);
    expect(avant.pause?.code).toBe("TO_SCRIPT_A_VALIDER");
    expect(avant.e.fiche).toBeDefined();
    // Williams corrige un texte : la description et son empreinte changent, le « oui » n'est plus valable.
    const ancien = p.contenu as DescriptionMaquette;
    const NOUVEAU = "Titre corrigé par Williams";
    const corrigee: DescriptionMaquette = { ...ancien, ecrans: ancien.ecrans.map((x, i) => (i === 0 ? { ...x, titre: NOUVEAU } : x)) };
    const empreinte = empreinteDescription(corrigee);
    expect(empreinte).not.toBe(p.empreinte);
    const apresCorrection = { ...avant.e, pieceCreee: { ...avant.e.pieceCreee!, contenu: corrigee, empreinte } };
    const pause = prochainPas(apresCorrection, ouvert);
    if (!("pause" in pause)) throw new Error("une pause « à construire » est attendue");
    expect(pause.pause.code).toBe("TO_PIECE_A_CONSTRUIRE");
    for (const champ of ["carte", "donnees", "textesMaquette", "carteEmpreinte", "fiche", "propositionScripts", "parcours", "verdict", "registre"] as const) expect(pause.etat?.[champ]).toBeUndefined();
    // Nouveau « oui » sur la nouvelle pièce.
    const reoui = { ...pause.etat!, pieceCreee: { ...pause.etat!.pieceCreee!, statut: "gardee" as const, apercu: apercuDe(empreinte), gardee: { empreinte, le: "2026-11-20T11:00:00.000Z" } } };
    const suite = await courir(reoui, ouvert, sortiePhrase);
    expect(suite.pause?.code).toBe("TO_SCRIPT_A_VALIDER");
    const textes = (suite.e.registre?.entrees ?? []).filter((x) => x.ou === "maquette");
    expect(JSON.stringify(textes)).toContain(NOUVEAU);
    expect(JSON.stringify(suite.e.textesMaquette)).toContain(NOUVEAU);
    if (ancien.ecrans[0]!.titre !== NOUVEAU) expect(JSON.stringify(suite.e.textesMaquette)).not.toContain(JSON.stringify(ancien.ecrans[0]!.titre).slice(1, -1));
    // Même sans la pause (état gardé avec une carte d'une autre empreinte) : la carte est redéduite.
    const perime = { ...avant.e, pieceCreee: reoui.pieceCreee };
    const r = prochainPas(perime, ouvert);
    if (!("faire" in r) || r.payant) throw new Error("redéduction locale attendue");
    expect(r.etat.carteEmpreinte).toBe(empreinte);
    expect(r.etat.fiche).toBeUndefined();
  });

  it("avant « gardée », le registre ne contient aucun texte de la maquette", async () => {
    const fait = await courir(phrase(ATELIER), ouvert, sortiePhrase);
    expect(fait.e.registre).toBeUndefined();
    expect(fait.e.textesMaquette).toBeUndefined();
  });

  it("« tri d'e-mails » : le genre est « flux » (cahier G-Flux, manque flux-automatisation)", () => {
    let e = phrase(TRI);
    const p1 = prochainPas(e, ouvert);
    if (!("faire" in p1) || p1.payant) throw new Error("règles attendues");
    e = p1.etat;
    expect(e.cahier?.gabarits).toEqual(["G-Flux"]);
    const p2 = prochainPas(e, ouvert);
    if (!("faire" in p2) || !p2.payant) throw new Error("maquettiste attendu");
    expect(p2.entree.variable).toContain("<manque>flux-automatisation</manque>");
  });

  it("flux refusé par le lecteur du flux : remarques gardées, aucune reprise automatique (bloquée)", async () => {
    const r = await courir(phrase(TRI), ouvert, () => FLUX_BRUT);
    expect(r.appels).toEqual(["maquettiste"]);
    expect(r.pause?.code).toBe("TO_EQUIPE_BLOQUEE");
  });

  it("cas 4 (assistant) : reste en pause, aucun appel", async () => {
    const r = await courir(phrase("je veux un assistant pour répondre à mes clients"), ouvert);
    expect(r.appels).toEqual([]);
  });
});

function sortiePhrase(role: IdRole, entree: EntreeRole, n: number, etat: EtatEquipe): unknown {
  if (role === "maquettiste") return (roleMaquettiste as unknown as DefinitionRole).simuler(entree);
  // Deux moments, comme dans le dossier fictif : le faux scénariste tient alors dans la durée cible.
  if (role === "stratege") {
    const fiche = parDefaut(role, entree, n, etat) as { moments: unknown[] };
    return { ...fiche, moments: fiche.moments.slice(0, 2) };
  }
  return parDefaut(role, entree, n, etat);
}
