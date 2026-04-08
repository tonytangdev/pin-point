\restrict OQwDFbRkIkl4PMxHXVhPPekdIovqP7vbanXD6BZFbTV7YTvVBpbDdF5PHtXjuh0

CREATE TABLE public.comments (
    id text NOT NULL,
    url text NOT NULL,
    content text NOT NULL,
    anchor jsonb NOT NULL,
    viewport jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.effect_sql_migrations (
    migration_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL
);

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.effect_sql_migrations
    ADD CONSTRAINT effect_sql_migrations_pkey PRIMARY KEY (migration_id);

CREATE INDEX idx_comments_url ON public.comments USING btree (url);

\unrestrict OQwDFbRkIkl4PMxHXVhPPekdIovqP7vbanXD6BZFbTV7YTvVBpbDdF5PHtXjuh0

\restrict CaqD2xIiBUXVZJgmxMY0EzaKYdPkpaEJA5ZonT2iBmK2D1Kj1BHypeFhmFT3cUT

INSERT INTO public.effect_sql_migrations (migration_id, created_at, name) VALUES (1, '2026-04-08 21:46:48.00383+00', 'create_comments');

\unrestrict CaqD2xIiBUXVZJgmxMY0EzaKYdPkpaEJA5ZonT2iBmK2D1Kj1BHypeFhmFT3cUT