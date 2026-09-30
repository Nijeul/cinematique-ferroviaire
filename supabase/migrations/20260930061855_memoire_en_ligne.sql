-- Étape 9 — mémoire en ligne : équipe sur invitation, chantiers partagés,
-- fonds de plan dans un espace de stockage privé.
--
-- Règles :
--   * « membre » = l'adresse e-mail du compte connecté figure dans la liste
--     `public.membres` (sans tenir compte des majuscules) ;
--   * un membre lit et modifie tous les chantiers et tous les fonds ;
--   * une personne non invitée ne peut pas créer de compte, et un compte qui
--     n'est pas (ou plus) membre ne voit rien et ne peut rien écrire ;
--   * le rôle `anon` (visiteur non connecté) n'a accès à rien.

-- Fonctions internes, hors du schéma exposé par l'API.
create schema if not exists prive;
revoke all on schema prive from public;
grant usage on schema prive to authenticated;

-- ——— Membres de l'équipe (liste d'invitation) ———

create table public.membres (
  email text primary key
    constraint membres_email_valide check (email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  invite_par text,
  invite_le timestamptz not null default now()
);
comment on table public.membres is 'Adresses e-mail invitées dans l''équipe : elles seules peuvent créer un compte et voir les chantiers.';

alter table public.membres enable row level security;
revoke all on table public.membres from anon;

-- Le compte connecté est-il membre ? `security definer` : la liste est lue
-- sans passer par ses propres règles d'accès (sinon elles s'appelleraient
-- elles-mêmes).
create function prive.est_membre()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membres m
    where m.email = lower((select auth.jwt()) ->> 'email')
  );
$$;
revoke all on function prive.est_membre() from public;
grant execute on function prive.est_membre() to authenticated;

-- Une invitation : adresse en minuscules, invitée par le compte connecté,
-- datée par le serveur (rien de tout cela ne vient du navigateur).
create function prive.preparer_membre()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  new.invite_par := lower((select auth.jwt()) ->> 'email');
  new.invite_le := now();
  return new;
end;
$$;
revoke all on function prive.preparer_membre() from public;

create trigger preparer_membre
  before insert on public.membres
  for each row execute function prive.preparer_membre();

-- On ne retire jamais le dernier membre (ni soi-même quand on est seul).
create function prive.garder_un_membre()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.membres) then
    raise exception 'Impossible de retirer le dernier membre de l''équipe.'
      using errcode = 'P0001';
  end if;
  return null;
end;
$$;
revoke all on function prive.garder_un_membre() from public;

create trigger garder_un_membre
  after delete on public.membres
  for each statement execute function prive.garder_un_membre();

create policy "membres : lecture par les membres" on public.membres
  for select to authenticated using ((select prive.est_membre()));
create policy "membres : invitation par un membre" on public.membres
  for insert to authenticated with check ((select prive.est_membre()));
create policy "membres : retrait par un membre" on public.membres
  for delete to authenticated using ((select prive.est_membre()));

-- Création de compte refusée pour une adresse non invitée.
create function prive.verifier_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null
     or not exists (select 1 from public.membres m where m.email = lower(new.email)) then
    raise exception 'Cette adresse n''a pas été invitée. Demandez à un membre de l''équipe de vous inviter.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function prive.verifier_invitation() from public;

create trigger verifier_invitation
  before insert on auth.users
  for each row execute function prive.verifier_invitation();

-- ——— Chantiers ———
-- `donnees` : le chantier entier, sans les images de fond (remplacées par
-- une référence vers le stockage). `version` augmente à chaque
-- enregistrement : le navigateur n'écrit que si la version n'a pas changé
-- depuis sa dernière lecture (sinon, un collègue a modifié le chantier).

create table public.chantiers (
  id text primary key constraint chantiers_id_valide check (id ~ '^[A-Za-z0-9_-]{1,100}$'),
  nom text not null,
  donnees jsonb not null,
  nb_plans integer not null default 0,
  nb_synoptiques integer not null default 0,
  version integer not null default 1,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  modifie_par text
);
comment on table public.chantiers is 'Chantiers de l''équipe (sans les images de fond, rangées dans le stockage « fonds »).';

alter table public.chantiers enable row level security;
revoke all on table public.chantiers from anon;

-- Version, date et auteur posés par le serveur.
create function prive.dater_chantier()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
    new.cree_le := now();
  else
    if new.id <> old.id then
      raise exception 'L''identifiant d''un chantier ne change pas.' using errcode = '22023';
    end if;
    new.version := old.version + 1;
    new.cree_le := old.cree_le;
  end if;
  new.modifie_le := now();
  new.modifie_par := lower((select auth.jwt()) ->> 'email');
  return new;
end;
$$;
revoke all on function prive.dater_chantier() from public;

create trigger dater_chantier
  before insert or update on public.chantiers
  for each row execute function prive.dater_chantier();

create policy "chantiers : lecture par les membres" on public.chantiers
  for select to authenticated using ((select prive.est_membre()));
create policy "chantiers : création par les membres" on public.chantiers
  for insert to authenticated with check ((select prive.est_membre()));
create policy "chantiers : modification par les membres" on public.chantiers
  for update to authenticated using ((select prive.est_membre())) with check ((select prive.est_membre()));
create policy "chantiers : suppression par les membres" on public.chantiers
  for delete to authenticated using ((select prive.est_membre()));

-- ——— Fonds de plan ———
-- Espace privé : un fichier par image, rangé sous `<id du chantier>/<empreinte>`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fonds', 'fonds', false, 52428800, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

create policy "fonds : lecture par les membres" on storage.objects
  for select to authenticated using (bucket_id = 'fonds' and (select prive.est_membre()));
create policy "fonds : envoi par les membres" on storage.objects
  for insert to authenticated with check (bucket_id = 'fonds' and (select prive.est_membre()));
create policy "fonds : suppression par les membres" on storage.objects
  for delete to authenticated using (bucket_id = 'fonds' and (select prive.est_membre()));

-- ——— Premier membre : le commanditaire ———
insert into public.membres (email) values ('julien-paulais@hotmail.fr');
