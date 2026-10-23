/**
 * Budget INDICATIF · Cas concret : la part « voix » du prix confirmé n'arrête plus la voix en mode indicatif ; elle est
 * remplacée par un compteur de lectures (3 au plus par texte et par tentative, comme `lecturesVoixMax` de l'avocat).
 * Mode bloquant : contrôle par montant inchangé.
 */
import { describe, expect, it } from "vitest";
import { ErreurFabricationCasConcret, LECTURES_VOIX_MAX_INDICATIF, verifierPartVoix } from "@/moteurs/montage-cas-concret/fabriquer";

const payee = (prise: string, lecture: number, coutCentimes = 10) => ({ prise, lecture, empreinte: `e-${prise}-${lecture}`, caracteres: 100, coutCentimes, fournisseur: "heygen" });
const plafond = { centimes: 25, prixLecture: () => 10 };
const lecture = { prise: "corps", texte: "Bonjour" };

describe("verifierPartVoix", () => {
  it("bloquant : 30 > 25 → refus", () => {
    const deja = [payee("corps", 1), payee("fin-a", 1)];
    expect(() => verifierPartVoix({ plafondVoix: { centimes: 25, prixLecture: () => 10 } }, deja, lecture)).toThrow(ErreurFabricationCasConcret);
  });

  it("indicatif : le montant ne refuse plus, même largement dépassé", () => {
    const deja = [payee("corps", 1, 500)];
    expect(() => verifierPartVoix({ plafondVoix: plafond, indicatif: { lecturesVoixMax: LECTURES_VOIX_MAX_INDICATIF } }, deja, lecture)).not.toThrow();
  });

  it("indicatif : 3 lectures au plus par texte : la 2e est permise, la 4e refusée", () => {
    const indicatif = { lecturesVoixMax: LECTURES_VOIX_MAX_INDICATIF };
    expect(LECTURES_VOIX_MAX_INDICATIF).toBe(3);
    expect(() => verifierPartVoix({ indicatif }, [payee("corps", 1)], lecture)).not.toThrow();
    expect(() => verifierPartVoix({ indicatif }, [payee("corps", 1), payee("corps", 2)], lecture)).not.toThrow();
    expect(() => verifierPartVoix({ indicatif }, [payee("corps", 1), payee("corps", 2), payee("corps", 3)], lecture)).toThrow(ErreurFabricationCasConcret);
  });

  it("indicatif : le compteur est par texte (une autre prise garde ses 3 lectures)", () => {
    const indicatif = { lecturesVoixMax: 3 };
    const deja = [payee("corps", 1), payee("corps", 2), payee("corps", 3)];
    expect(() => verifierPartVoix({ indicatif }, deja, { prise: "fin-a", texte: "Merci" })).not.toThrow();
  });
});
