import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import { cadeauDeLOffre } from "@/formats/cas-concret";
import { OFFRES } from "@/formats/cas-concret/cas";
import { DOCUMENT_PAR_SORTE, sorteDe } from "@/moteurs/montage-cas-concret/description";
import { idCasAjoute, objetParDefaut, preparerCasAjoute, ressemblances, titreParDefaut } from "@/moteurs/montage-cas-concret/cas-ajoutes";
import { problemesDuCas } from "@/moteurs/montage-cas-concret/regles";
import { FORMULAIRE_MINIMAL } from "./formulaires";

const AUTRES = CATALOGUE;
const prep = (plus: Record<string, unknown> = {}, autres = AUTRES) => preparerCasAjoute({ ...FORMULAIRE_MINIMAL, ...plus }, { id: "ajout-essai-ab12", autres });

describe("cas ajouté · construction", () => {
  it("un formulaire minimal donne un cas valide", () => {
    const r = prep();
    expect(r.ok ? [] : r.raisons).toEqual([]);
  });

  it.each(OFFRES)("offre %s : document promis = cadeau de l'offre, aucun problème de cas", (offre) => {
    const r = prep({ offre, ...(offre === "integration" ? {} : { nature: undefined }) });
    expect(r.ok ? [] : r.raisons).toEqual([]);
    if (!r.ok) return;
    const c = r.cas;
    expect(c.posture).toBe("offre");
    expect(c.faits).toEqual([]);
    expect(c.valideParWill).toBeUndefined();
    expect(c.documentPromis.finCadeauId).toBe(cadeauDeLOffre(offre, c.nature));
    expect(c.documentPromis.nom).toBe(DOCUMENT_PAR_SORTE[sorteDe({ offre, nature: c.nature })]);
    expect(c.etapes.every((e) => e.visuel.sorte === "objet")).toBe(true);
    expect(problemesDuCas(c)).toEqual([]);
  });
});

const refus = (plus: Record<string, unknown>, autres = AUTRES): string[] => {
  const r = prep(plus, autres);
  return r.ok ? [] : r.raisons;
};

