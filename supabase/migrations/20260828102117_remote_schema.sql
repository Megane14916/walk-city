alter default privileges for role "postgres" in schema "public" revoke all on sequences from "anon";

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "authenticated";

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "service_role";

create table "public"."building_effects" (
  "id"                 uuid    not null default gen_random_uuid(),
  "building_type_code" text    not null,
  "effect_type"        text    not null,
  "value"              numeric,
  "target_category"    text,
  "scope"              text,
  "stacking_rule"      text,
  "metadata"           jsonb,
  constraint "building_effects_pkey" primary key (id)
);

alter table "public"."building_effects"
  enable row level security;

create table "public"."building_types" (
  "code"            text     not null,
  "name"            text     not null,
  "category"        text     not null default 'other'::text,
  "width"           smallint not null default '1'::smallint,
  "height"          smallint not null default '1'::smallint,
  "cost_coins"      bigint,
  "description"     text     not null default 'None'::text,
  "enabled"         boolean  not null default false,
  "catalog_version" integer  not null default 1,
  constraint "building_types_pkey" primary key (code)
);

alter table "public"."building_types"
  enable row level security;

create table "public"."coin_ledger" (
  "id"              uuid                     not null default gen_random_uuid(),
  "town_id"         uuid                     not null default gen_random_uuid(),
  "amount"          bigint                   not null,
  "reason"          text                     not null,
  "idempotency_key" text                     not null,
  "created_at"      timestamp with time zone not null default now(),
  "metadata"        json                     not null,
  constraint "coin_ledger_idempotency_key_key" unique (idempotency_key),
  constraint "coin_ledger_pkey" primary key (id)
);

alter table "public"."coin_ledger"
  enable row level security;

create table "public"."daily_step_records" (
  "id"             uuid                     not null default gen_random_uuid(),
  "user_id"        uuid                     not null,
  "step_date"      date                     not null,
  "steps"          integer                  not null default 0,
  "rewarded_steps" integer                  not null default 0,
  "source"         text                     not null,
  "synced_at"      timestamp with time zone not null default now(),
  constraint "daily_step_records_pkey" primary key (id)
);

alter table "public"."daily_step_records"
  enable row level security;

create table "public"."placed_buildings" (
  "id"                  uuid                     not null default gen_random_uuid(),
  "town_id"             uuid                     not null,
  "building_type_code"  text                     not null,
  "anchor_x"            smallint                 not null,
  "anchor_y"            smallint                 not null,
  "purchase_cost_coins" bigint                   not null,
  "created_at"          timestamp with time zone not null default now(),
  "updated_at"          timestamp with time zone not null default now(),
  constraint "placed_buildings_pkey" primary key (id)
);

alter table "public"."placed_buildings"
  enable row level security;

create table "public"."profiles" (
  "id"           uuid                     not null,
  "display_name" text                     not null,
  "created_at"   timestamp with time zone not null default now(),
  "updated_at"   timestamp with time zone not null default now(),
  constraint "profiles_pkey" primary key (id)
);

alter table "public"."profiles"
  enable row level security;

create table "public"."towns" (
  "town_id"    uuid                     not null default gen_random_uuid(),
  "owner_id"   uuid                     not null,
  "name"       text                     not null,
  "coins"      bigint                   not null default '0'::bigint,
  "population" bigint                   not null default '0'::bigint,
  "map_width"  smallint                 not null default '100'::smallint,
  "map_height" smallint                 not null default '100'::smallint,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  constraint "towns_owner_id_key" unique (owner_id),
  constraint "towns_pkey" primary key (town_id)
);

alter table "public"."towns"
  enable row level security;

create table "public"."unlocked_areas" (
  "town_id"       uuid     not null,
  "width"         smallint not null,
  "height"        smallint not null,
  "unlocked_at"   text     not null,
  "unlock_method" text,
  constraint "unlocked_areas_pkey" primary key (town_id)
);

alter table "public"."unlocked_areas"
  enable row level security;

alter table "public"."building_effects"
  add constraint "building_effects_building_type_code_fkey" foreign key (building_type_code) references public.building_types(code);

alter table "public"."placed_buildings"
  add constraint "placed_buildings_building_type_code_fkey" foreign key (building_type_code) references public.building_types(code);

alter table "public"."profiles"
  add constraint "profiles_id_fkey" foreign key (id) references auth.users(id);

alter table "public"."daily_step_records"
  add constraint "daily_step_records_user_id_fkey" foreign key (user_id) references public.profiles(id);

alter table "public"."towns"
  add constraint "towns_owner_id_fkey" foreign key (owner_id) references public.profiles(id);

alter table "public"."coin_ledger"
  add constraint "coin_ledger_town_id_fkey" foreign key (town_id) references public.towns(town_id);

alter table "public"."placed_buildings"
  add constraint "placed_buildings_town_id_fkey" foreign key (town_id) references public.towns(town_id);

alter table "public"."unlocked_areas"
  add constraint "unlocked_areas_town_id_fkey" foreign key (town_id) references public.towns(town_id);

grant maintain, references, trigger, truncate on table "public"."building_effects" to "anon", "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."building_effects" to "postgres";

grant maintain, references, trigger, truncate on table "public"."building_effects" to "service_role";

grant maintain, references, trigger, truncate on table "public"."building_types" to "anon", "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."building_types" to "postgres";

grant maintain, references, trigger, truncate on table "public"."building_types" to "service_role";

grant maintain, references, trigger, truncate on table "public"."coin_ledger" to "anon", "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."coin_ledger" to "postgres";

grant maintain, references, trigger, truncate on table "public"."coin_ledger" to "service_role";

grant maintain, references, trigger, truncate on table "public"."daily_step_records" to "anon", "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."daily_step_records" to "postgres";

grant maintain, references, trigger, truncate on table "public"."daily_step_records" to "service_role";

grant maintain, references, trigger, truncate on table "public"."placed_buildings" to "anon", "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."placed_buildings" to "postgres";

grant maintain, references, trigger, truncate on table "public"."placed_buildings" to "service_role";

grant maintain, references, trigger, truncate on table "public"."profiles" to "anon", "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."profiles" to "postgres";

grant maintain, references, trigger, truncate on table "public"."profiles" to "service_role";

grant maintain, references, trigger, truncate on table "public"."towns" to "anon", "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."towns" to "postgres";

grant maintain, references, trigger, truncate on table "public"."towns" to "service_role";

grant maintain, references, trigger, truncate on table "public"."unlocked_areas" to "anon", "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."unlocked_areas" to "postgres";

grant maintain, references, trigger, truncate on table "public"."unlocked_areas" to "service_role";

