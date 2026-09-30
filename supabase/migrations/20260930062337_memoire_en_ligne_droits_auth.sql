-- Étape 9 — le service d'authentification de Supabase (rôle
-- `supabase_auth_admin`) crée les comptes : on lui donne explicitement le
-- droit d'exécuter la vérification d'invitation déclenchée à la création,
-- par précaution (sans ce droit, aucune inscription, même invitée, ne
-- passerait si le serveur le vérifiait).
grant usage on schema prive to supabase_auth_admin;
grant execute on function prive.verifier_invitation() to supabase_auth_admin;
