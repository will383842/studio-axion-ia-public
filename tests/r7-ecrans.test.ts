/**
 * LOT R7 — écran « Mon double HeyGen » (rendu serveur) : liste en mots simples, double prêt choisissable, double pas
 * prêt montré sans bouton, HeyGen non relié dit clairement ; aucun nom technique affiché.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(studio)/personnages/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: null })) }));

const { ListeDoubles, CONSEILS_DOUBLE_HEYGEN } = await import("@/components/personnages/ChoixDoubleHeygen");

const TECHNIQUE = /avatar|api|look|webm|digital|twin|engine|1080|idempotence|heygen_api/i;
const rendre = (liste: Parameters<typeof ListeDoubles>[0]["liste"]) => renderToStaticMarkup(createElement(ListeDoubles, { liste, enCours: false, onChoisir: () => undefined }));

describe("mon double HeyGen", () => {
  it("un double prêt : « Utiliser ce double » ; un double pas prêt : sa raison, sans bouton ; un double déjà choisi", () => {
    const html = rendre({
      branche: true,
      doubles: [
        { idExterne: "a", nom: "Trois-quarts, chemise noire", utilisable: true },
        { idExterne: "b", nom: "Face", utilisable: false, raison: "HeyGen attend encore votre accord filmé (dans l'application HeyGen)." },
        { idExterne: "c", nom: "Ancien", utilisable: true, utiliseParVisageId: "v1" },
      ],
    });
    expect(html.match(/Utiliser ce double/g)).toHaveLength(1);
    expect(html).toContain("Pas encore prêt");
    expect(html).toContain("accord filmé");
    expect(html).toContain("Déjà choisi");
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(TECHNIQUE);
  });
  it("HeyGen pas relié, ou aucun double : phrase claire", () => {
    expect(rendre({ branche: false, doubles: [] })).toContain("HeyGen n&#x27;est pas encore relié");
    expect(rendre({ branche: true, doubles: [] })).toContain("Créez votre double dans l&#x27;application HeyGen");
  });
  it("conseils de tournage courts, sans nom technique ; bouton dans la fiche du personnage", () => {
    expect(CONSEILS_DOUBLE_HEYGEN.join(" ")).toMatch(/verticale.*HDR coupée/);
    expect(CONSEILS_DOUBLE_HEYGEN.join(" ")).toMatch(/fond gris uni/);
    expect(CONSEILS_DOUBLE_HEYGEN.join(" ")).not.toMatch(TECHNIQUE);
    expect(readFileSync("src/components/personnages/OngletVisages.tsx", "utf8")).toContain("<ChoixDoubleHeygen");
  });
  it("ROUGE (relecture exactitude 3042b94, n° 9) — aucun visage : la consigne renvoie à l'application HeyGen, plus de « vidéo de 2 minutes »", () => {
    const source = readFileSync("src/components/personnages/OngletVisages.tsx", "utf8");
    expect(source).not.toContain("2 minutes suffit");
    expect(source).toContain("Votre double se crée dans l'application HeyGen, puis se relie ici.");
  });
});
