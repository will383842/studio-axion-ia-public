"use client";

import {
  arreterToutAction,
  changerModeZernioAction,
  changerRoutageZernioAction,
  lireConnexionsZernioAction,
  reprendreToutAction,
  testerComptesZernioAction,
  type ServicesZernio,
} from "@/app/(studio)/reglages/actions-zernio";
import { ConnexionsZernio } from "@/components/reglages/Connexions";

/** Les vraies actions serveur (chacune commence par exigerSession) branchées sur l'écran « Connexions Zernio ». */
const SERVICES: ServicesZernio = {
  lire: lireConnexionsZernioAction,
  tester: testerComptesZernioAction,
  changerRoutage: changerRoutageZernioAction,
  changerMode: changerModeZernioAction,
  arreter: arreterToutAction,
  reprendre: reprendreToutAction,
};

export function ConnexionsZernioReglages() {
  return <ConnexionsZernio services={SERVICES} />;
}
