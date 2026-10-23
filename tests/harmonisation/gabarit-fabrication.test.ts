/**
 * Harmonisation des écrans de SUIVI après « Fabriquer » (lot F0, docs/REGLES-ROUTINES.md) : socle `src/components/fabrication/`.
 * `FICHE_A_FAIRE` et `SUIVIS_A_FAIRE` ne peuvent que rétrécir : un écran conforme n'y figure plus, aucun écran n'y est ajouté.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { formatEnEssai, listerFormatsNavigation, statutNavigation } from "@/formats";
import { ACTIONS_FABRICATION, LIBELLES_ARGENT, PHRASES_SUIVI, libelleFabriquer as libelleFabriquerBrut } from "@/domaine/libelles";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const { EnTeteSuivi } = await import("@/components/fabrication/EnTeteSuivi");
const { ActionsSuivi } = await import("@/components/fabrication/ActionsSuivi");
const { ChiffresVideo } = await import("@/components/fabrication/ChiffresVideo");
const { EncartCout } = await import("@/components/fabrication/EncartCout");
const { GabaritFicheVideo } = await import("@/components/fabrication/GabaritFicheVideo");

const RACINE = process.cwd();
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8");
const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const zones = (html: string) => [...html.matchAll(/data-zone="([a-z]+)"/g)].map((m) => m[1]);
const noeud = (t: string) => createElement("p", null, t);

/** Photo de départ (F0), figée : les fiches pas encore passées dans `GabaritFicheVideo`. */
const FICHE_DEPART = ["src/app/(studio)/videos/[id]/page.tsx"];
export const FICHE_A_FAIRE: string[] = [];

/** Photo de départ (F0), figée : les suivis qui ne passent pas encore par `EnTeteSuivi` + `ActionsSuivi`. */
const SUIVIS_DEPART = [
  "src/components/facecam/AttenteFacecam.tsx",
  "src/components/videos/SuiviTravail.tsx",
  "src/components/formats/tableau-anime/EtapesTableau.tsx",
  "src/components/formats/cas-concret/fiche-video/SuiviCasConcret.tsx",
  "src/components/formats/image-video/Fabrication.tsx",
  "src/components/formats/image-video/SuiviLot.tsx",
  "src/assistant/etapes/Fabrication.tsx",
];
/** Suivis déjà passés dans le socle : une ligne par lot, séparées pour que les lots F3, F5 et F2 ne se marchent pas dessus. */
const SUIVIS_FAITS: string[] = [
  // F3 (face caméra)
  "src/components/facecam/AttenteFacecam.tsx",

  // F5 (suivi générique)
  "src/components/videos/SuiviTravail.tsx",

  // F2 (tableau)
  "src/components/formats/tableau-anime/EtapesTableau.tsx",

  // F6 (Image → vidéo, une vidéo)
  "src/components/formats/image-video/Fabrication.tsx",

  // F7 (Image → vidéo, un lot)
  "src/components/formats/image-video/SuiviLot.tsx",

  // F8 (cas concret)
  "src/components/formats/cas-concret/fiche-video/SuiviCasConcret.tsx",
];
export const SUIVIS_A_FAIRE: string[] = SUIVIS_DEPART.filter((f) => !SUIVIS_FAITS.includes(f));

/** Format actif ou en essai → composant(s) de suivi qui le montrent. Un format sans entrée est refusé. */
export const SUIVI_DU_FORMAT: Record<string, string[]> = {
  avocat: ["src/components/videos/SuiviTravail.tsx", "src/assistant/etapes/Fabrication.tsx"],
  facecam: ["src/components/facecam/AttenteFacecam.tsx"],
  "facecam-animee": ["src/components/videos/SuiviTravail.tsx"],
  "tableau-anime": ["src/components/formats/tableau-anime/EtapesTableau.tsx"],
  "cas-concret": ["src/components/formats/cas-concret/fiche-video/SuiviCasConcret.tsx"],
  "image-video": ["src/components/formats/image-video/Fabrication.tsx", "src/components/formats/image-video/SuiviLot.tsx"],
};

