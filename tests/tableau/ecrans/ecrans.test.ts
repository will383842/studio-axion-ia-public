/**
 * ÉCRANS DU TABLEAU ANIMÉ (tâche TB-21) : fiche de scènes, suivi de fabrication, coût de la voix, boutons de retouche,
 * et l'aiguillage de la fiche vidéo (rien de neuf tant que le format est masqué). Rendu statique, aucun appel.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BoutonsRetoucheTableau } from "../../../src/components/formats/tableau-anime/BoutonsRetouche";
import { CoutVoixTableau } from "../../../src/components/formats/tableau-anime/CoutVoix";
import { EtapesTableau, type TravailTableauLu } from "../../../src/components/formats/tableau-anime/EtapesTableau";
import { arretALaRelecture } from "../../../src/components/formats/tableau-anime/vue";
import { FicheScenesTableau } from "../../../src/components/formats/tableau-anime/FicheScenes";
import { ecranTableauVisible } from "../../../src/components/formats/tableau-anime/aiguillage";
import { caracteresDits, coutVoixCentimes, etapesSuivi, pagesDeLaFiche, phraseDuRefus } from "../../../src/components/formats/tableau-anime/vue";
import { trouverFormat } from "../../../src/formats";
import { formatTableauAnime } from "../../../src/formats/tableau-anime";
import { validerFicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { etapesTableau } from "../../../src/moteurs/montage-tableau/etapes";
import { EXEMPLES, contexteExemple, copie, ficheErreurCorrigee } from "../regles/exemples";

/** Texte visible d'un rendu (balises retirées). */
const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

/** Vocabulaire interdit à l'écran : identifiants internes, sigles, tutoiement, une ville. */
function sansMotTechnique(t: string) {
  expect(t).not.toMatch(/\bs\d{2}\b|\be\d{2}\b/); // identifiants de scène et d'élément
  expect(t).not.toMatch(/\b(?!IA\b)[A-Z]{2,}\b/); // aucun sigle (« IA » vient des textes des fiches d'exemple)
  expect(t).not.toMatch(/(?<!\p{L})(tu|ton|ta|tes|toi)(?!\p{L})/iu);
  expect(t).not.toMatch(/villeexemple/i);
  expect(t).not.toMatch(/undefined|null|NaN/);
}

describe("fiche de scènes", () => {
  it.each(Object.entries(EXEMPLES))("exemple « %s » : pages, scènes, voix, écrit, aucun refus", (_nom, fiche) => {
    const html = renderToStaticMarkup(createElement(FicheScenesTableau, { fiche }));
    const t = texte(html);
    expect(t).toContain("Les scènes");
    expect(t).toContain("Tout est bon");
    for (const p of new Set(fiche.scenes.map((s) => s.page))) expect(t).toContain(`Page ${p}`);
    for (const s of fiche.scenes) expect(t).toContain(s.texteDit.replace(/\s+/g, " "));
    expect(t).toContain("La voix dit");
    expect(t).toContain("Écrit");
    expect(html).not.toContain('role="alert"');
    sansMotTechnique(t);
  });

  it("scène « L'erreur corrigée » : dessin, geste et mots importants en clair", () => {
    const { pages } = pagesDeLaFiche(ficheErreurCorrigee);
    const s1 = pages[0].scenes[0];
    expect(s1.nom).toBe("L'accroche");
    expect(s1.ecrit).toEqual(["Réponses vagues ? (entouré)"]);
    expect(s1.importants).toContain("Réponses vagues ?");
    expect(s1.dessins).toHaveLength(1);
    expect(s1.dessins[0]).not.toContain("-");
    const s6 = pages[2].scenes[1];
    expect(s6.gestes).toEqual(["Le stylo coche « Juste, du premier coup »"]);
    expect(s6.importants).toContain("Juste, du premier coup");
  });

  it("refus : la phrase simple est à côté de la scène fautive, et seulement là", () => {
    const fiche = copie(ficheErreurCorrigee);
    const ligne = fiche.scenes[2].elements.find((e) => e.type === "ligne")!;
    if (ligne.type === "ligne") ligne.texte = "Abonnez-vous vite";
    const r = validerFicheTableau(fiche, contexteExemple(fiche));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const surScene3 = r.problemes.filter((p) => p.sceneId === fiche.scenes[2].id);
    expect(surScene3.length).toBeGreaterThan(0);

    const { pages } = pagesDeLaFiche(fiche, r.problemes);
    const scenes = pages.flatMap((p) => p.scenes);
    expect(scenes[2].refus.length).toBe(surScene3.length);
    expect(scenes.filter((s, i) => i !== 2 && s.refus.length)).toEqual([]);
    for (const phrase of scenes[2].refus) {
      expect(phrase).not.toMatch(/règle «|Scène s\d/);
      expect(phrase.charAt(0)).toBe(phrase.charAt(0).toUpperCase());
    }

    const html = renderToStaticMarkup(createElement(FicheScenesTableau, { fiche, problemes: r.problemes }));
    const t = texte(html);
    expect(t).toMatch(/\d+ points? à revoir/);
    expect(t).not.toContain("Tout est bon");
    // Le refus est rendu DANS le bloc de la 3e scène (après sa voix, avant la scène suivante).
    const i3 = t.indexOf(fiche.scenes[2].texteDit);
    const i4 = t.indexOf(fiche.scenes[3].texteDit);
    const iRefus = t.indexOf(scenes[2].refus[0]);
    expect(iRefus).toBeGreaterThan(i3);
    expect(iRefus).toBeLessThan(i4);
  });

  it("un refus sans scène est montré en tête", () => {
    const { refusGeneraux } = pagesDeLaFiche(ficheErreurCorrigee, [{ regle: "durée", message: "Vidéo · règle « durée » : trop longue de 4 s" }]);
    expect(refusGeneraux).toEqual(["Trop longue de 4 s."]);
    expect(phraseDuRefus("déjà propre.")).toBe("Déjà propre.");
  });
});

