/**
 * P2C · Raccords de l'écran fourni (lot B, #155) : la chaîne lit les images déposées par Will, ne demande aucune capture
 * pour ces étapes et garde l'image masquée (un écran fourni sans demande de capture est toléré) ; la feuille « Votre
 * vidéo » propose « Fournir cet écran » pour une étape dont l'écran est derrière une connexion. Doubles seulement.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContenuVotreVideo } from "@/components/formats/cas-concret/entree/FeuilleVotreVideo";
import { versVueCas } from "@/components/formats/cas-concret/entree/vue";
import { ecranDerriereConnexion } from "@/formats/cas-concret/cas";
import { CATALOGUE, trouverCas } from "@/formats/cas-concret/catalogue";
import type { EcranFourni } from "@/moteurs/montage-cas-concret/captures";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { doubles } from "../fabriquer/doubles";
import { casConsole, ETAPE_CONSOLE, ID_CAS_CONSOLE } from "./cas-console";

const CAS = "recrutement-apporteurs";
/** Étape 4 du cas (« Le rendez-vous ») : écran réel, page `/fr/appel`. */
const ETAPE = 4;
const FOURNI: EcranFourni = { etapeCas: ETAPE, cle: "studio/dev/entree/rendez-vous.png", mime: "image/png", masques: [{ x: 0.1, y: 0.1, largeur: 0.3, hauteur: 0.1 }], attesteLe: "2026-10-13T08:00:00.000Z" };

describe("P2C · la chaîne lit les écrans fournis", () => {
  it("aucune capture pour l'étape fournie, l'image masquée est montrée, la fabrication va au bout", async () => {
    expect(trouverCas(CAS)!.etapes[ETAPE - 1].visuel.sorte).toBe("ecran");
    const temoin = doubles({ casId: CAS });
    await fabriquerCasConcret(temoin.options);
    const pagesTemoin = temoin.captures.map((c) => c.page);
    expect(pagesTemoin).toContain("https://axion-ia.com/fr/appel");

    const d = doubles({ casId: CAS });
    d.options.outils.contexte = { ...d.options.outils.contexte, ecransFournis: [FOURNI] };
    const cr = await fabriquerCasConcret(d.options);
    expect(d.captures.map((c) => c.page)).not.toContain("https://axion-ia.com/fr/appel");
    expect(d.captures.length).toBe(temoin.captures.length - 1);
    // L'écran de l'étape montre l'image fournie (sa clé, signée pour le rendu), jamais son repli.
    const avecImage = d.ecransSoumis().filter((s) => JSON.stringify(s.parametres).includes("rendez-vous.png"));
    expect(avecImage.length).toBeGreaterThan(0);
    expect(cr.journalCaptures.join(" ")).not.toMatch(/étape 4\)/);
    expect(cr.fins.length).toBeGreaterThan(0);
  });

  it("une image sans l'attestation n'est pas utilisée : la capture du site reprend sa place", async () => {
    const d = doubles({ casId: CAS });
    const { attesteLe: _a, ...sans } = FOURNI;
    void _a;
    d.options.outils.contexte = { ...d.options.outils.contexte, ecransFournis: [sans] };
    await fabriquerCasConcret(d.options);
    expect(d.captures.map((c) => c.page)).toContain("https://axion-ia.com/fr/appel");
  });
});

describe("P2C · « Fournir cet écran » sur la feuille", () => {
  it("une étape derrière une connexion (la console) est reconnue ; une page publique ne l'est pas", () => {
    const formation = casConsole();
    const i = formation.etapes.findIndex((e) => e.titre === "La session");
    expect(ecranDerriereConnexion(formation.etapes[i])).toBe(true);
    expect(trouverCas(CAS)!.etapes.some(ecranDerriereConnexion)).toBe(false);
    expect(i).toBe(ETAPE_CONSOLE - 1);
    // Une étape sans écran réel n'est jamais à fournir, même si elle parle de la console.
    expect(ecranDerriereConnexion({ titre: "La console", ligne: "On ouvre la console.", detail: "Connectée.", visuel: { sorte: "objet", objet: "calendrier" } })).toBe(false);
    // Accents et pluriels : « connectées » compte, « déconnexions » ne compte pas comme un autre mot.
    expect(ecranDerriereConnexion({ titre: "Les comptes", ligne: "Les personnes connectées.", detail: "x", visuel: formation.etapes[i].visuel })).toBe(true);
  });

  it("le lien n'apparaît que pour ces étapes, et mène à la page de l'écran fourni du cas", () => {
    const rendre = (vue: ReturnType<typeof versVueCas>) =>
      renderToStaticMarkup(createElement(ContenuVotreVideo, { cas: vue, essai: false, reseaux: ["facebook"], onReseaux: () => undefined, mot: vue.mot, onMot: () => undefined, avecMot: false, onAvecMot: () => undefined, onValider: () => undefined }));
    const formation = casConsole();
    const vue = versVueCas(formation, "e", true, undefined, true);
    expect(vue.ecransAFournir).toEqual([formation.etapes.findIndex((e) => e.titre === "La session") + 1]);
    const html = rendre(vue);
    expect(html.match(/Fournir cet écran/g)).toHaveLength(1);
    expect(html).toContain(`href="/cas-concret/ecran-fourni/${ID_CAS_CONSOLE}"`);
    // Les autres cas du catalogue : aucun lien.
    for (const c of CATALOGUE.filter((c) => c.id !== ID_CAS_CONSOLE && !c.etapes.some(ecranDerriereConnexion))) expect(rendre(versVueCas(c, "e", true, undefined, true))).not.toContain("Fournir cet écran");
  });
});
