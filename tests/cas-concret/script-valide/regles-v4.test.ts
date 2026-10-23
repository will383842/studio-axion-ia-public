/**
 * V4-3 · LES RÈGLES ACCEPTENT LA V4 VALIDÉE PAR WILL. Le script validé passe par les mêmes contrôles que l'écriture ; la
 * v4 en était refusée (dérogations de la fiche témoin). Chaque règle ajustée l'est sur ce que montre la v4, et garde son
 * refus au-delà :
 *  - R03 : la promesse peut finir sur l'écran qui suit l'accroche (« en… » puis « quinze minutes », plans s1 et s2),
 *    dans les 8 premiers mots dits, finie avant 3 s ;
 *  - R05 : une liste « avant » (tâches qui entrent une à une, R06) dure jusqu'à 12 s (la v4 : 9,2 s) ; les autres 5 s ;
 *  - R07 : trois écrans de suite sur le même fond (s11, s12, s13 de la v4), jamais quatre ;
 *  - R08 : les textes portés par un objet (notification, pastille) ont la longueur d'une ligne ;
 *  - R14 : « +1 H » : l'unité « H » après un nombre n'est pas un nom propre ;
 *  - liste « avant » : 6 tâches sur un écran (le plan s4), jamais 7 ; la brique ne change pas jusqu'à 4 tâches.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { boites, charteDuoPour, TYPES_ECRAN, zoneUtile } from "@/briques/ecrans-motion";
import { schemaListeAvant, type EcranCorps, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { nomsPropres, regleAccroche, regleDureeEcran, regleFondsAlternes, regleTextesCourts } from "@/moteurs/montage-cas-concret/regles";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { texteDuCorps } from "@/moteurs/montage-cas-concret/fiche";

const cas = trouverCas("recrutement-apporteurs")!;
const COMMUN = { marque: "axion-ia.com", avanceMs: 0, evenements: [] };
type SansCommun = EcranCorps extends infer E ? (E extends unknown ? Omit<E, "id" | "marque" | "avanceMs" | "evenements"> : never) : never;
const fiche = (ecrans: SansCommun[]): FicheEcrans =>
  ({ version: "fiche-ecrans/1", formatId: "cas-concret", videoId: "v", versionId: "v", habillage: "charte-duo/1", ratio: "9:16", offre: "integration", origine: "porte-a", posture: "chez-nous", casId: cas.id, empreinteCas: "x", ecrans: ecrans.map((e, i) => ({ ...COMMUN, ...e, id: `e${String(i + 1).padStart(2, "0")}` })) }) as unknown as FicheEcrans;
const ctx = (f: FicheEcrans) => ({ cas, texteScript: texteDuCorps(f) });
const titre = (texteDit: string, fond: "sombre" | "ivoire" = "sombre") => ({ type: "titre" as const, fond, texteDit, lignes: ["Titre"] });

describe("R03 · la promesse peut finir sur l'écran du chiffre (v4, s1 puis s2)", () => {
  const accroche = { type: "accroche" as const, fond: "sombre" as const, texteDit: "On recrute nos collaborateurs en", etiquette: "Recrutement", lignes: ["On recrute", "nos collaborateurs", "*en…*"], motOrange: "en…" };
  it("acceptée quand la promesse est entière dans les 8 premiers mots dits", () => {
    const f = fiche([accroche, { type: "chiffre", fond: "sombre", texteDit: "quinze minutes. Oui, quinze minutes.", valeur: 15, unite: "minutes", faitId: "visio-quinze-minutes", pastilles: [], variante: "simple" }]);
    expect(regleAccroche(f, ctx(f))).toEqual([]);
  });
  it("refusée quand la promesse arrive plus loin", () => {
    const f = fiche([accroche, titre("Oui, vraiment, on recrute tous nos collaborateurs en quinze minutes.")]);
    expect(regleAccroche(f, ctx(f)).map((m) => m.detail).join(" ")).toContain("ne dit pas la promesse");
  });
});

describe("R05 · une liste « avant » jusqu'à 12 s", () => {
  const liste = (n: number) => ({ type: "liste-avant" as const, fond: "ivoire" as const, texteDit: Array.from({ length: n }, () => "mot").join(" "), taches: ["Une", "Deux"] });
  it("26 mots (7,6 s estimées, la v4 : 9,2 s) : acceptée", () => {
    expect(regleDureeEcran(fiche([liste(26)]), ctx(fiche([liste(26)])))).toEqual([]);
  });
  it("44 mots (12,9 s) : refusée ; un titre de 6 s reste refusé", () => {
    expect(regleDureeEcran(fiche([liste(44)]), ctx(fiche([liste(44)])))[0]?.detail).toContain("12 s au plus");
    const f = fiche([titre(Array.from({ length: 21 }, () => "mot").join(" "))]);
    expect(regleDureeEcran(f, ctx(f))[0]?.detail).toContain("5 s au plus");
  });
});

describe("R07 · trois écrans de suite sur le même fond (v4 : s11, s12, s13), jamais quatre", () => {
  it("trois : accepté ; quatre : refusé", () => {
    expect(regleFondsAlternes(fiche([titre("a b c d"), titre("a b c d"), titre("a b c d"), titre("a b c d", "ivoire")]))).toEqual([]);
    expect(regleFondsAlternes(fiche([titre("a b c d"), titre("a b c d"), titre("a b c d"), titre("a b c d")]))).toEqual([{ ecranId: "e04", detail: "quatrième écran de suite sur fond sombre ; les fonds alternent." }]);
  });
});

describe("R08 · textes portés par un objet : longueur d'une ligne", () => {
  it("la notification de la v4 et ses pastilles passent ; une puce d'étape de 4 mots reste refusée", () => {
    const f = fiche([
      { type: "objet", fond: "sombre", texteDit: "oublie, le rappel part tout seul.", titre: "Elle *oublie ?*", ligne: "Le rappel part tout seul.", visuel: { sorte: "objet", objet: "telephone-notification", textes: ["Rappel : notre échange demain à 14:00"] } },
      { type: "chiffre", fond: "sombre", texteDit: "quinze minutes.", valeur: 15, unite: "minutes", faitId: "visio-quinze-minutes", pastilles: ["0 CV à trier"], variante: "simple" },
      { type: "etape", fond: "ivoire", texteDit: "un deux trois quatre", numero: 1, total: 3, titre: "Le titre", ligne: "La ligne", visuel: { sorte: "objet", objet: "chrono" }, puces: ["Une puce trop longue"] },
    ]);
    expect(regleTextesCourts(f).map((m) => m.ecranId)).toEqual(["e03"]);
  });
});

describe("R14 · « +1 H » n'est pas un nom propre", () => {
  it("l'unité après un nombre passe ; un vrai nom propre reste relevé", () => {
    expect(nomsPropres("+1 H")).toEqual([]);
    expect(nomsPropres("Plus de 2 H par jour")).toEqual([]);
    expect(nomsPropres("On recrute à Paris")).toEqual(["Paris"]);
  });
});

describe("Liste « avant » : 6 tâches sur un écran (plan s4)", () => {
  const base = { id: "e03", marque: "axion-ia.com", fond: "ivoire", texteDit: "Avant, c'était ça", avanceMs: 0, evenements: [], type: "liste-avant" };
  const taches = ["Trier les candidatures", "Répondre à chacun", "Relancer", "Caler un rendez-vous", "Envoyer le contrat", "Courir après la signature"];
  it("6 acceptées, 7 refusées", () => {
    expect(schemaListeAvant.safeParse({ ...base, taches }).success).toBe(true);
    expect(schemaListeAvant.safeParse({ ...base, taches: [...taches, "Classer"] }).success).toBe(false);
  });

  it("la brique pose 6 rangs, de la hauteur des rangs de la v4 (112 px sur la fiche de 720 px)", () => {
    const zone = zoneUtile({ haut: 0, droite: 0, bas: 0, gauche: 0 }, 1080, 1920);
    const b = boites("liste-avant", zone, charteDuoPour(1920), { taches: 6 });
    expect(b.textes.map((t) => t.nom).filter((n) => n.startsWith("tache-"))).toEqual(["tache-1", "tache-2", "tache-3", "tache-4", "tache-5", "tache-6"]);
    const rangs = b.textes.filter((t) => t.nom.startsWith("tache-"));
    const liste = b.objets.find((o) => o.nom === "liste")!.boite;
    // Six rangs dans la fiche, de même hauteur (la v4 : 6 × 112 px dans 720 px).
    expect(rangs.every((r) => r.boite.y >= liste.y - 0.01 && r.boite.y + r.boite.hauteur <= liste.y + liste.hauteur + 0.01)).toBe(true);
  });

  /** Empreintes des boîtes des 12 types relevées AVANT le changement (2, 3, 4 tâches et par défaut) : rien ne bouge. */
  const AVANT: Record<string, string> = {"accroche/-":"f7aecd240ff54c26","accroche/2":"f7aecd240ff54c26","accroche/3":"f7aecd240ff54c26","accroche/4":"f7aecd240ff54c26","chiffre/-":"36aaf57ce2ec4ed0","chiffre/2":"36aaf57ce2ec4ed0","chiffre/3":"36aaf57ce2ec4ed0","chiffre/4":"36aaf57ce2ec4ed0","liste-avant/-":"2abc6dc8a0eb3b0f","liste-avant/2":"79610d4edd278e54","liste-avant/3":"abf7c46dc8ef1014","liste-avant/4":"2abc6dc8a0eb3b0f","titre/-":"2b85cf6078bd0b59","titre/2":"2b85cf6078bd0b59","titre/3":"2b85cf6078bd0b59","titre/4":"2b85cf6078bd0b59","etape/-":"bd4105620e611042","etape/2":"bd4105620e611042","etape/3":"bd4105620e611042","etape/4":"bd4105620e611042","objet/-":"da2958f876e032ac","objet/2":"da2958f876e032ac","objet/3":"da2958f876e032ac","objet/4":"da2958f876e032ac","preuve/-":"bb8e95c55772a127","preuve/2":"bb8e95c55772a127","preuve/3":"bb8e95c55772a127","preuve/4":"bb8e95c55772a127","resultat/-":"25510efc510f1821","resultat/2":"25510efc510f1821","resultat/3":"25510efc510f1821","resultat/4":"25510efc510f1821","question/-":"bdbb5aae951abe37","question/2":"bdbb5aae951abe37","question/3":"bdbb5aae951abe37","question/4":"bdbb5aae951abe37","appel-mot/-":"2281b9fecaaa40ce","appel-mot/2":"2281b9fecaaa40ce","appel-mot/3":"2281b9fecaaa40ce","appel-mot/4":"2281b9fecaaa40ce","promesse/-":"488484806e2b3b20","promesse/2":"488484806e2b3b20","promesse/3":"488484806e2b3b20","promesse/4":"488484806e2b3b20","lien/-":"9b53c7e72fcf6c01","lien/2":"9b53c7e72fcf6c01","lien/3":"9b53c7e72fcf6c01","lien/4":"9b53c7e72fcf6c01"};
  it("jusqu'à 4 tâches, les boîtes des 12 types sont celles d'avant (les autres formats ne changent pas)", () => {
    const zone = zoneUtile({ haut: 0, droite: 0, bas: 0, gauche: 0 }, 1080, 1920);
    const charte = charteDuoPour(1920);
    const maintenant: Record<string, string> = {};
    for (const type of TYPES_ECRAN) for (const taches of [undefined, 2, 3, 4]) maintenant[`${type}/${taches ?? "-"}`] = createHash("sha256").update(JSON.stringify(boites(type, zone, charte, taches === undefined ? {} : { taches }))).digest("hex").slice(0, 16);
    expect(maintenant).toEqual(AVANT);
  });
});