const etape = (cle: string, statut: TravailTableauLu["etapes"][number]["statut"], erreur?: TravailTableauLu["etapes"][number]["erreur"]) => ({ cle, statut, ...(erreur ? { erreur } : {}) });

describe("suivi de fabrication", () => {
  it("les étapes du moteur deviennent 4 étapes parlantes, où on en est", () => {
    const cles = etapesTableau({ entrees: {}, distribution: [{ personnageId: "p" }] as never, dureeCibleSec: 45 }).map((e) => e.cle);
    const travail = cles.map((c, i) => etape(c, i < 3 ? "terminee" : i === 3 ? "en_cours" : "en_attente"));
    // Découpage, relecture et voix faits ; le calage (compté avec « Les pages ») en cours.
    expect(etapesSuivi(travail)).toEqual([
      { nom: "Le découpage", statut: "faite" },
      { nom: "La voix", statut: "faite" },
      { nom: "Les pages", statut: "en-cours" },
      { nom: "Les finitions", statut: "a-venir" },
    ]);
    // Fiche fournie : pas de découpage, la 1re étape est une relecture.
    expect(etapesSuivi([etape("fiche", "en_cours"), etape("calage", "en_attente")]).map((e) => e.nom)).toEqual(["La relecture", "Les pages"]);
    // Travail arrêté : aucune étape « en cours » (aucune roue qui tourne).
    expect(etapesSuivi(travail, { arrete: true }).some((e) => e.statut === "en-cours")).toBe(false);
  });

  it("en cours : heure de fin, « Vous pouvez fermer », aucun « Reprendre »", () => {
    const maintenant = Date.parse("2026-10-11T12:00:00Z");
    const travail: TravailTableauLu = { statut: "en_cours", etapes: [etape("fiche", "terminee"), etape("voix", "en_cours"), etape("pages", "en_attente"), etape("montage", "en_attente")], finEstimee: "2026-10-11T12:17:00Z" };
    const t = texte(renderToStaticMarkup(createElement(EtapesTableau, { travail, onReessayer: () => undefined, maintenantMs: maintenant })));
    expect(t).toContain("Votre vidéo se fabrique");
    expect(t).toContain("Prête vers 14 h 20");
    expect(t).toContain("Vous pouvez fermer.");
    expect(t).not.toContain("Reprendre");
    sansMotTechnique(t);
  });

  it("en file : sa place dans la file", () => {
    const travail: TravailTableauLu = { statut: "en_file", rang: 2, etapes: [etape("fiche", "en_attente")] };
    expect(texte(renderToStaticMarkup(createElement(EtapesTableau, { travail })))).toContain("2ᵉ dans la file");
  });

  it("erreur réessayable : le message en clair et « Reprendre »", () => {
    const travail: TravailTableauLu = {
      statut: "echec",
      etapes: [etape("fiche", "terminee"), etape("voix", "echec", { reessayable: true, messagePourWill: "La voix ne répond pas pour l'instant." })],
    };
    const t = texte(renderToStaticMarkup(createElement(EtapesTableau, { travail, onReessayer: () => undefined })));
    expect(t).toContain("La fabrication s'est arrêtée");
    expect(t).toContain("La voix ne répond pas pour l'instant.");
    expect(t).toContain("Reprendre");
    expect(t).not.toContain("Vous pouvez fermer");
    sansMotTechnique(t);
  });

  it("erreur non réessayable : le message, sans « Reprendre »", () => {
    const travail: TravailTableauLu = {
      statut: "echec",
      erreur: { reessayable: false, messagePourWill: "La fiche de scènes a été refusée : revoyez les points signalés." },
      etapes: [etape("fiche", "echec")],
    };
    const t = texte(renderToStaticMarkup(createElement(EtapesTableau, { travail, onReessayer: () => undefined })));
    expect(t).toContain("La fiche de scènes a été refusée");
    expect(t).not.toContain("Reprendre");
  });

  it("arrêt à la relecture de la fiche : « Corriger la fiche » et « Reprendre la fabrication » (essai du 12/10)", () => {
    const travail: TravailTableauLu = {
      statut: "echec",
      erreur: { reessayable: false, messagePourWill: "La relecture de la fiche n'a pas abouti." },
      etapes: [etape("fiche", "echec"), etape("voix", "en_attente")],
    };
    expect(arretALaRelecture(travail)).toBe(true);
    expect(arretALaRelecture({ statut: "echec", etapes: [etape("fiche", "terminee"), etape("voix", "echec")] })).toBe(false);
    const actionsArret = createElement("span", null, "Corriger la fiche · Reprendre la fabrication");
    const t = texte(renderToStaticMarkup(createElement(EtapesTableau, { travail, onReessayer: () => undefined, actionsArret })));
    expect(t).toContain("Corriger la fiche");
    expect(t).toContain("Reprendre la fabrication");
    // Pendant la fabrication, jamais.
    expect(texte(renderToStaticMarkup(createElement(EtapesTableau, { travail: { ...travail, statut: "en_cours" }, actionsArret })))).not.toContain("Corriger la fiche");
  });

  it("le suivi branche « Corriger la fiche » (retour à l'écran de création) et « Reprendre la fabrication » sur tout arrêt", () => {
    const src = readFileSync("src/components/formats/tableau-anime/SuiviTableau.tsx", "utf8");
    expect(src).toContain("issuesApresArret(t)");
    expect(src).toContain("`/tableau/nouvelle?brouillon=${encodeURIComponent(videoId)}`");
    expect(src).toContain("relancerTableauAction(t.id, accord)");
  });
});