const ecarts = (aFaire: string[], depart: string[]) => [...aFaire.filter((x) => !depart.includes(x)), ...aFaire.filter((x, i) => aFaire.indexOf(x) !== i)];

describe("registres : ne peuvent que rétrécir", () => {
  it("FICHE_A_FAIRE et SUIVIS_A_FAIRE ne contiennent que des écrans de la photo de départ, sans doublon", () => {
    expect(ecarts(FICHE_A_FAIRE, FICHE_DEPART)).toEqual([]);
    expect(ecarts(SUIVIS_A_FAIRE, SUIVIS_DEPART)).toEqual([]);
    expect(ecarts([...SUIVIS_A_FAIRE, "src/nouveau.tsx"], SUIVIS_DEPART)).toContain("src/nouveau.tsx");
    expect(ecarts(["a", "a"], ["a"])).toEqual(["a"]);
  });

  it("les photos de départ sont figées (une PR ne peut pas y ajouter un écran) et les suivis faits en font partie", () => {
    expect(FICHE_DEPART).toHaveLength(1);
    expect(SUIVIS_DEPART).toHaveLength(7);
    expect(new Set(SUIVIS_DEPART).size).toBe(SUIVIS_DEPART.length);
    expect(SUIVIS_FAITS.filter((f) => !SUIVIS_DEPART.includes(f))).toEqual([]);
    expect(SUIVIS_FAITS.length).toBeLessThanOrEqual(SUIVIS_DEPART.length);
  });

  it("un écran de suivi conforme ne figure plus dans SUIVIS_A_FAIRE, un écran à faire n'est pas déjà conforme", () => {
    for (const f of SUIVIS_DEPART) {
      expect(existsSync(join(RACINE, f)), f).toBe(true);
      const s = lire(f);
      const conforme = /<EnTeteSuivi\b/.test(s) && /<ActionsSuivi\b/.test(s);
      expect(conforme, `${f} : conforme=${conforme} / à faire=${SUIVIS_A_FAIRE.includes(f)}`).toBe(!SUIVIS_A_FAIRE.includes(f));
    }
  });

  it("une fiche conforme ne figure plus dans FICHE_A_FAIRE", () => {
    for (const f of FICHE_DEPART) expect(/<GabaritFicheVideo\b/.test(lire(f)), f).toBe(!FICHE_A_FAIRE.includes(f));
  });
});

describe("contrat : chaque format actif ou en essai a un suivi", () => {
  const formats = listerFormatsNavigation().filter((f) => statutNavigation(f) === "actif" || formatEnEssai(f));

  it("la liste n'est pas vide", () => {
    expect(formats.length).toBeGreaterThan(0);
  });

  for (const f of formats) {
    it(`${f.id} a une entrée, ses fichiers existent et sont dans la photo des suivis`, () => {
      const fichiers = SUIVI_DU_FORMAT[f.id];
      expect(fichiers, `format sans entrée de suivi : ${f.id}`).toBeDefined();
      for (const c of fichiers) {
        expect(existsSync(join(RACINE, c)), c).toBe(true);
        expect(SUIVIS_DEPART, c).toContain(c);
      }
    });
  }
});

