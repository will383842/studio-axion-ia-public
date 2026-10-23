import type { CasConcret } from "../cas";
import { alerteCourte } from "./alerte-courte";
import { auditDepartement } from "./audit-departement";
import { autofactureFormateurs } from "./autofacture-formateurs";
import { compteRenduVisio } from "./compte-rendu-visio";
import { crmQuiNote } from "./crm-qui-note";
import { cvTries } from "./cv-tries";
import { cycleDeFormation } from "./cycle-de-formation";
import { devisRelances } from "./devis-relances";
import { diagnosticGratuit } from "./diagnostic-gratuit";
import { documentsFormation } from "./documents-formation";
import { dossierLaisseRelance } from "./dossier-laisse-relance";
import { outilsBranches } from "./outils-branches";
import { programmeParIa } from "./programme-par-ia";
import { rendezVousClasses } from "./rendez-vous-classes";
import { articlesBlog } from "./articles-blog";
import { auditUneJournee } from "./audit-une-journee";
import { compteRenduDicte } from "./compte-rendu-dicte";
import { contactVersCrm } from "./contact-vers-crm";
import { devisSigneAlerte } from "./devis-signe-alerte";
import { emailDifficile } from "./email-difficile";
import { rappelsRendezVous } from "./rappels-rendez-vous";
import { recrutementApporteurs } from "./recrutement-apporteurs";

/**
 * Les 22 cas TypeScript du catalogue (un fichier de données par cas) : les huit de master, dans leur ordre, puis les quatorze
 * de la phase 2 dans l'ordre du brouillon (portage de #167, sans `article-publie` : `articles-blog` est le cas « articles »).
 * Liste à part de `index.ts` pour que le chargeur du stock (`../stock-metiers`) connaisse les ids et les mots déjà pris sans
 * cycle d'import. Ne bouge pas : l'empreinte de ces cas doit rester la même.
 */
export const CATALOGUE_TS: readonly CasConcret[] = [
  recrutementApporteurs, rappelsRendezVous, emailDifficile, compteRenduDicte, auditUneJournee, contactVersCrm, devisSigneAlerte, articlesBlog,
  cycleDeFormation, programmeParIa, auditDepartement, diagnosticGratuit, dossierLaisseRelance, documentsFormation, autofactureFormateurs,
  devisRelances, cvTries, alerteCourte, outilsBranches, crmQuiNote, compteRenduVisio, rendezVousClasses,
];
