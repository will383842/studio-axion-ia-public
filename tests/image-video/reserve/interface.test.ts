/**
 * RÉSERVE Image → vidéo · interface : rendu des trois colonnes (À faire, En cours avec lien et note, Fait), ajout en
 * masse découpé par `---`, aucun bouton désactivé par le prix, élément rouge après 2 essais. Rendu en HTML statique,
 * textes fictifs.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ElementReserveIV, ReserveIV } from "@/domaine/image-video/reserve";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/image-video/reserve" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/app/(studio)/image-video/reserve/actions", () => ({
  ajouterReserveIVAction: async () => ({ ok: true, donnees: { statut: "refuse", phrase: "x" } }),
  retirerReserveIVAction: async () => ({ ok: true, donnees: true }),
  fabriquerSuivantReserveIVAction: async () => ({ ok: true, donnees: { statut: "vide" } }),
}));

const { Reserve, decouperEnMasse } = await import("@/components/formats/image-video/Reserve");

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const T0 = "2030-01-01T10:00:00.000Z";
const el = (id: string, plus: Partial<ElementReserveIV>): ElementReserveIV => ({ id, nature: "idee", texte: `Idée fictive ${id}`, reseaux: ["linkedin"], etat: "a-faire", rang: 1, ajouteLe: T0, essais: 0, ...plus });
const reserve = (...elements: ElementReserveIV[]): ReserveIV => ({ version: "reserve-iv/1", elements });
const rendre = (r: ReserveIV, prix = 120, suivantReseaux = r.elements.some((e) => e.etat === "a-faire") ? 1 : 0) => renderToStaticMarkup(createElement(Reserve, { reserve: r, suivantReseaux, prix }));

describe("Réserve · rendu", () => {
  const r = reserve(
    el("a1", { rang: 1 }),
    el("b1", { etat: "en-cours", videoId: "v-42", note: "à relire", lanceeLe: T0 }),
    el("c1", { etat: "fait", videoId: "v-7" }),
    el("d1", { etat: "retire" }),
  );

  it("montre les trois colonnes avec leurs éléments ; un retiré est conservé mais pas montré", () => {
    const html = rendre(r);
    const t = texte(html);
    for (const titre of ["À faire", "En cours", "Fait"]) expect(t).toContain(titre);
    expect(t).toContain("Idée fictive a1");
    expect(t).toContain("Idée fictive b1");
    expect(t).toContain("Idée fictive c1");
    expect(t).not.toContain("Idée fictive d1");
    expect(html).toContain('href="/image-video/v-42"');
    expect(t).toContain("à relire");
  });

  it("zone d'ajout : script ou idée, réseaux en pastilles, ajout en masse expliqué", () => {
    const t = texte(rendre(reserve()));
    expect(t).toContain("Coller un script");
    expect(t).toContain("Une idée");
    for (const n of ["YouTube Shorts", "LinkedIn", "Instagram", "Facebook"]) expect(t).toContain(n);
    expect(t).toContain("---");
  });

  it("Retirer n'apparaît que sur À faire", () => {
    const html = rendre(r);
    expect(html.match(/>Retirer</g)).toHaveLength(1);
  });

  it("un élément à faire après 2 essais est en rouge, avec sa phrase", () => {
    const html = rendre(reserve(el("r1", { essais: 2, note: "Le format n'est pas ouvert." }), el("n1", { rang: 2, essais: 1 })));
    const lignes = [...html.matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => m[0]);
    const li = (id: string) => lignes.find((l) => l.includes(`Idée fictive ${id}`))!;
    expect(li("r1")).toContain("text-brique");
    expect(li("n1")).not.toContain("text-brique");
    expect(texte(html)).toContain("Pas réussi après 2 essais : Le format n'est pas ouvert.");
    expect(texte(rendre(reserve(el("n1", { essais: 1 }))))).not.toContain("Pas réussi");
  });
});

describe("Réserve · le prix informe, il ne bloque jamais", () => {
  /** Le bouton « Fabriquer le suivant » en entier ; `disabled=""` n'est posé que par l'attribut, pas par la classe `disabled:`. */
  const fabriquer = (html: string) => [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]).find((b) => b.includes("Fabriquer le suivant"))!;
  const desactive = (bouton: string) => /^<button\b[^>]*\sdisabled(=""|\s|>)/.test(bouton);

  it("le prix au plus est affiché sur le bouton, qui n'est pas désactivé, même à prix énorme, nul ou absent", () => {
    for (const prix of [120, 9_999_999, 0]) {
      const html = rendre(reserve(el("a1", {})), prix);
      expect(texte(html)).toContain("Fabriquer le suivant (au plus");
      expect(desactive(fabriquer(html))).toBe(false);
    }
    // Contrôle du contrôle : un bouton réellement désactivé est bien reconnu (« Ajouter » l'est quand la zone est vide).
    expect(desactive('<button type="button" disabled="" class="x">Ajouter</button>')).toBe(true);
    expect(texte(rendre(reserve(el("a1", {}))))).toMatch(/au plus 1,20\s?€/);
  });

  it("Retirer porte un libellé qui résume le texte de l'élément", () => {
    const html = rendre(reserve(el("a1", { texte: "Un   texte\nfictif" })));
    expect(html).toContain('aria-label="Retirer : Un texte fictif"');
  });

  it("file vide : le bouton reste cliquable (la réponse dira qu'il n'y a rien)", () => {
    const html = rendre(reserve());
    expect(texte(html)).toContain("Fabriquer le suivant");
    expect(desactive(fabriquer(html))).toBe(false);
  });
});

describe("Réserve · ajout en masse", () => {
  it("découpe sur les lignes --- et ignore les blocs vides", () => {
    expect(decouperEnMasse("Premier texte fictif\n---\nDeuxième texte fictif\n\n  ---  \n\n---\nTroisième\nsur deux lignes\n")).toEqual(["Premier texte fictif", "Deuxième texte fictif", "Troisième\nsur deux lignes"]);
    expect(decouperEnMasse("   \n---\n")).toEqual([]);
    expect(decouperEnMasse("Un seul")).toEqual(["Un seul"]);
  });

  it("un --- au milieu d'une ligne ne découpe pas", () => {
    expect(decouperEnMasse("Avant --- après")).toEqual(["Avant --- après"]);
  });
});
