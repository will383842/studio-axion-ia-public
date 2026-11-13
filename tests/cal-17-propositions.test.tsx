/** CAL-17 · Les propositions de l'équipe IA s'affichent en carte pointillée « Proposée » ; le Studio ne les programme jamais. Aucun appel réel. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CarteProposition } from "@/components/calendrier/CarteProposition";
import { GrilleSemaine } from "@/components/calendrier/GrilleSemaine";
import type { EntreeCarte } from "@/components/calendrier/CarteEntreeCalendrier";

const AUJ = "2026-11-11";
const LIEN = "/usine/a-valider";
const prop = (o: Partial<EntreeCarte> = {}): EntreeCarte => ({ cle: "p1|linkedin", jour: "2026-11-13", reseau: "linkedin", type: "video", etat: "propose", heure: "09:00", titre: "Idée", ...o });
const carte = (p: Partial<Parameters<typeof CarteProposition>[0]> = {}) => renderToStaticMarkup(<CarteProposition entree={prop()} lienAValider={LIEN} {...p} />);

describe("CAL-17 · carte pointillée", () => {
  it("pointillée, avec le libellé « Proposée » écrit (jamais la couleur seule)", () => {
    const html = carte();
    expect(html).toContain("border-dashed");
    expect(html).toContain("Proposée");
    expect(html).toContain('data-proposition="p1|linkedin"');
  });
  it("le libellé lu à l'oral dit aussi le réseau, le type et « proposée »", () => expect(carte()).toMatch(/aria-label="Proposée, LinkedIn, Vidéo/));
  it("« Pourquoi ici » et « Ressemble à » seulement quand l'information existe", () => {
    const plein = carte({ pourquoi: "Jour sans publication", ressembleA: "Publication du 4 novembre" });
    expect(plein).toContain("Pourquoi ici");
    expect(plein).toContain("Jour sans publication");
    expect(plein).toContain("Ressemble à");
    expect(plein).toContain("Publication du 4 novembre");
    const vide = carte();
    expect(vide).not.toContain("Pourquoi ici");
    expect(vide).not.toContain("Ressemble à");
    expect(carte({ pourquoi: "  " })).not.toContain("Pourquoi ici");
  });
  it("aucun bouton : un seul lien mène à l'écran « À valider » de l'usine, d'au moins 44 px", () => {
    const html = carte({ pourquoi: "x", ressembleA: "y" });
    expect(html).not.toContain("<button");
    expect((html.match(/<a /g) ?? []).length).toBe(1);
    expect(html).toContain(`href="${LIEN}"`);
    expect(html).toContain("min-h-[44px]");
    expect(html).not.toMatch(/Programmer|Valider la s|Tout valider|Refuser|Publier/);
  });
  it("aucun prix", () => expect(carte({ pourquoi: "x" })).not.toMatch(/€|\$|prix|tarif/i));
});

describe("CAL-17 · dans la semaine", () => {
  const rendre = (p: Partial<Parameters<typeof GrilleSemaine>[0]> = {}) => renderToStaticMarkup(<GrilleSemaine semaineDu={AUJ} aujourdhui={AUJ} entrees={[]} {...p} />);
  it("la proposition apparaît dans la case de son réseau et de son jour", () => {
    const html = rendre({ propositions: [{ entree: prop(), pourquoi: "Créneau vide" }], lienAValider: LIEN });
    expect(html).toMatch(/data-case="linkedin\|2026-11-13"[\s\S]*data-proposition="p1\|linkedin"/);
    expect(html).toContain("Créneau vide");
  });
  it("un réseau éteint ou un jour hors semaine : rien", () => {
    expect(rendre({ propositions: [{ entree: prop() }], lienAValider: LIEN, reseaux: ["tiktok"] })).not.toContain("data-proposition");
    expect(rendre({ propositions: [{ entree: prop({ jour: "2026-12-20" }) }], lienAValider: LIEN })).not.toContain("data-proposition");
  });
  it("une proposition n'est jamais déplaçable ni cliquable pour la programmer", () => {
    const html = rendre({ propositions: [{ entree: prop() }], lienAValider: LIEN, onDeplacer: () => {} });
    expect(html).not.toContain("data-glissable");
    expect(html).not.toContain("<button");
  });
  it("sans lien vers « À valider », aucune carte n'est montrée (pas de cul-de-sac)", () => expect(rendre({ propositions: [{ entree: prop() }] })).not.toContain("data-proposition"));
});
