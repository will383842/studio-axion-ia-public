import { describe, expect, it } from "vitest";
import { choisir } from "@/briques/bibliotheque-video/choisir";
import { graineDe } from "@/briques/bibliotheque-video/graine";
import { lecteurDepuisEntree } from "@/briques/bibliotheque-video/lecteur";
import type { Candidat, EntreeBibliotheque, IdCapacite } from "@/briques/bibliotheque-video/types";

const A = "texte.pave" as IdCapacite;
const entree = (o: Partial<EntreeBibliotheque> = {}): EntreeBibliotheque => ({
  version: "bibliotheque-video/1",
  profil: { id: "p", formatId: "f", version: 1, capacites: { [A]: { permis: true } }, plafonds: {}, memoire: { fenetreVideos: 5, portee: "format" }, verrous: [] },
  recents: [{ capacite: A, cle: "k0", videoId: "v" }], graine: "G", figeeLe: "2026-01-01", ...o,
});
const cands: Candidat[] = Array.from({ length: 6 }, (_, i) => ({ id: `i${i}`, capacite: A, cle: `k${i}` }));

describe("lecteurDepuisEntree (C1-U4)", () => {
  it("historique = recents, profil repris", () => {
    const e = entree();
    const l = lecteurDepuisEntree(e);
    expect(l.historique).toEqual(e.recents);
    expect(l.profil).toBe(e.profil);
  });
  it("choisir du lecteur = choisir direct avec la graine par défaut", () => {
    const e = entree();
    const direct = choisir(e.profil, { capacite: A, nombre: 2, graine: graineDe(e.graine, A) }, cands, e.recents, []);
    expect(lecteurDepuisEntree(e).choisir({ capacite: A, nombre: 2 }, cands)).toEqual(direct);
  });
  it("une graine explicite l'emporte", () => {
    const e = entree();
    const direct = choisir(e.profil, { capacite: A, nombre: 2, graine: "X" }, cands, e.recents, []);
    expect(lecteurDepuisEntree(e).choisir({ capacite: A, nombre: 2, graine: "X" }, cands)).toEqual(direct);
  });
  it("entree.choix compte comme déjà choisi", () => {
    const e = entree({ profil: { ...entree().profil, capacites: { [A]: { permis: true, maxParVideo: 1 } } }, choix: [{ capacite: A, cle: "k5" }] });
    const r = lecteurDepuisEntree(e).choisir({ capacite: A }, cands);
    expect(!r.ok && r.raison).toBe("plafond-atteint");
  });
  it("entrée figée non modifiée", () => {
    const e = Object.freeze(entree());
    expect(() => lecteurDepuisEntree(e).choisir({ capacite: A }, cands)).not.toThrow();
  });
});