describe("EnTeteSuivi", () => {
  const rendre = (p: Record<string, unknown>) => texte(renderToStaticMarkup(createElement(EnTeteSuivi, p as never)));

  it("une seule phrase de titre pour tous les formats en cours", () => {
    expect(PHRASES_SUIVI["en-cours"].titre).toBe("Votre vidéo se fabrique");
    expect(rendre({ etat: "en-cours", pret: "Prête vers 14 h 20" })).toBe("Votre vidéo se fabrique Prête vers 14 h 20 · Vous pouvez fermer.");
  });

  it("sans heure : « Encore quelques minutes »", () => {
    expect(rendre({ etat: "en-cours" })).toContain("Encore quelques minutes · Vous pouvez fermer.");
  });

  it("arrêtée sur erreur : titre + message lisible", () => {
    expect(rendre({ etat: "coincee", message: "Le son n'a pas abouti." })).toBe("La fabrication s'est arrêtée Le son n'a pas abouti.");
  });

  it("arrêtée par Will : « Rien n'est perdu. »", () => {
    expect(rendre({ etat: "arretee" })).toBe("Vous avez arrêté la fabrication Rien n'est perdu.");
  });

  it("à relire et prête", () => {
    expect(rendre({ etat: "a-relire" })).toContain("Votre script attend votre relecture");
    expect(rendre({ etat: "prete" })).toContain("Votre vidéo est prête");
  });

  it("n'écrit jamais de <h1> (l'écran en a déjà un)", () => {
    for (const etat of ["en-cours", "coincee", "arretee", "a-relire", "prete"]) expect(renderToStaticMarkup(createElement(EnTeteSuivi, { etat } as never))).not.toMatch(/<h1\b/);
  });
});

