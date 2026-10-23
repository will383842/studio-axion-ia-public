/**
 * U2 : le bloc « Vos fichiers » et l'aiguillage du format (rendu statique, vues écrites à la main : aucun appel).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FORMAT_CAS_CONCRET, ficheCasConcretVisible, menuCasConcretVisible } from "../../../src/components/formats/cas-concret/aiguillage";
import { VosFichiers } from "../../../src/components/formats/cas-concret/fiche-video/VosFichiers";
import type { FichierReseauCasConcret, VueCasConcret } from "../../../src/services/cas-concret-vue";

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

const NOMS = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn" } as const;
const fichier = (reseau: keyof typeof NOMS, extra: Partial<FichierReseauCasConcret> = {}): FichierReseauCasConcret => ({
  reseau,
  nom: NOMS[reseau],
  url: `https://stockage.test/${reseau}.mp4?signature=abc`,
  dureeSec: 52.4,
  dimensions: "1080 × 1920",
  phraseFin: "Fin : diagnostic et lien",
  texte: `Texte pour ${NOMS[reseau]}.`,
  lien: `https://axion-ia.com/fr/diagnostic?utm_source=${reseau}`,
  premierCommentaire: "Votre diagnostic gratuit, en quelques minutes : https://axion-ia.com/fr/diagnostic",
  consigneLien: "Posez ce lien en premier commentaire.",
  ...extra,
});

const vue = (extra: Partial<VueCasConcret> = {}): VueCasConcret => ({
  fichiers: (["facebook", "instagram", "tiktok", "linkedin"] as const).map((r) => fichier(r)),
  rapport: { verdict: "ok", resume: "Les vérifications sont passées.", phrases: [] },
  coutCentimes: 42,
  cout: "0,42 €",
  essai: false,
  documentAPreparer: false,
  ...extra,
});

const rendre = (v: VueCasConcret) => renderToStaticMarkup(createElement(VosFichiers, { vue: v }));

describe("Vos fichiers", () => {
  it("une ligne par réseau, avec durée, dimensions, phrase de la fin et les quatre gestes", () => {
    const html = rendre(vue());
    const t = texte(html);
    for (const n of Object.values(NOMS)) expect(t).toContain(n);
    expect(html.match(/<li /g)).toHaveLength(4);
    expect(t).toContain("52 s");
    expect(t).toContain("1080 × 1920");
    expect(t).toContain("Fin : diagnostic et lien");
    expect((t.match(/Télécharger/g) ?? []).length).toBe(4);
    expect((t.match(/Copier le texte/g) ?? []).length).toBe(4);
    expect((t.match(/Copier le lien/g) ?? []).length).toBe(4);
    expect((t.match(/Où poser le lien/g) ?? []).length).toBe(4);
    for (const bloc of ["Le premier commentaire", "Vérifications", "Ce que la vidéo a coûté", "0,42 €"]) expect(t).toContain(bloc);
  });

  it("la phrase « Fin : diagnostic et lien » s'affiche avec sa raison", () => {
    const raison = "Le mot n'est pas branché sur ce compte : la fin propose le diagnostic.";
    const t = texte(rendre(vue({ fichiers: [fichier("facebook", { phraseFin: "Fin : diagnostic et lien", raisonFin: raison })] })));
    expect(t).toContain("Fin : diagnostic et lien");
    expect(t).toContain(raison);
  });

  it("document promis : la phrase n'apparaît que quand il est à préparer", () => {
    expect(texte(rendre(vue({ documentAPreparer: true })))).toContain("Document promis : à préparer avant de publier.");
    expect(texte(rendre(vue()))).not.toContain("Document promis");
  });

  it("P9 : la phrase « Document promis » de master reste tant que le document promis n'est pas ouvert ; elle s'efface quand il l'est", () => {
    const phrase = "Document promis : à préparer avant de publier.";
    expect(texte(rendre(vue({ documentAPreparer: true, documentOuvert: false })))).toContain(phrase);
    expect(texte(rendre(vue({ documentAPreparer: true, documentOuvert: true })))).not.toContain("Document promis");
    expect(texte(rendre(vue({ documentOuvert: true })))).not.toContain("Document promis");
  });

  it("vidéo d'essai : la pastille, aucun bouton « Copier », aucun lien ni texte", () => {
    const essai = vue({ essai: true, documentAPreparer: true, fichiers: [fichier("facebook", { texte: undefined, lien: undefined, premierCommentaire: undefined, consigneLien: undefined })] });
    const html = rendre(essai);
    const t = texte(html);
    expect(t).toContain("Essai : cas à confirmer par Will, ne pas publier");
    expect(t).not.toContain("Copier");
    expect(t).not.toContain("Où poser le lien");
    expect(t).not.toContain("Le premier commentaire");
    expect(t).not.toContain("Document promis");
    // Aucun lien (« Fin : diagnostic et lien » reste : c'est la phrase de la fin, pas un lien).
    expect(html).not.toContain("axion-ia.com/fr/diagnostic");
  });

  it("aucun bouton de publication ni de programmation, aucun identifiant ni sigle", () => {
    const t = texte(rendre(vue({ documentAPreparer: true })));
    expect(t).not.toMatch(/publier maintenant|programmer|envoyer sur/i);
    expect(t).not.toMatch(/\b(?!IA\b|MD\b)[A-Z]{2,}\b/);
    expect(t).not.toMatch(/(?<!\p{L})(tu|ton|ta|tes|toi)(?!\p{L})/iu);
    expect(t).not.toMatch(/undefined|null|NaN/);
  });
});

describe("aiguillage", () => {
  it("la fiche est visible pour ce format quel que soit son statut ; le menu seulement s'il n'est plus masqué", () => {
    expect(FORMAT_CAS_CONCRET).toBe("cas-concret");
    for (const statut of ["masque", "actif", "beta"] as const) expect(ficheCasConcretVisible({ id: "cas-concret", statut } as never)).toBe(true);
    expect(menuCasConcretVisible({ id: "cas-concret", statut: "masque" } as never)).toBe(false);
    expect(menuCasConcretVisible({ id: "cas-concret", statut: "actif" } as never)).toBe(true);
    expect(ficheCasConcretVisible({ id: "tableau-anime", statut: "actif" } as never)).toBe(false);
    expect(menuCasConcretVisible({ id: "avocat", statut: "actif" } as never)).toBe(false);
    expect(ficheCasConcretVisible(null)).toBe(false);
    expect(menuCasConcretVisible(undefined)).toBe(false);
  });

  it("les fichiers n'importent ni publications ni buffer", () => {
    const dossier = join(__dirname, "../../../src/components/formats/cas-concret");
    const fichiers = [join(dossier, "aiguillage.ts"), ...readdirSync(join(dossier, "fiche-video")).map((f) => join(dossier, "fiche-video", f))];
    for (const f of fichiers) expect(readFileSync(f, "utf8")).not.toMatch(/from\s+["'][^"']*(publications|buffer)[^"']*["']/);
  });
});