describe("coût de la voix, annoncé avant le lancement", () => {
  it("prix des caractères dits, arrondi au centime supérieur", () => {
    const n = caracteresDits(ficheErreurCorrigee);
    expect(n).toBe(ficheErreurCorrigee.scenes.map((s) => s.texteDit).join(" ").length);
    expect(coutVoixCentimes(ficheErreurCorrigee, 0.1)).toBe(Math.ceil(n * 0.1));
    expect(coutVoixCentimes(ficheErreurCorrigee, Number.NaN)).toBe(0);
  });

  it("le montant et « Lancer » ; en essai, rien n'est payé", () => {
    const t = texte(renderToStaticMarkup(createElement(CoutVoixTableau, { centimes: 42, onLancer: () => undefined })));
    expect(t).toMatch(/La voix : environ 0,42\s€/);
    expect(t).toContain("Rien n'est payé avant votre accord.");
    expect(t).toContain("Lancer");
    expect(texte(renderToStaticMarkup(createElement(CoutVoixTableau, { centimes: 42, essai: true })))).toContain("En essai, rien n'est payé.");
  });
});

describe("boutons de retouche", () => {
  it("affiche la liste reçue, gratuit ou payant", () => {
    const operations = [
      { cle: "agrandir", libelle: "Plus grand", payant: false },
      { cle: "modifierTexteDit", libelle: "Changer ce qui est dit", payant: true },
    ];
    const t = texte(renderToStaticMarkup(createElement(BoutonsRetoucheTableau, { operations, onChoisir: () => undefined })));
    expect(t).toContain("Plus grand Gratuit");
    expect(t).toContain("Changer ce qui est dit Payant");
    expect(t).not.toContain("agrandir");
    expect(renderToStaticMarkup(createElement(BoutonsRetoucheTableau, { operations: [] }))).toBe("");
  });
});

describe("aiguillage de la fiche vidéo", () => {
  it("format masqué (simulé) : rien de neuf n'apparaît", () => {
    expect(ecranTableauVisible({ ...formatTableauAnime, statut: "masque" })).toBe(false);
    expect(ecranTableauVisible({ id: "tableau-anime", statut: "masque" })).toBe(false);
  });

  it("format actif : la fiche vidéo montre les écrans du tableau", () => {
    expect(formatTableauAnime.statut).toBe("actif");
    expect(ecranTableauVisible(trouverFormat("tableau-anime"))).toBe(true);
    expect(ecranTableauVisible(formatTableauAnime)).toBe(true);
  });

  it("les autres formats ne changent pas ; le tableau visible seulement une fois sorti du masque", () => {
    expect(ecranTableauVisible(trouverFormat("facecam"))).toBe(false);
    expect(ecranTableauVisible(undefined)).toBe(false);
    expect(ecranTableauVisible({ id: "tableau-anime", statut: "actif" })).toBe(true);
  });

  it("la fiche vidéo ne montre le suivi du tableau que derrière l'aiguillage", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(studio)/videos/[id]/page.tsx"), "utf8");
    expect(page).toContain("const tableau = ecranTableauVisible(format);");
    const usages = page.split("<SuiviTableau").length - 1;
    expect(usages).toBe(1);
    expect(page).toMatch(/d\.travail && tableau && \(enFabrication \|\| d\.travail\.statut === "echec"\) \? \(\s*<SuiviTableau initial=\{d\.travail\} fichiers=\{fichiersTab\} \/>/);
    // Les fichiers déjà faits d'une fabrication arrêtée : lus derrière le même aiguillage.
    expect(page).toContain('const fichiersTab = tableau && d.travail?.statut === "echec" ? await fichiersApresArretTableau(v.id) : null;');
  });
});
