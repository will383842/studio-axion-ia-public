import { describe, expect, it } from "vitest";
import { etatCapacite } from "@/briques/bibliotheque-video/catalogue";
import { PREFIXE_COULISSE_V4 } from "@/briques/bibliotheque-video/noms";
import { appliquerReglage } from "@/briques/bibliotheque-video/permissions";
import { profilDuFormat } from "@/briques/bibliotheque-video/profils";
import type { ReglageBibliotheque } from "@/briques/bibliotheque-video/reglage";
import type { IdCapacite, ProfilVideo } from "@/briques/bibliotheque-video/types";

const reglage = (...c: string[]): ReglageBibliotheque => ({ actif: true, capacites: c as IdCapacite[] });
const instantane = (p: ProfilVideo) => JSON.stringify(p);

describe("appliquerReglage", () => {
  it("liste vide : profil tel quel", () => {
    const p = profilDuFormat("cas-concret");
    expect(appliquerReglage(p, reglage())).toEqual(p);
    expect(appliquerReglage(p, { actif: false })).toEqual(p);
  });

  it("capacité connue et non verrouillée : permise, nouvel objet, profil du code inchangé", () => {
    const p = profilDuFormat("cas-concret");
    const avant = instantane(p);
    const r = appliquerReglage(p, reglage("texte.surlignage-marqueur"));
    expect(r.capacites["texte.surlignage-marqueur"]).toEqual({ permis: true, maxParVideo: 1, decision: "S1, Q3" });
    expect(r).not.toBe(p);
    expect(instantane(p)).toBe(avant);
    expect(p.capacites["texte.surlignage-marqueur"]?.permis).toBe(false);
  });

  it("inconnue du profil : ignorée, jamais ajoutée", () => {
    const r = appliquerReglage(profilDuFormat("cas-concret"), reglage("texte.inconnue-du-profil"));
    expect(r.capacites["texte.inconnue-du-profil" as IdCapacite]).toBeUndefined();
  });

  it("coulisse, absent, verrouillée (id ou famille) : ignorées", () => {
    const base = profilDuFormat("cas-concret");
    const coulisse = `${PREFIXE_COULISSE_V4}LogoOutil` as IdCapacite;
    expect(etatCapacite(coulisse)).toBe("coulisse");
    const profil: ProfilVideo = {
      ...base,
      capacites: { ...base.capacites, [coulisse]: { permis: false }, "calque.texte-derriere-double": { permis: false }, "etalonnage.lut-clair-obscur": { permis: false } },
      verrous: ["etalonnage", "texte.surlignage-marqueur"],
    };
    expect(profil.verrous).not.toContain(coulisse);
    const seule = appliquerReglage(profil, reglage(coulisse));
    expect(seule.capacites[coulisse]?.permis).toBe(false);
    const r = appliquerReglage(profil, reglage(coulisse, "calque.texte-derriere-double", "etalonnage.lut-clair-obscur", "texte.surlignage-marqueur"));
    expect(r.capacites).toEqual(profil.capacites);
  });

  it("facecam-animee : etalonnage.* verrouillé", () => {
    const p = profilDuFormat("facecam-animee");
    const ids = Object.keys(p.capacites).filter((i) => i.startsWith("etalonnage."));
    const r = appliquerReglage(p, reglage(...ids));
    expect(r.capacites).toEqual(p.capacites);
  });

  it("ne lève jamais", () => {
    expect(() => appliquerReglage(profilDuFormat("avocat"), { actif: true, capacites: null as never })).not.toThrow();
  });
});