describe("ActionsSuivi · ordre fixe", () => {
  const rendre = (p: Record<string, unknown>) => renderToStaticMarkup(createElement(ActionsSuivi, p as never));
  const ordre = (html: string, mots: string[]) => mots.map((m) => html.indexOf(m));

  it("pendant : Passer devant, puis Arrêter", () => {
    const html = rendre({ etat: "en-cours", passerDevant: noeud("PASSER"), arreter: noeud("ARRETER"), reprendre: noeud("REPRENDRE") });
    expect(html).toContain("PASSER");
    expect(html).toContain("ARRETER");
    expect(html).not.toContain("REPRENDRE");
    const [a, b] = ordre(html, ["PASSER", "ARRETER"]);
    expect(a).toBeLessThan(b);
  });

  it("après arrêt : Reprendre (principal), actions propres, Recommencer", () => {
    const html = rendre({ etat: "coincee", reprendre: noeud("REPRENDRE"), propres: noeud("PROPRE"), recommencer: { href: "/x", libelle: "RECOMMENCER" }, arreter: noeud("ARRETER") });
    expect(html).not.toContain("ARRETER");
    const [a, b, c] = ordre(html, ["REPRENDRE", "PROPRE", "RECOMMENCER"]);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("sans aucune action : rien du tout", () => {
    expect(rendre({ etat: "en-cours" })).toBe("");
  });

  it("vocabulaire : trois verbes, ni « Relancer » ni « Réessayer »", () => {
    expect(ACTIONS_FABRICATION.arreter).toBe("Arrêter");
    expect(ACTIONS_FABRICATION.passerDevant).toBe("Passer devant");
    expect(ACTIONS_FABRICATION.reprendreEtape).toBe("Reprendre cette étape");
    expect(ACTIONS_FABRICATION.recommencer).toBe("Recommencer");
    for (const v of Object.values(ACTIONS_FABRICATION)) expect(v).not.toMatch(/Relancer|Réessayer/);
  });
});

describe("argent : cinq façons de le dire → une", () => {
  const m = { centimes: 120, devise: "EUR" } as const;

  it("EncartCout : les quatre libellés", () => {
    expect(LIBELLES_ARGENT).toEqual({ estime: "Coût estimé", auPlus: "Au plus", dejaPaye: "Déjà payé", essai: "Essai, pas payé" });
    expect(texte(renderToStaticMarkup(createElement(EncartCout, { nature: "estime", montant: m })))).toMatch(/Coût estimé.*1,20/);
    expect(texte(renderToStaticMarkup(createElement(EncartCout, { nature: "auPlus", montant: m })))).toMatch(/Au plus.*1,20/);
    expect(texte(renderToStaticMarkup(createElement(EncartCout, { nature: "dejaPaye", montant: m })))).toMatch(/Déjà payé.*1,20/);
    expect(texte(renderToStaticMarkup(createElement(EncartCout, { nature: "essai" })))).toContain("Essai, pas payé");
  });

  it("aucun « € » rendu quand le format est sans prix", () => {
    for (const nature of ["estime", "auPlus", "dejaPaye", "essai"]) {
      const html = renderToStaticMarkup(createElement(EncartCout, { nature, montant: m, sansPrix: true } as never));
      expect(html).toBe("");
    }
    expect(libelleFabriquerBrut({ montant: m, dureeSec: 45, n: 3, sansPrix: true, essai: false })).not.toMatch(/€|\d,\d/);
    const html = renderToStaticMarkup(createElement(ChiffresVideo, { chiffres: [{ libelle: "Durée", valeur: "45 s", icone: "horloge" }] }));
    expect(html).not.toContain("€");
  });

  it("libelleFabriquer", () => {
    const libelleFabriquer = (p: Parameters<typeof libelleFabriquerBrut>[0]) => libelleFabriquerBrut(p).replace(/\s/g, " ");
    expect(libelleFabriquer({ sansPrix: true, essai: false })).toBe("Fabriquer");
    expect(libelleFabriquer({ montant: m, sansPrix: false, essai: false })).toBe("Fabriquer · 1,20 €");
    expect(libelleFabriquer({ montant: m, n: 3, sansPrix: false, essai: false })).toBe("Fabriquer 3 vidéos · 1,20 €");
    expect(libelleFabriquer({ montant: m, dureeSec: 90, sansPrix: false, essai: true })).toBe("Fabriquer · 2 min · 1,20 € (essai)");
  });
});

describe("ChiffresVideo", () => {
  it("3 chiffres sur trois colonnes, 4 sur deux ; l'essai porte sa pastille", () => {
    const c = (n: number, essai = false) => Array.from({ length: n }, (_, i) => ({ libelle: `L${i}`, valeur: `${i}`, icone: "horloge" as const, essai: essai && i === 0 }));
    expect(renderToStaticMarkup(createElement(ChiffresVideo, { chiffres: c(3) }))).toContain("grid-cols-3");
    expect(renderToStaticMarkup(createElement(ChiffresVideo, { chiffres: c(4) }))).toContain("grid-cols-2");
    expect(texte(renderToStaticMarkup(createElement(ChiffresVideo, { chiffres: c(3, true) })))).toContain("Essai");
  });
});

describe("GabaritFicheVideo · zones dans l'ordre", () => {
  const toutes = Object.fromEntries(["retour", "bandeau", "entete", "etapes", "lecteur", "essai", "chiffres", "suivi", "specifique", "onglets", "action"].map((k) => [k, noeud(k)]));

  it("racine data-gabarit=fiche-video et ordre complet", () => {
    const html = renderToStaticMarkup(createElement(GabaritFicheVideo, toutes as never));
    expect(html).toContain('data-gabarit="fiche-video"');
    expect(zones(html)).toEqual(["retour", "bandeau", "entete", "etapes", "lecteur", "essai", "chiffres", "suivi", "specifique", "onglets", "action"]);
  });

  it("deuxColonnes : retour + bandeau, lecteur, puis les autres zones dans l'ordre du gabarit", () => {
    const html = renderToStaticMarkup(createElement(GabaritFicheVideo, { ...toutes, deuxColonnes: true } as never));
    expect(zones(html)).toEqual(["retour", "bandeau", "lecteur", "entete", "etapes", "essai", "chiffres", "suivi", "specifique", "onglets", "action"]);
  });

  it("zones facultatives absentes : on ne rend que les présentes", () => {
    const html = renderToStaticMarkup(createElement(GabaritFicheVideo, { entete: noeud("e"), lecteur: noeud("l"), chiffres: noeud("c"), specifique: noeud("s") } as never));
    expect(zones(html)).toEqual(["entete", "lecteur", "chiffres", "specifique"]);
  });
});
