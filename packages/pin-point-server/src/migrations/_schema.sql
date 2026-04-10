\restrict gkthbSvqIt3WaVKOfIRjAYESzhxfcig2myckNGbzcbtbQdIgDeCPzPaRyiwqdmc

CREATE TABLE public.comments (
    id text NOT NULL,
    url text NOT NULL,
    content text NOT NULL,
    anchor jsonb NOT NULL,
    viewport jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL,
    token_id text,
    author_name text,
    author_id text
);

CREATE TABLE public.effect_sql_migrations (
    migration_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL
);

CREATE TABLE public.tokens (
    id text NOT NULL,
    label text,
    created_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone
);

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.effect_sql_migrations
    ADD CONSTRAINT effect_sql_migrations_pkey PRIMARY KEY (migration_id);

ALTER TABLE ONLY public.tokens
    ADD CONSTRAINT tokens_pkey PRIMARY KEY (id);

CREATE INDEX idx_comments_url ON public.comments USING btree (url);

CREATE INDEX idx_tokens_active ON public.tokens USING btree (id) WHERE (revoked_at IS NULL);

\unrestrict gkthbSvqIt3WaVKOfIRjAYESzhxfcig2myckNGbzcbtbQdIgDeCPzPaRyiwqdmc

\restrict 5iZOAUPgdranEpZMMVfs8xjAkenBzYOqSp55ry3oGlRlLEWmN0atUn56IfcTz5E

INSERT INTO public.effect_sql_migrations (migration_id, created_at, name) VALUES (1, '2026-04-08 21:46:48.00383+00', 'create_comments');
INSERT INTO public.effect_sql_migrations (migration_id, created_at, name) VALUES (2, '2026-04-10 14:39:20.513996+00', 'add_auth');

\unrestrict 5iZOAUPgdranEpZMMVfs8xjAkenBzYOqSp55ry3oGlRlLEWmN0atUn56IfcTz5E