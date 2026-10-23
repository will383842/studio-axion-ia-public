/**
 * Registre des objets redessinés (banque fermée, plan § 6.2) : un composant par identifiant. Un identifiant absent
 * fait échouer le typage (la table est complète par construction).
 */
import type { ComponentType } from "react";
import type { IdObjet } from "../../../../src/briques/ecrans-motion";
import type { ProprietesObjet } from "../plans/commun";
import { TelephoneCapture } from "./TelephoneCapture";
import { TelephoneNotification } from "./TelephoneNotification";
import { PileNotifications } from "./PileNotifications";
import { Chrono } from "./Chrono";
import { ContratSignature } from "./ContratSignature";
import { DossierClasse } from "./DossierClasse";
import { BouclierCoche } from "./BouclierCoche";
import { ChampCommentaire } from "./ChampCommentaire";
import { BulleLien } from "./BulleLien";
import { ListeTaches } from "./ListeTaches";
import { BarresAvantApres } from "./BarresAvantApres";
import { Calendrier } from "./Calendrier";
import { Programme } from "./Programme";
import { Rapport } from "./Rapport";
import { CarteTaches } from "./CarteTaches";
import { OutilsRelies } from "./OutilsRelies";
import { EMail } from "./EMail";

export const OBJETS: Readonly<Record<IdObjet, ComponentType<ProprietesObjet>>> = Object.freeze({
  "telephone-capture": TelephoneCapture,
  "telephone-notification": TelephoneNotification,
  "pile-notifications": PileNotifications,
  "chrono": Chrono,
  "contrat-signature": ContratSignature,
  "dossier-classe": DossierClasse,
  "bouclier-coche": BouclierCoche,
  "champ-commentaire": ChampCommentaire,
  "bulle-lien": BulleLien,
  "liste-taches": ListeTaches,
  "barres-avant-apres": BarresAvantApres,
  "calendrier": Calendrier,
  "programme": Programme,
  "rapport": Rapport,
  "carte-taches": CarteTaches,
  "outils-relies": OutilsRelies,
  "e-mail": EMail,
});