describe("cas ajouté · refus en phrases (une règle, un test)", () => {
  it("un nombre dans un texte", () => {
    expect(refus({ resultat: "Vos devis sont suivis en 3 jours." }).join("|")).toMatch(/Résultat : contient un nombre/);
  });
  it("un nom propre", () => {
    expect(refus({ scene: "Le devis est parti chez Dupont depuis longtemps, et personne n'a pensé à demander la réponse." }).join("|")).toMatch(/Scène : contient un nom propre/);
  });
  it("« nous », « notre », « je », « j' »", () => {
    expect(refus({ resultat: "Nous suivons vos devis." }).join("|")).toMatch(/première personne/);
    expect(refus({ cible: "Un dirigeant, notre cible habituelle." }).join("|")).toMatch(/Pour qui : parle à la première personne/);
    expect(refus({ scene: "J'envoie le devis et personne ne demande la réponse, depuis longtemps." }).join("|")).toMatch(/première personne/);
  });
  it("tutoiement", () => {
    expect(refus({ resultat: "Tes devis sont suivis." }).join("|")).toMatch(/tutoie/);
  });
  it("« Grenoble » et « aucun gain garanti »", () => {
    expect(refus({ cible: "Un dirigeant de Grenoble qui oublie ses relances." }).join("|")).toMatch(/Grenoble/);
    expect(refus({ resultat: "Aucun gain garanti mais des devis suivis." }).join("|")).toMatch(/aucun gain garanti/i);
  });
  it("tournure d'usage réel", () => {
    expect(refus({ scene: "On utilise un outil depuis longtemps, mais personne n'a pensé à demander la réponse du devis." }).join("|")).toMatch(/Scène : « on utilise » laisse croire à un usage réel/);
    expect(refus({ scene: "Chez un client, le devis est parti depuis longtemps et personne n'a demandé la réponse." }).join("|")).toMatch(/Scène : raconte un client réel/);
  });
  it("thème déjà pris, mot déjà pris, sujet déjà pris", () => {
    const pris = CATALOGUE.find((c) => c.theme)!;
    expect(refus({ theme: pris.theme!.toUpperCase() }).join("|")).toMatch(/Thème : .* déjà celui d'un autre cas/);
    expect(refus({ mot: CATALOGUE[0].mot.toLowerCase() }).join("|")).toMatch(/Mot à commenter/);
    const avecRecit = CATALOGUE.find((c) => c.recit)!;
    expect(refus({ sujet: avecRecit.recit!.sujet }).join("|")).toMatch(/Sujet : un autre cas/);
  });
  it("un champ inconnu est refusé", () => {
    expect(refus({ valideParWill: { le: "2026-10-24", source: "x" } }).join("|")).toMatch(/champ inconnu/);
  });
  it("limites de mots : promesse, thème, tâche, reste humain, résultat, sigle", () => {
    expect(refus({ promesse: "Vos devis sont relancés sans oubli par un outil très simple." }).join("|")).toMatch(/Promesse : .*8 mots/);
    expect(refus({ promesse: "Vos devis sont relancés sans oubli" }).join("|")).toMatch(/Promesse : finissez-la par un point/);
    expect(refus({ theme: "Devis relancés vite" }).join("|")).toMatch(/Thème : 1 ou 2 mots/);
    expect(refus({ taches: ["Noter chaque devis envoyé un par un à la main", "Relancer"] }).join("|")).toMatch(/Tâche 1 : \d+ mots, 6 au plus/);
    expect(refus({ resteHumain: "Décider de la suite à donner à chaque devis envoyé par le dirigeant seul." }).join("|")).toMatch(/Ce qui reste humain : \d+ mots, 11 au plus/);
    expect(refus({ resteHumain: "Choisir le CRM à relier." }).join("|")).toMatch(/sans sigle/);
    expect(refus({ resultat: "Vos devis sont suivis de près et les réponses arrivent bien plus vite qu'avant." }).join("|")).toMatch(/Résultat : \d+ mots, 13 au plus/);
  });
  it("de 3 à 7 étapes, partie humaine après une étape qui existe", () => {
    expect(refus({ etapes: FORMULAIRE_MINIMAL.etapes.slice(0, 2) }).join("|")).toMatch(/au moins 3 étapes/);
    expect(refus({ resteHumainApresEtape: 6 }).join("|")).toMatch(/n'en a que 4/);
  });
  it("aucun refus ne corrige le texte en silence : le cas garde les textes de Will", () => {
    const r = prep();
    expect(r.ok && r.cas.titre).toBe(FORMULAIRE_MINIMAL.titre);
    expect(r.ok && r.cas.etapes.map((e) => e.ligne)).toEqual(FORMULAIRE_MINIMAL.etapes.map((e) => e.ligne));
  });
});

describe("cas ajouté · valeurs par défaut et identifiant", () => {
  it("objetParDefaut", () => {
    expect(objetParDefaut("Un e-mail part au client.")).toBe("e-mail");
    expect(objetParDefaut("Un rappel part la veille.")).toBe("telephone-notification");
    expect(objetParDefaut("Le créneau est réservé.")).toBe("calendrier");
    expect(objetParDefaut("Le rapport est prêt.")).toBe("rapport");
    expect(objetParDefaut("Le dossier est rangé.")).toBe("dossier-classe");
    expect(objetParDefaut("Le contrat est signé.")).toBe("contrat-signature");
    expect(objetParDefaut("Le délai est respecté.")).toBe("chrono");
    expect(objetParDefaut("Le programme est construit.")).toBe("programme");
    expect(objetParDefaut("Les outils sont reliés.")).toBe("outils-relies");
    expect(objetParDefaut("Le contrôle est fait.")).toBe("bouclier-coche");
    expect(objetParDefaut("Autre chose.")).toBe("carte-taches");
  });
  it("titreParDefaut : trois mots au plus", () => {
    expect(titreParDefaut("Chaque devis envoyé est noté tout seul.").split(" ").length).toBeLessThanOrEqual(3);
  });
  it("les visuels sont tous des objets, les mots clés viennent du sujet", () => {
    const r = prep();
    if (!r.ok) throw new Error(r.raisons.join("|"));
    expect(r.cas.etapes.map((e) => e.visuel.sorte)).toEqual(["objet", "objet", "objet", "objet"]);
    expect(r.cas.recit!.motsCles.length).toBeGreaterThanOrEqual(2);
  });
  it("identifiant : préfixe réservé, conforme au schéma, stable pour un tirage donné, unique parmi les existants", () => {
    const id = idCasAjoute("Devis relancés", [], () => 0.5);
    expect(id).toMatch(/^ajout-[a-z0-9-]+-[a-z0-9]{4}$/);
    expect(/^[a-z][a-z0-9-]{1,47}$/.test(id)).toBe(true);
    expect(idCasAjoute("Devis relancés", [], () => 0.5)).toBe(id);
    const tirages = [0.5, 0.5, 0.25];
    expect(idCasAjoute("Devis relancés", [id], () => tirages.shift() ?? 0.1)).not.toBe(id);
    expect(idCasAjoute("", [], () => 0.1)).toMatch(/^ajout-cas-/);
  });
  it("anti-doublon : avertit sans bloquer", () => {
    const voisin = CATALOGUE.find((c) => c.recit)!;
    const f = { titre: voisin.titre, promesse: voisin.promesse, sujet: voisin.recit!.sujet };
    expect(ressemblances(f, CATALOGUE).map((x) => x.id)).toContain(voisin.id);
    expect(ressemblances({ titre: "Zzz", promesse: "Yyy.", sujet: "Xxx" }, CATALOGUE)).toEqual([]);
  });
});
