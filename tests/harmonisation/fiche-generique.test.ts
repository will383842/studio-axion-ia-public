/** Lot F1 : la fiche générique `/videos/[id]` passe par `GabaritFicheVideo` ; « Reprendre » garde le brouillon. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GabaritFicheVideo } from "@/components/fabrication/GabaritFicheVideo";
import { ActionsArret } from "@/components/videos/ActionsArret";

// Les boutons portent des actions serveur : on les remplace par des marqueurs, la décision (qui est là, dans quel ordre) reste celle du vrai composant.
vi.mock("@/components/videos/BoutonReprendre", () => ({ BoutonReprendre: () => createElement("button", null, "Reprendre") }));
vi.mock("@/components/videos/BoutonAnnuler", () => ({ BoutonAnnuler: () => createElement("button", null, "Annuler") }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: unknown }) => createElement("a", { href }, children as never) }));

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

describe("vidéo arrêtée : Reprendre seulement là où l'écran du format rouvre le brouillon", () => {
  const rendre = (formatId: string) => renderToStaticMarkup(createElement(ActionsArret, { videoId: "v1", formatId, annulable: true }));

  it.each([
    ["facecam-animee", "/face-camera-animee"],
    ["cas-concret", "/cas-concret"],
  ])("%s : pas de Reprendre, mais Recommencer (vers %s) et Annuler", (formatId, ecran) => {
    const html = rendre(formatId);
    expect(html).not.toContain("Reprendre");
    expect(html).toContain(`href="${ecran}"`);
    expect(html).toContain("Recommencer");
    expect(html).toContain("Annuler");
    expect(html).toContain("Vous pouvez recommencer cette vidéo.");
    expect(html).not.toContain("Rien n&#x27;est perdu.");
  });

  it("un autre format : Reprendre avant Annuler, et « Rien n'est perdu. »", () => {
    const html = rendre("facecam");
    expect(html).toContain("Rien n&#x27;est perdu.");
    expect(html.indexOf("Reprendre")).toBeGreaterThan(-1);
    expect(html.indexOf("Reprendre")).toBeLessThan(html.indexOf("Annuler"));
    expect(html).not.toContain("Recommencer");
  });
});

// Paramètre transmis, pas encore lu par l'écran : ces deux écrans ignorent ?brouillon pour l'instant (d'où « Recommencer » et non « Reprendre »).
describe("aiguillage de /nouvelle/[format] : ?brouillon est transmis (paramètre transmis, pas encore lu par l'écran)", () => {
  const page = lire("src/app/(studio)/nouvelle/[format]/page.tsx");

  it("face caméra animée : ?brouillon est transmis dans la redirection", () => {
    expect(page).toMatch(/ID_FORMAT_FACECAM_ANIMEE\) redirect\(sp\.brouillon \? `\/face-camera-animee\?brouillon=\$\{encodeURIComponent\(sp\.brouillon\)\}` : "\/face-camera-animee"\)/);
  });

  it("cas concret : ?brouillon est transmis dans la redirection", () => {
    expect(page).toMatch(/if \(ecranCasConcret\) redirect\(sp\.brouillon \? `\$\{ecranCasConcret\}\?brouillon=\$\{encodeURIComponent\(sp\.brouillon\)\}` : ecranCasConcret\)/);
  });
});

describe("fiche générique /videos/[id] : le gabarit commun", () => {
  const page = lire("src/app/(studio)/videos/[id]/page.tsx");

  it("rendu : une zone absente n'est pas posée, les autres suivent l'ordre du gabarit", () => {
    const html = renderToStaticMarkup(createElement(GabaritFicheVideo, { entete: "E", lecteur: "L", chiffres: "C", specifique: undefined, action: "A" }));
    expect([...html.matchAll(/data-zone="(\w+)"/g)].map((m) => m[1])).toEqual(["entete", "lecteur", "chiffres", "action"]);
  });

  it("rendu : deuxColonnes = retour + bandeau au-dessus, puis lecteur collé à gauche en lg et les autres zones empilées à droite", () => {
    const html = renderToStaticMarkup(createElement(GabaritFicheVideo, { deuxColonnes: true, retour: "R", bandeau: "B", entete: "E", lecteur: "L", chiffres: "C" }));
    expect(html).toContain("lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]");
    expect(html).not.toContain("--zones-droite");
    expect(html).toMatch(/flex flex-wrap items-center justify-between gap-x-3"><div data-zone="retour">R<\/div><div data-zone="bandeau">B<\/div><\/div>/);
    expect(html).toMatch(/<div data-zone="lecteur" class="lg:sticky lg:top-24 lg:self-start">L<\/div><div class="min-w-0 space-y-4"><div data-zone="entete">E<\/div><div data-zone="chiffres">C<\/div><\/div>/);
    // mobile : une colonne, le lecteur d'abord puis le reste
    expect([...html.matchAll(/data-zone="(\w+)"/g)].map((m) => m[1])).toEqual(["retour", "bandeau", "lecteur", "entete", "chiffres"]);
  });

  it("la page demande les deux colonnes et ne crée « specifique » que si un bloc existe", () => {
    expect(page).toMatch(/<GabaritFicheVideo\s+deuxColonnes\b/);
    expect(page).not.toContain("max-w-2xl");
    expect(page).toMatch(/specifique=\{\s*aSpecifique && \(/);
  });

  it("pose ses zones dans GabaritFicheVideo, dans l'ordre du gabarit", () => {
    expect(page).toMatch(/<GabaritFicheVideo\b/);
    const zones = ["retour", "bandeau", "entete", "lecteur", "essai", "chiffres", "suivi", "specifique", "onglets", "action"];
    const corps = page.slice(page.indexOf("<GabaritFicheVideo"));
    const pos = zones.map((z) => corps.search(new RegExp(`\\n\\s+${z}=\\{`)));
    expect(pos.every((p) => p >= 0), `zones absentes : ${zones.filter((_, i) => pos[i] < 0)}`).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });

  it("les chiffres passent par ChiffresVideo, plus de liste maison", () => {
    expect(page).toMatch(/<ChiffresVideo\b/);
    expect(page).not.toContain("grid-cols-3 gap-2");
  });

  it("l'arrêt passe par ActionsArret (mots communs), plus de phrase maison", () => {
    expect(page).toMatch(/<ActionsArret\b/);
    expect(page).not.toContain("Vous avez arrêté cette fabrication");
  });

  it("garde les spécificités : face caméra sans montant, « Valider et publier », pas de « Passer devant » en page", () => {
    expect(page).toContain('libellePublier="Valider et publier"');
    expect(page).toMatch(/\.\.\.\(facecam \? \[\] :/);
    expect(page).not.toContain("Passer devant");
  });
});
