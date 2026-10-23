import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { depots, reinitialiserDepots } from "@/donnees/memoire";
import type { Visuel } from "@/domaine/visuels/visuel";

const COLLECTIONS_MASTER = [
  "marques", "fichiers", "personnages", "visages", "voix", "prononciations", "elements", "scripts",
  "videos", "versions", "plans", "pistes", "retouches", "miniatures", "sousTitres", "sorties", "kits",
  "publications", "partages", "modeles", "idees", "series", "rushs", "travaux", "depenses",
  "ressourcesFournisseurs", "evenementsFournisseurs", "notifications", "sessions", "tentatives",
  "parametres", "evenements", "veilleOutils", "veilleNouveautes",
  "recharges", "reservations", "relevesSoldes",
  "scriptsMaitres", "variantes", "preuves", "matieres", "exemplesStyle", "fichesStyle", "tournesInterdites",
  "generations", "bilansApprentissage", "contexteAxion", "reglesDatees", "sessionsTournage",
  "tracesTableau",
  "pagesSite",
  "tracesScriptsTableau",
  "ideesJugees",
  "correctionsWill",
];

describe("collection visuels", () => {
  it("enregistre et relit un visuel en mémoire", async () => {
    reinitialiserDepots();
    const v: Visuel = {
      id: "vis_exemple-1",
      famille: "carrousel",
      titre: "Exemple inventé",
      entree: { type: "sujet", sujet: "Un sujet inventé" },
      statut: "brouillon",
      modeTexte: "simulation",
      versionSpec: 1,
      coutCentimes: 0,
      creeLe: "2026-01-01T00:00:00.000Z",
      modifieLe: "2026-01-01T00:00:00.000Z",
    };
    await depots().visuels.enregistrer(v);
    expect(await depots().visuels.obtenir(v.id)).toEqual(v);
    expect(await depots().visuels.compter()).toBe(1);
  });

  it("ajout seulement : les collections de master restent dans l'ordre, visuels en dernier", () => {
    const src = readFileSync("src/donnees/postgres/index.ts", "utf8");
    const bloc = src.slice(src.indexOf("const COLLECTIONS"), src.indexOf("];", src.indexOf("const COLLECTIONS")));
    const noms = [...bloc.replace(/\/\/.*$/gm, "").matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]);
    expect(noms).toEqual([...COLLECTIONS_MASTER, "visuels"]);
  });
});
