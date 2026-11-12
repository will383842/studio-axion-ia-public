# CAL-07 : moteur calculerManques (final, 12/11/2026)
- Fait : src/domaine/calendrier/manques.ts (fonction pure ; créneau vide, texte, premier commentaire, visuel non validé ; jamais bloquant). Test rouge d'abord (import absent), puis vert. Test : tests/calendrier/cal-07-manques.test.ts (22 cas).
- Tests : tests/calendrier + tests/cadence : 21 fichiers, 325 passés, 0 échoué ; tsc et eslint propres sur les 2 fichiers. Suite complète non lancée (consigne).
- Critère « fonction pure » : tenu, test « est pure » (l.16). Critère « 12 cas dont TikTok sans commentaire, quota 0, passé exclu, LinkedIn week-end, écart 24 h » : tenu, 22 cas (TikTok l.65, quota 0 l.83, passé l.47, week-end l.34-42, 24 h l.99).
- Critère « jamais un blocage » : tenu, test « jamais un blocage » (bloquant = false, même urgent).
- CORRECTIFS : calcul DANS le Studio, sans code de l'usine (tenu : aucun import hors Studio) ; C3 7 jours à venir, jamais le passé (tenu) ; C5 carrousel LinkedIn remplit le créneau (tenu).
- Maquette : jours attendus LinkedIn/Facebook lun-ven, Instagram tous, TikTok aucun ; « Il manque le texte » ; pas de premier commentaire sur TikTok. Quota des réglages = plafond : 0 = aucun créneau attendu.
- Douteux : C4 de la fiche dit « bloquant » pour le visuel non validé à moins de 24 h ; le critère 3 interdit tout blocage, donc rendu « urgent » avec bloquant = false. PILOTAGE : à trancher par le fondateur. Brancher dans l'écran = autre fiche.
- Test autorisé d'office : non utilisé (chemin déjà dans la fiche).
- contrôle anti-fuite : vide
