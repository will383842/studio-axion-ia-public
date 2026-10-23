/**
 * FACE CAMÉRA ANIMÉE v4 — VARIÉTÉ des plaquettes (19/10/2026) : la consigne ne pousse plus « EtiquetteTete » par défaut, chaque fiche porte
 * son plafond, l'historique v4 est lu. Aucun appel réseau.
 */
import { describe, expect, it } from "vitest";
import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";
import { CATALOGUE_V4, elementsV4Actifs, plafondParVideoV4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import { blocHistoriqueV4, consigneRealisateur } from "@/moteurs/montage-facecam-animee/realisateur/consignes";
import { historiqueV4 } from "@/moteurs/montage-facecam-animee/realisateur/historique-v4";
import { historiqueDuPlan, type HistoriqueVideo } from "@/moteurs/montage-facecam-animee/realisateur/regles";

const BASE = { cartes: [], fenetres: [], calques: [] };

describe("variété v4 · consigne", () => {
  it("le plafond n'est plus écrit « 3 fois au plus » en dur ; la consigne demande d'utiliser d'abord les plaquettes pas encore utilisées", () => {
    const c = consigneRealisateur([]);
    expect(c).not.toContain("3 fois au plus par vidéo");
    expect(c).toContain("pas encore utilisées");
    expect(c).toContain("UNE fois");
  });
  it("« EtiquetteTete » n'est plus le premier choix de la table « ce que Will dit » : elle y est en dernier, sous condition", () => {
    const c = consigneRealisateur([]);
    const table = c.slice(c.indexOf("Lisez la phrase, nommez"), c.indexOf("Une vidéo montre CE QUI EST DIT"));
    const lignes = table.split("\n").filter((l) => l.startsWith("- "));
    expect(lignes[0]).not.toContain("EtiquetteTete");
    expect(lignes[lignes.length - 1]).toContain("EtiquetteTete");
    expect(lignes[lignes.length - 1]).toContain("seulement si aucune autre plaquette ne montre la chose");
  });
  it("l'exemple de V6 ne commence pas par « tete » et fait dominer la carte", () => {
    const c = consigneRealisateur([]);
    const exemple = /V6 [^\n]*Alternez, par exemple : ([^\n]+)/.exec(c)![1];
    expect(exemple.startsWith("tete")).toBe(false);
    const suite = exemple.replace(/…$/, "").split("→").map((s) => s.trim());
    expect(suite.filter((s) => s === "carte").length).toBeGreaterThan(suite.filter((s) => s === "tete").length);
  });
});

describe("variété v4 · historique v4", () => {
  const el = (id: string, debut: number): ElementV4Plan => ({ id, debut, fin: debut + 2, illustre: "x" });
  it("historiqueV4 : ids dans l'ordre d'apparition (répétitions comprises) et ouverture", () => {
    const h = historiqueV4([el("CarteCalendrier", 6), el("EtiquetteTete", 0), el("EtiquetteTete", 9)]);
    expect(h).toEqual({ plaquettesV4: ["EtiquetteTete", "CarteCalendrier", "EtiquetteTete"], ouvertureV4: "EtiquetteTete" });
    expect(historiqueV4(undefined)).toEqual({ plaquettesV4: [] });
  });
  it("historiqueDuPlan porte les plaquettes v4 du plan", () => {
    const h = historiqueDuPlan({ ...BASE, elementsV4: [el("MotSaute", 0)] } as never);
    expect(h.plaquettesV4).toEqual(["MotSaute"]);
    expect(h.ouvertureV4).toBe("MotSaute");
  });
  it("EtiquetteTete 12 fois : le bloc la cite « EtiquetteTete (12) », met JaugePourcentage dans « Jamais prises » (avec la réserve de littéralité), interdit la même ouverture", () => {
    const vid: HistoriqueVideo = { types: [], entrees: [], plaquettesV4: [...Array(12).fill("EtiquetteTete"), "CarteCalendrier"], ouvertureV4: "EtiquetteTete" };
    const b = blocHistoriqueV4([vid]);
    expect(b).toContain("Plaquettes déjà prises dans les 5 dernières vidéos : EtiquetteTete (12)");
    const jamais = b.split("\n").find((l) => l.startsWith("Jamais prises"))!;
    expect(jamais).toContain("JaugePourcentage");
    expect(jamais).toContain("seulement si elle montre littéralement ce que Will dit");
    expect(jamais.split(". Partez")[0]).not.toContain("EtiquetteTete");
    expect(jamais.split(". Partez")[0]).not.toContain("CarteCalendrier");
    expect(b).toContain("N'ouvrez pas par EtiquetteTete");
  });
  it("jamais une plaquette « en coulisse » ni une plaquette interdite du repli sans vidéo dans « Jamais prises » ; rien sans historique v4", () => {
    const h = [{ types: [], entrees: [], plaquettesV4: ["EtiquetteTete"] }];
    const jamais = blocHistoriqueV4(h, ["AvantApres", "MosaiqueVideos", "duel-video"]).split("\n").find((l) => l.startsWith("Jamais prises"))!.split(". Partez")[0];
    for (const id of ["LogoOutil", "Equation", "panneau-fin", "AvantApres", "MosaiqueVideos", "duel-video"]) expect(jamais).not.toContain(id);
    expect(blocHistoriqueV4([{ types: [], entrees: [] }])).toBe("");
    expect(blocHistoriqueV4([])).toBe("");
  });
  it("la consigne système ne porte PAS l'historique v4 (identique d'une vidéo à l'autre, cache conservé) ; un historique v4 seul n'ajoute ni lignes « Vidéo n » ni règles R7", () => {
    const vid: HistoriqueVideo = { types: [], entrees: [], plaquettesV4: ["EtiquetteTete"], ouvertureV4: "EtiquetteTete" };
    const c = consigneRealisateur([vid]);
    expect(c).not.toContain("Jamais prises");
    expect(c).not.toContain("- Vidéo 1");
    expect(c).not.toContain("R7e");
    expect(consigneRealisateur([vid])).toBe(consigneRealisateur([{ ...vid, plaquettesV4: ["MotSaute"] }]));
  });
});

describe("variété v4 · plafonds par fiche", () => {
  it("2 par vidéo de 90 s partout, sauf 7 fiches à 3 : PileNotifications, dalle-claquee, BadgeProfil, CarteCommande et les 3 fenêtres sans vidéo", () => {
    const trois = elementsV4Actifs().filter((f) => f.maxParVideo === 3).map((f) => f.id).sort();
    expect(trois).toEqual(["BadgeProfil", "CarrouselFeuillete", "CarteCommande", "FenetreDouble", "FenetreTelephone", "PileNotifications", "dalle-claquee"]);
    expect(CATALOGUE_V4.filter((f) => f.maxParVideo !== 3).every((f) => f.maxParVideo === 2)).toBe(true);
    expect(CATALOGUE_V4.find((f) => f.id === "AvantApres")!.maxParVideo).toBe(2);
  });
  it("le plafond est ramené à la durée (comme les familles) : 2 pour 90 s, plus pour une prise longue, jamais sous 2", () => {
    const tete = CATALOGUE_V4.find((f) => f.id === "EtiquetteTete")!;
    const pile = CATALOGUE_V4.find((f) => f.id === "PileNotifications")!;
    expect(plafondParVideoV4(tete, 82.667)).toBe(2);
    expect(plafondParVideoV4(tete, 90)).toBe(2);
    expect(plafondParVideoV4(tete, 130)).toBe(3);
    expect(plafondParVideoV4(tete, 180)).toBe(4);
    expect(plafondParVideoV4(tete, 40)).toBe(2);
    expect(plafondParVideoV4(pile, 130)).toBe(4);
    expect(plafondParVideoV4(pile, 40)).toBe(2);
  });
});
