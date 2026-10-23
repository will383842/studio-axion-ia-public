/**
 * SOCLE QUALITÉ · EXACTITUDE (relecture de la PR 327) : zéro faux signal sur les scripts validés et les exemples du
 * dépôt, et preuve que le socle ne change aucun verdict des écrivains existants. Aucun appel, aucun réseau.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluerQualite, type ResultatRegle } from "@/domaine/qualite-script";
import { depuisFicheImage } from "@/domaine/qualite-script/adaptateurs/image-video";
import { depuisLignesTableau } from "@/domaine/qualite-script/adaptateurs/tableau";
import { RECETTE_IMAGE_VIDEO, RECETTE_TABLEAU } from "@/domaine/qualite-script/recettes";
import { APPELS_PAR_RESEAU } from "@/domaine/qualite-script/seuils";
import { lignesDuScriptTableau, pastillesTexteTableau } from "@/domaine/relecture-tableau";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { ecritureCasReel, DEMANDE_CAS_REEL } from "../tableau-scripts/cas-reel-audit";
import { EXEMPLES_V3, ecritureV3 } from "../tableau-scripts/exemples-v3";
import { exempleV4 } from "../tableau-scripts/exemples-v4";
import { DEMANDE_1510, ecriture1510 } from "../tableau-scripts/script-15-10";
import { BON, code, evaluer, variante } from "./aide";

const statut = (r: { resultats: ResultatRegle[] }, c: string) => code(r, c).statut;

describe("PO-01 : la phrase de positionnement souhaitée n'est pas signalée", () => {
  const fin = (phrase: string) => evaluer(variante(9, ["a-retenir", phrase]));
  it.each([
    "Vous n'avez plus à le faire vous-même : on s'en occupe.",
    "On le fait pour vous, pas besoin de le faire vous-même.",
    "Testez-le gratuitement avec notre équipe.",
    "Sans le faire vous-même, le devis part tout seul.",
  ])("ok : %s", (phrase) => expect(statut(fin(phrase), "PO-01")).toBe("ok"));
  it.each(["Faites-le vous-même ce week-end.", "À vous de jouer avec votre devis.", "Essayez-le vous-même demain.", "Testez-le chez vous."])("écart : %s", (phrase) =>
    expect(statut(fin(phrase), "PO-01")).toBe("ecart"),
  );
});

describe("PO-02 : les tournures banales ne sont pas des annonces d'outil", () => {
  const dans = (phrase: string) => evaluer(variante(3, ["promesse", phrase]));
  it.each([
    "Pour tout nouveau client, le contrat part tout seul.",
    "Toute nouvelle candidature reçoit une réponse.",
    "La dernière version du devis part au client.",
    "La nouvelle version de votre devis part seule.",
  ])("ok : %s", (phrase) => expect(statut(dans(phrase), "PO-02")).toBe("ok"));
  it.each(["Un tout nouvel outil de devis.", "La nouvelle version de ChatGPT change tout.", "Cette toute nouvelle fonctionnalité aide.", "Cet outil vient de sortir."])("écart : %s", (phrase) =>
    expect(statut(dans(phrase), "PO-02")).toBe("ecart"),
  );
});

describe("PR-02 / RT-07 : une étape du corps n'est pas une demande", () => {
  const corps = (phrase: string) => evaluer([...variante(4, ["corps", phrase])]);
  it("« Écrivez la décision en une phrase » dans le corps : une seule demande, rien après", () => {
    const r = corps("Écrivez la décision en une phrase, puis envoyez-la au client.");
    expect(statut(r, "PR-02")).toBe("ok");
    expect(code(r, "PR-02").message).not.toContain("demandes");
    expect(statut(r, "RT-07")).toBe("ok");
  });
  it("un indicatif (« Vous la tapez dans le CRM ») n'est pas une demande, même après la demande finale", () => {
    const r = evaluer([...BON.slice(0, 9), ["a-retenir", "Vous la tapez dans le CRM, une fois."], BON[10]]);
    expect(statut(r, "PR-02")).toBe("ok");
    expect(statut(r, "RT-07")).toBe("ok");
  });
  it("une vraie deuxième demande en fin reste comptée", () => {
    const r = evaluer([...variante(9, ["a-retenir", "Le devis part seul, votre équipe garde la relation."]), ["appel", "Écrivez DEVIS en commentaire. Envoyez-la aussi à votre associé."]]);
    expect(code(r, "PR-02").message).toContain("2 demandes");
  });
});

describe("image → vidéo sur LinkedIn : la question à commenter est hors vidéo, la demande est facultative", () => {
  it.each(Object.entries(FICHES_SIMULEES))("fiche %s : PR-02 n'est pas un écart sur LinkedIn", (_id, fiche) => {
    const r = evaluerQualite(depuisFicheImage(fiche, { reseau: "linkedin" }), RECETTE_IMAGE_VIDEO);
    expect(statut(r, "PR-02")).toBe("ok");
  });
  it("sans aucune demande, Instagram reste en écart (la recette n'est pas relâchée), LinkedIn est ok", () => {
    const sans = BON.slice(0, 10);
    expect(statut(evaluer(sans, RECETTE_IMAGE_VIDEO, { reseau: "instagram" }), "PR-02")).toBe("ecart");
    expect(statut(evaluer(sans, RECETTE_IMAGE_VIDEO, { reseau: "linkedin" }), "PR-02")).toBe("ok");
  });
});

// Skippé : document interne retiré de la version publique (média/document retiré de la version publique).
describe.skip("la doc des appels dit la même chose que la table de code", () => {
  const doc = "";
  const ligne = (debut: string) => doc.split("\n").find((l) => l.startsWith(`| ${debut}`)) ?? "";
  const cellules = (l: string) => l.split("|").map((c) => c.trim());
  const cas: [string, keyof typeof APPELS_PAR_RESEAU][] = [["LinkedIn", "linkedin"], ["Instagram, Facebook", "instagram"], ["TikTok", "tiktok"], ["YouTube Shorts", "youtube-shorts"]];
  it.each(cas)("%s : permis et écarté", (nom, reseau) => {
    const [, , permis, ecarte] = cellules(ligne(nom));
    const t = APPELS_PAR_RESEAU[reseau];
    expect(/abonn/i.test(permis), "abonnement permis").toBe(t.permis.includes("abonnement"));
    expect(/abonn/i.test(ecarte), "abonnement écarté").toBe(!t.permis.includes("abonnement"));
    expect(/message privé/i.test(permis), "message privé permis").toBe(t.permis.includes("message-prive"));
    expect(/commentez|écrivez mot/i.test(permis), "mot à commenter permis").toBe(t.permis.includes("commentez-mot"));
  });
});

describe("zéro faux signal sur les scripts validés et les exemples du dépôt", () => {
  const v4 = exempleV4("01-formation");
  const sources = [
    ...EXEMPLES_V3.map((e) => ({ nom: `v3 ${e.fichier}`, ecriture: ecritureV3(e), demande: e.demande })),
    { nom: "v4 01-formation", ecriture: v4.ecriture, demande: v4.demande },
    { nom: "15-10", ecriture: ecriture1510(), demande: DEMANDE_1510 },
    { nom: "cas réel", ecriture: ecritureCasReel(), demande: DEMANDE_CAS_REEL },
  ];
  const regles = ["PO-01", "PO-02", "PR-02", "RT-07"];
  it.each(sources)("$nom : PO-01, PO-02, PR-02 et RT-07 ne signalent rien", ({ nom, ecriture }) => {
    const r = evaluerQualite(depuisLignesTableau(lignesDuScriptTableau(ecriture.script)), RECETTE_TABLEAU);
    // « Je vous l'envoie » suit « Écrivez GRILLE » dans le cas réel (écrit avant le gabarit) : RT-07 le dit à raison.
    const faux = r.resultats.filter((x) => regles.includes(x.code) && x.statut === "ecart" && !(nom === "cas réel" && x.code === "RT-07")).map((x) => `${x.code} : ${x.message}`);
    expect(faux).toEqual([]);
  });
});

describe("aucun verdict des écrivains existants ne change (le socle ne fait qu'observer)", () => {
  const v4 = exempleV4("01-formation");
  const sources = [
    ...EXEMPLES_V3.map((e) => ({ nom: `v3 ${e.fichier}`, ecriture: ecritureV3(e), demande: e.demande })),
    { nom: "v4 01-formation", ecriture: v4.ecriture, demande: v4.demande },
    { nom: "15-10", ecriture: ecriture1510(), demande: DEMANDE_1510 },
    { nom: "cas réel", ecriture: ecritureCasReel(), demande: DEMANDE_CAS_REEL },
  ];
  it.each(sources)("$nom : mêmes pastilles de l'écrivain avant et après le passage du socle, entrées intactes, socle en « info »", ({ ecriture, demande }) => {
    const lignes = lignesDuScriptTableau(ecriture.script);
    const avant = JSON.stringify(pastillesTexteTableau(lignes, { ecriture, demande }));
    const lignesAvant = JSON.stringify(lignes);
    const rapport = evaluerQualite(depuisLignesTableau(lignes), RECETTE_TABLEAU);
    expect(JSON.stringify(lignes), "le socle a modifié ses entrées").toBe(lignesAvant);
    expect(JSON.stringify(pastillesTexteTableau(lignes, { ecriture, demande }))).toBe(avant);
    expect(rapport.mode).toBe("observation");
    expect(rapport.pastilles.every((p) => p.niveau === "info")).toBe(true);
    // Rien du socle n'entre dans ce qui bloque : les codes du socle sont à part de ceux de l'écrivain.
    const codesEcrivain = new Set((JSON.parse(avant) as { code?: string }[]).map((p) => p.code));
    expect(rapport.pastilles.filter((p) => p.code && codesEcrivain.has(p.code))).toEqual([]);
  });
});
