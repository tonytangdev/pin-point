\restrict 4HZnLc71iXA6HdhYh0qpIwlHE67dldZZfNZJ7qiPbXBlNwUsqJ0Oz8ABgUqSEiP

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

\unrestrict 4HZnLc71iXA6HdhYh0qpIwlHE67dldZZfNZJ7qiPbXBlNwUsqJ0Oz8ABgUqSEiP

\restrict cXBUHkDVgdXr4EsEFjLt5w9CHuWSvaSuU8RcFno6hIYoU71ARyHohJrJyckPHxo

INSERT INTO public.effect_sql_migrations (migration_id, created_at, name) VALUES (1, '2026-04-08 21:48:02.566372+00', 'create_comments');

\unrestrict cXBUHkDVgdXr4EsEFjLt5w9CHuWSvaSuU8RcFno6hIYoU71ARyHohJrJyckPHxo