/**
 * GV2-36 · Les contrôles avancent pas à pas : une transcription « en cours » rend la main (attente), ce qui est déjà
 * obtenu reste dans l'état (rien n'est redemandé ni repayé), et le verdict final est celui d'une exécution sans attente.
 * Doubles du monde, rien n'est payé.
 */
import { describe, expect, it, vi } from "vitest";
import { attendWillIV, avancerJusquAArretIV, etatInitialIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { RenduEnCoursIV } from "@/moteurs/montage-image-video/fabrication";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

/** Mène l'état jusqu'à une arrivée ou un refus, en reprenant après chaque attente ; compte les attentes. */
async function mener(e0: EtatFabricationIV, o: OutilsFabricationIV): Promise<{ e: EtatFabricationIV; attentes: number }> {
  let e = await avancerJusquAArretIV(e0, o);
  let attentes = 0;
  for (let i = 0; i < 40 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) {
      attentes++;
      e = await avancerJusquAArretIV(e, o);
    } else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
    else if (attendWillIV(e) === "script") {
      const choixFormules = Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const]));
      e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules }), o);
    } else break;
  }
  return { e, attentes };
}

describe("GV2-36 · contrôles pas à pas", () => {
  it("transcription « en cours » deux fois : deux attentes, même verdict, aucune réservation en double", async () => {
    const carte = carteFixe("C");
    const mRef = monde();
    const ref = await mener(etatInitialIV(demandeEssai(carte)), outilsSimules(carte, mRef));

    const m = monde();
    const base = outilsSimules(carte, m);
    let restantes = 2;
    const o: OutilsFabricationIV = {
      ...base,
      controles: {
        ...base.controles,
        transcrire: async (d) => {
          if (restantes > 0) {
            restantes--;
            throw new RenduEnCoursIV("La transcription de la voix");
          }
          return base.controles.transcrire(d);
        },
      },
    };
    const { e, attentes } = await mener(etatInitialIV(demandeEssai(carte)), o);
    expect(e.etape).toBe(ref.e.etape);
    expect(attentes - ref.attentes).toBe(2);
    expect(e.controles?.verdict).toEqual(ref.e.controles?.verdict);
    expect(m.transcriptions.length).toBe(mRef.transcriptions.length);
    const cles = e.caisse.reservations.map((r) => r.cle);
    expect(new Set(cles).size).toBe(cles.length);
    expect(cles.length).toBe(ref.e.caisse.reservations.length);
  });

  it("une transcription obtenue n'est pas redemandée au tour suivant", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const { e, attentes } = await mener(etatInitialIV(demandeEssai(carte)), outilsSimules(carte, m));
    expect(e.etape).toBe("prete");
    // Une transcription par piste (empreinte) ; jamais deux fois la même, même si la main est rendue entre deux.
    expect(new Set(m.transcriptions).size).toBe(m.transcriptions.length);
    expect(m.transcriptions.length).toBe(Object.keys(e.controles!.transcriptions).length);
    expect(attentes).toBeGreaterThanOrEqual(0);
  });

  it("l'attente de la deuxième transcription garde la première dans l'état", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const base = outilsSimules(carte, m);
    let appels = 0;
    let declenche = false;
    const o: OutilsFabricationIV = {
      ...base,
      controles: {
        ...base.controles,
        transcrire: async (d) => {
          appels++;
          if (appels === 2 && !declenche) {
            declenche = true;
            throw new RenduEnCoursIV("La transcription de la voix");
          }
          return base.controles.transcrire(d);
        },
      },
    };
    let gardees = -1;
    let e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte)), o);
    for (let i = 0; i < 40 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
      if (e.attente && e.etape === "controles" && gardees < 0) gardees = Object.keys(e.controles?.transcriptions ?? {}).length;
      if (e.attente) e = await avancerJusquAArretIV(e, o);
      else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
      else if (attendWillIV(e) === "script") {
        const choixFormules = Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const]));
        e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules }), o);
      } else break;
    }
    expect(e.etape).toBe("prete");
    expect(gardees).toBeGreaterThanOrEqual(1);
  });

  it("extraction des images « en cours » : attente, puis relecture faite (jamais « images finales non relues »)", async () => {
    const carte = carteFixe("C");
    const ref = await mener(etatInitialIV(demandeEssai(carte)), outilsSimules(carte, monde()));
    const base = outilsSimules(carte, monde());
    let restantes = 1;
    const o: OutilsFabricationIV = {
      ...base,
      controles: {
        ...base.controles,
        extraireImages: async (d) => {
          if (restantes > 0) {
            restantes--;
            throw new RenduEnCoursIV("L'extraction des images de contrôle");
          }
          return base.controles.extraireImages(d);
        },
      },
    };
    const { e, attentes } = await mener(etatInitialIV(demandeEssai(carte)), o);
    expect(attentes - ref.attentes).toBe(1);
    expect(e.controles?.relectures).toEqual(ref.e.controles?.relectures);
    expect(e.controles?.verdict).toEqual(ref.e.controles?.verdict);
    expect(e.controles?.verdict?.mentions.join(" ")).not.toMatch(/images finales non relues/);
  });
});
