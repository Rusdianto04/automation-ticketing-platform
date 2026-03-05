--
-- PostgreSQL database dump
--

\restrict VlwzBai4EHeACVLO3Xi5fXTbYpQQFZsP7g3ioyvbI1Q7Yea5IPLqmbNBzdvKTCs

-- Dumped from database version 15.16 (Debian 15.16-1.pgdg13+1)
-- Dumped by pg_dump version 15.16 (Debian 15.16-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: Hook; Type: TYPE; Schema: public; Owner: peppermint
--

CREATE TYPE public."Hook" AS ENUM (
    'ticket_created',
    'ticket_status_changed'
);


ALTER TYPE public."Hook" OWNER TO peppermint;

--
-- Name: Template; Type: TYPE; Schema: public; Owner: peppermint
--

CREATE TYPE public."Template" AS ENUM (
    'ticket_created',
    'ticket_status_changed',
    'ticket_assigned',
    'ticket_comment'
);


ALTER TYPE public."Template" OWNER TO peppermint;

--
-- Name: TicketStatus; Type: TYPE; Schema: public; Owner: peppermint
--

CREATE TYPE public."TicketStatus" AS ENUM (
    'needs_support',
    'in_progress',
    'in_review',
    'done',
    'hold'
);


ALTER TYPE public."TicketStatus" OWNER TO peppermint;

--
-- Name: TicketType; Type: TYPE; Schema: public; Owner: peppermint
--

CREATE TYPE public."TicketType" AS ENUM (
    'bug',
    'feature',
    'support',
    'incident',
    'service',
    'maintenance',
    'access',
    'feedback'
);


ALTER TYPE public."TicketType" OWNER TO peppermint;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Client; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."Client" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "contactName" text NOT NULL,
    number text,
    notes text,
    active boolean DEFAULT true NOT NULL
);


ALTER TABLE public."Client" OWNER TO peppermint;

--
-- Name: Comment; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."Comment" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    text text NOT NULL,
    public boolean DEFAULT false NOT NULL,
    "userId" text,
    "ticketId" text NOT NULL,
    reply boolean DEFAULT false NOT NULL,
    "replyEmail" text,
    edited boolean DEFAULT false NOT NULL,
    "editedAt" timestamp(3) without time zone,
    previous text
);


ALTER TABLE public."Comment" OWNER TO peppermint;

--
-- Name: Config; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."Config" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notifications jsonb,
    client_version text,
    feature_previews boolean DEFAULT false NOT NULL,
    gh_version text,
    sso_active boolean DEFAULT false NOT NULL,
    sso_provider text,
    first_time_setup boolean DEFAULT true NOT NULL,
    encryption_key bytea,
    roles_active boolean DEFAULT false NOT NULL
);


ALTER TABLE public."Config" OWNER TO peppermint;

--
-- Name: Discord; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."Discord" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name text NOT NULL,
    secret text,
    url text NOT NULL,
    active boolean DEFAULT false NOT NULL
);


ALTER TABLE public."Discord" OWNER TO peppermint;

--
-- Name: Email; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."Email" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    active boolean DEFAULT false NOT NULL,
    "user" text NOT NULL,
    pass text,
    secure boolean DEFAULT false NOT NULL,
    host text NOT NULL,
    reply text NOT NULL,
    port text NOT NULL,
    "clientId" text,
    "clientSecret" text,
    "refreshToken" text,
    "serviceType" text DEFAULT 'other'::text NOT NULL,
    "tenantId" text,
    "accessToken" text,
    "expiresIn" bigint,
    "redirectUri" text
);


ALTER TABLE public."Email" OWNER TO peppermint;

--
-- Name: EmailQueue; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."EmailQueue" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name text NOT NULL,
    username text NOT NULL,
    password text,
    hostname text NOT NULL,
    tls boolean DEFAULT true NOT NULL,
    teams jsonb,
    "accessToken" text,
    active boolean DEFAULT true NOT NULL,
    "clientId" text,
    "clientSecret" text,
    "expiresIn" bigint,
    "redirectUri" text,
    "refreshToken" text,
    "serviceType" text DEFAULT 'other'::text NOT NULL,
    "tenantId" text
);


ALTER TABLE public."EmailQueue" OWNER TO peppermint;

--
-- Name: Imap_Email; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."Imap_Email" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "from" text,
    subject text,
    body text,
    text text,
    html text,
    "emailQueueId" text
);


ALTER TABLE public."Imap_Email" OWNER TO peppermint;

--
-- Name: Notes; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."Notes" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    title text NOT NULL,
    note text NOT NULL,
    "Favourited" boolean DEFAULT false NOT NULL,
    "userId" text NOT NULL
);


ALTER TABLE public."Notes" OWNER TO peppermint;

--
-- Name: OAuthProvider; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."OAuthProvider" (
    id integer NOT NULL,
    name text NOT NULL,
    "clientId" text NOT NULL,
    "clientSecret" text NOT NULL,
    "authorizationUrl" text NOT NULL,
    "tokenUrl" text NOT NULL,
    "userInfoUrl" text NOT NULL,
    "redirectUri" text NOT NULL,
    scope text NOT NULL
);


ALTER TABLE public."OAuthProvider" OWNER TO peppermint;

--
-- Name: OAuthProvider_id_seq; Type: SEQUENCE; Schema: public; Owner: peppermint
--

CREATE SEQUENCE public."OAuthProvider_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."OAuthProvider_id_seq" OWNER TO peppermint;

--
-- Name: OAuthProvider_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: peppermint
--

ALTER SEQUENCE public."OAuthProvider_id_seq" OWNED BY public."OAuthProvider".id;


--
-- Name: PasswordResetToken; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."PasswordResetToken" (
    id text NOT NULL,
    code text NOT NULL,
    "userId" text NOT NULL
);


ALTER TABLE public."PasswordResetToken" OWNER TO peppermint;

--
-- Name: Role; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."Role" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    permissions jsonb[]
);


ALTER TABLE public."Role" OWNER TO peppermint;

--
-- Name: SAMLProvider; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."SAMLProvider" (
    id integer NOT NULL,
    name text NOT NULL,
    "entryPoint" text NOT NULL,
    issuer text NOT NULL,
    cert text NOT NULL,
    "ssoLoginUrl" text NOT NULL,
    "ssoLogoutUrl" text NOT NULL,
    audience text NOT NULL,
    recipient text NOT NULL,
    destination text NOT NULL,
    "acsUrl" text NOT NULL
);


ALTER TABLE public."SAMLProvider" OWNER TO peppermint;

--
-- Name: SAMLProvider_id_seq; Type: SEQUENCE; Schema: public; Owner: peppermint
--

CREATE SEQUENCE public."SAMLProvider_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."SAMLProvider_id_seq" OWNER TO peppermint;

--
-- Name: SAMLProvider_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: peppermint
--

ALTER SEQUENCE public."SAMLProvider_id_seq" OWNED BY public."SAMLProvider".id;


--
-- Name: Session; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL,
    "apiKey" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ipAddress" text,
    "userAgent" text
);


ALTER TABLE public."Session" OWNER TO peppermint;

--
-- Name: Slack; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."Slack" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name text NOT NULL,
    secret text,
    url text NOT NULL,
    active boolean DEFAULT false NOT NULL
);


ALTER TABLE public."Slack" OWNER TO peppermint;

--
-- Name: Team; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."Team" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name text NOT NULL
);


ALTER TABLE public."Team" OWNER TO peppermint;

--
-- Name: Ticket; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."Ticket" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name text,
    title text NOT NULL,
    detail text,
    email text,
    note text,
    "isComplete" boolean NOT NULL,
    priority text NOT NULL,
    "clientId" text,
    "userId" text,
    linked jsonb,
    "teamId" text,
    "fromImap" boolean NOT NULL,
    "Number" integer NOT NULL,
    status public."TicketStatus" DEFAULT 'needs_support'::public."TicketStatus" NOT NULL,
    type public."TicketType" DEFAULT 'support'::public."TicketType" NOT NULL,
    hidden boolean DEFAULT false NOT NULL,
    "createdBy" jsonb,
    locked boolean DEFAULT false NOT NULL,
    following jsonb
);


ALTER TABLE public."Ticket" OWNER TO peppermint;

--
-- Name: TicketFile; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."TicketFile" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    filename text NOT NULL,
    path text NOT NULL,
    "ticketId" text NOT NULL,
    encoding text NOT NULL,
    mime text NOT NULL,
    size integer NOT NULL,
    "userId" text NOT NULL
);


ALTER TABLE public."TicketFile" OWNER TO peppermint;

--
-- Name: Ticket_Number_seq; Type: SEQUENCE; Schema: public; Owner: peppermint
--

CREATE SEQUENCE public."Ticket_Number_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Ticket_Number_seq" OWNER TO peppermint;

--
-- Name: Ticket_Number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: peppermint
--

ALTER SEQUENCE public."Ticket_Number_seq" OWNED BY public."Ticket"."Number";


--
-- Name: TimeTracking; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."TimeTracking" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    title text NOT NULL,
    comment text,
    "clientId" text,
    "userId" text,
    "ticketId" text,
    "time" integer NOT NULL
);


ALTER TABLE public."TimeTracking" OWNER TO peppermint;

--
-- Name: Todos; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."Todos" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    text text NOT NULL,
    done boolean DEFAULT false NOT NULL,
    "userId" text NOT NULL
);


ALTER TABLE public."Todos" OWNER TO peppermint;

--
-- Name: Uptime; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."Uptime" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    active boolean DEFAULT false NOT NULL,
    webhook text,
    latency integer,
    status boolean
);


ALTER TABLE public."Uptime" OWNER TO peppermint;

--
-- Name: User; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."User" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name text NOT NULL,
    password text,
    email text NOT NULL,
    "isAdmin" boolean DEFAULT false NOT NULL,
    language text DEFAULT 'en'::text,
    notify_ticket_created boolean DEFAULT true NOT NULL,
    notify_ticket_status_changed boolean DEFAULT true NOT NULL,
    notify_ticket_comments boolean DEFAULT true NOT NULL,
    notify_ticket_assigned boolean DEFAULT true NOT NULL,
    "teamId" text,
    "emailVerified" boolean,
    image text,
    "firstLogin" boolean DEFAULT true NOT NULL,
    external_user boolean DEFAULT false NOT NULL,
    out_of_office boolean DEFAULT false NOT NULL,
    out_of_office_end timestamp(3) without time zone,
    out_of_office_message text,
    out_of_office_start timestamp(3) without time zone
);


ALTER TABLE public."User" OWNER TO peppermint;

--
-- Name: UserFile; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."UserFile" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    filename text NOT NULL,
    path text NOT NULL,
    "userId" text NOT NULL
);


ALTER TABLE public."UserFile" OWNER TO peppermint;

--
-- Name: Webhooks; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."Webhooks" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    type public."Hook" NOT NULL,
    active boolean NOT NULL,
    secret text,
    "createdBy" text NOT NULL
);


ALTER TABLE public."Webhooks" OWNER TO peppermint;

--
-- Name: _RoleToUser; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."_RoleToUser" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


ALTER TABLE public."_RoleToUser" OWNER TO peppermint;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO peppermint;

--
-- Name: emailTemplate; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."emailTemplate" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    type public."Template" NOT NULL,
    html text NOT NULL
);


ALTER TABLE public."emailTemplate" OWNER TO peppermint;

--
-- Name: knowledgeBase; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."knowledgeBase" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    tags text[],
    author text NOT NULL,
    public boolean DEFAULT false NOT NULL,
    "ticketId" text
);


ALTER TABLE public."knowledgeBase" OWNER TO peppermint;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    read boolean DEFAULT false NOT NULL,
    text text NOT NULL,
    "userId" text NOT NULL,
    "ticketId" text
);


ALTER TABLE public.notifications OWNER TO peppermint;

--
-- Name: openIdConfig; Type: TABLE; Schema: public; Owner: peppermint
--

CREATE TABLE public."openIdConfig" (
    id integer NOT NULL,
    "clientId" text NOT NULL,
    issuer text NOT NULL,
    "redirectUri" text NOT NULL
);


ALTER TABLE public."openIdConfig" OWNER TO peppermint;

--
-- Name: openIdConfig_id_seq; Type: SEQUENCE; Schema: public; Owner: peppermint
--

CREATE SEQUENCE public."openIdConfig_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."openIdConfig_id_seq" OWNER TO peppermint;

--
-- Name: openIdConfig_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: peppermint
--

ALTER SEQUENCE public."openIdConfig_id_seq" OWNED BY public."openIdConfig".id;


--
-- Name: OAuthProvider id; Type: DEFAULT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."OAuthProvider" ALTER COLUMN id SET DEFAULT nextval('public."OAuthProvider_id_seq"'::regclass);


--
-- Name: SAMLProvider id; Type: DEFAULT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."SAMLProvider" ALTER COLUMN id SET DEFAULT nextval('public."SAMLProvider_id_seq"'::regclass);


--
-- Name: Ticket Number; Type: DEFAULT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Ticket" ALTER COLUMN "Number" SET DEFAULT nextval('public."Ticket_Number_seq"'::regclass);


--
-- Name: openIdConfig id; Type: DEFAULT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."openIdConfig" ALTER COLUMN id SET DEFAULT nextval('public."openIdConfig_id_seq"'::regclass);


--
-- Data for Name: Client; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."Client" (id, "createdAt", "updatedAt", name, email, "contactName", number, notes, active) FROM stdin;
3ab9f1b2-0635-4b5c-bcd1-951b908929cc	2026-02-19 02:11:48.86	2026-02-19 02:11:48.86	internal	internal@admin.com	admin	123456789	\N	t
c1baec81-d91b-4f65-845e-b09f64d7d0cf	2026-02-23 02:12:09.027	2026-02-23 02:12:09.027	rusdi	rusdi@gmail.com	018204810384134		\N	t
\.


--
-- Data for Name: Comment; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."Comment" (id, "createdAt", text, public, "userId", "ticketId", reply, "replyEmail", edited, "editedAt", previous) FROM stdin;
74779cc3-9bc2-485e-a5ef-5c41b257db26	2026-02-20 04:11:32.695	qwert	f	c81074c4-1660-4477-b707-70827fb31298	9f721280-a4a8-438b-aaa6-a5ad254fe069	f	\N	f	\N	\N
fa9c167e-1918-4432-8387-9b9d59b49dcb	2026-02-20 04:24:31.64	(22:15, 17/02/2026) Checked laptop and RAM, confirmed they are safe	f	c81074c4-1660-4477-b707-70827fb31298	ec9dfd08-2352-48e3-8576-caf72f859abf	f	\N	f	\N	\N
144167cd-f785-4be4-a21f-dcd6a7fe9a5d	2026-02-20 04:24:44.506	(22:23, 17/02/2026) Replaced RAM with a new 8 GB RAM and replaced laptop SSD with a 1024 GB SSD\n	f	c81074c4-1660-4477-b707-70827fb31298	ec9dfd08-2352-48e3-8576-caf72f859abf	f	\N	f	\N	\N
\.


--
-- Data for Name: Config; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."Config" (id, "createdAt", "updatedAt", notifications, client_version, feature_previews, gh_version, sso_active, sso_provider, first_time_setup, encryption_key, roles_active) FROM stdin;
693968d6-675e-4758-ba8c-f47ae674f3ba	2026-02-19 02:11:48.867	2026-02-19 02:11:48.867	\N	0.4.3	f	0.4.3	f	\N	f	\\x953f20125f2336f5ecf69a77879f05814b1dd9e576161ad9b821e93fbf82f326	f
\.


--
-- Data for Name: Discord; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."Discord" (id, "createdAt", "updatedAt", name, secret, url, active) FROM stdin;
\.


--
-- Data for Name: Email; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."Email" (id, "createdAt", "updatedAt", active, "user", pass, secure, host, reply, port, "clientId", "clientSecret", "refreshToken", "serviceType", "tenantId", "accessToken", "expiresIn", "redirectUri") FROM stdin;
\.


--
-- Data for Name: EmailQueue; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."EmailQueue" (id, "createdAt", "updatedAt", name, username, password, hostname, tls, teams, "accessToken", active, "clientId", "clientSecret", "expiresIn", "redirectUri", "refreshToken", "serviceType", "tenantId") FROM stdin;
\.


--
-- Data for Name: Imap_Email; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."Imap_Email" (id, "createdAt", "updatedAt", "from", subject, body, text, html, "emailQueueId") FROM stdin;
\.


--
-- Data for Name: Notes; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."Notes" (id, "createdAt", "updatedAt", title, note, "Favourited", "userId") FROM stdin;
e166233b-ce25-4869-b1a5-186b56ca6978	2026-02-24 01:45:04.148	2026-02-24 01:45:04.148	test 2	[{"id":"77f887db-5235-4af2-ac87-18972847d12c","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"test test","styles":{}}],"children":[]},{"id":"2903a209-54c3-44db-bf6d-6ea7e307ee32","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[],"children":[]}]	f	c81074c4-1660-4477-b707-70827fb31298
f29a21cf-e541-4ce3-af65-1cb99bdb4043	2026-02-24 01:45:05.929	2026-02-24 01:45:05.929	test	[{"id":"f650937b-0966-404c-8e78-e2ad72462527","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"test 1 1 1","styles":{}}],"children":[]},{"id":"c1332162-1e6f-408c-9fc9-a342d520d70c","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[],"children":[]}]	f	c81074c4-1660-4477-b707-70827fb31298
196d33c1-902a-427b-a9dd-4c4bc7b8a878	2026-02-19 06:11:27.06	2026-02-19 06:11:27.06	Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.	[{"id":"a0b3de5e-c0cf-453f-96c5-509f2a98d45e","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.","styles":{}}],"children":[]},{"id":"73cd2417-2efa-44ae-92a5-30e6db28ab5b","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[],"children":[]}]	f	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b
cd7f63c8-c2fe-40f2-943a-b348ffc069b4	2026-02-19 06:12:30.418	2026-02-19 06:12:30.418	ssqertyuioasdfghj	[{"id":"d2aa9e1e-73d7-40e8-b6ed-48e33b201cda","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[],"children":[]}]	f	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b
\.


--
-- Data for Name: OAuthProvider; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."OAuthProvider" (id, name, "clientId", "clientSecret", "authorizationUrl", "tokenUrl", "userInfoUrl", "redirectUri", scope) FROM stdin;
\.


--
-- Data for Name: PasswordResetToken; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."PasswordResetToken" (id, code, "userId") FROM stdin;
\.


--
-- Data for Name: Role; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."Role" (id, name, description, "isDefault", "createdAt", "updatedAt", permissions) FROM stdin;
\.


--
-- Data for Name: SAMLProvider; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."SAMLProvider" (id, name, "entryPoint", issuer, cert, "ssoLoginUrl", "ssoLogoutUrl", audience, recipient, destination, "acsUrl") FROM stdin;
\.


--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."Session" (id, "sessionToken", "userId", expires, "apiKey", "createdAt", "ipAddress", "userAgent") FROM stdin;
cmlsu0pra0001zmz9olawhjy9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiMjJhN2E4YWUtZjYxZS00OTNiLTlhNTAtYjFkNWQ0ODc1ZDJiIiwic2Vzc2lvbklkIjoiYTkzODhkNmVlNGE3YjVlMzMzMjUyYmRhMzI0NGFjMzU4OTUxMDAwOTc2NTY4NmY2NTAwMGVhNGMyOTY2MTcwYSJ9LCJpYXQiOjE3NzE0Njc1MTMsImV4cCI6MTc3MTQ5NjMxM30.WNXZ4xsIsqod0gKRSrYTg4qmrMt_66czmZqc_0BWS-M	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	2026-02-19 10:18:33.957	f	2026-02-19 02:18:33.958	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlsu2fa60003zmz9ekwjkgos	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiZTE3YWU5NGRjZGRiYzhjNmVkNTVhMzZjODU0OWNlOTI2YTNiOTA1ODhjNjgzZDlhZTgxNjYwMzIzNTJlMTAwMiJ9LCJpYXQiOjE3NzE0Njc1OTMsImV4cCI6MTc3MTQ5NjM5M30.yWO8iwuU24rIIp0b3_ABYPp7sb6VUo8T9zEz5S4Egqw	c81074c4-1660-4477-b707-70827fb31298	2026-02-19 10:19:53.693	f	2026-02-19 02:19:53.694	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlsu2zsx0005zmz9xgikgltl	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiMjY5NDRlZjY2M2MwMGUxN2NmNDAwZjIyMzgyODYzMWE0NjgzNDM3NTQ1NmIyNmM3ZmEzNTNjNWQzYWNiYTg3MyJ9LCJpYXQiOjE3NzE0Njc2MjAsImV4cCI6MTc3MTQ5NjQyMH0.ROetxbLDOoUykFC48DZyxdTXij12YQx8BEKFJsEhbi0	c81074c4-1660-4477-b707-70827fb31298	2026-02-19 10:20:20.288	f	2026-02-19 02:20:20.289	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlsu42740007zmz9mlkqafkp	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiOGM3YTdkY2RiZGVkMDU2YjQwODMzMGUzZWMwMWE2ZDgxOWRlYjcyMjk2Y2YzZDdjM2JiYTQyNzBlZmU5ZjcwMiJ9LCJpYXQiOjE3NzE0Njc2NzAsImV4cCI6MTc3MTQ5NjQ3MH0.cnPg9xYrRvTxjsVvmTIZz49cZUY_nGma5Jc7wQWQNkM	c81074c4-1660-4477-b707-70827fb31298	2026-02-19 10:21:10.047	f	2026-02-19 02:21:10.048	118.98.214.130	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36
cmlsu6wej0009zmz9hiwutoip	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiMjJhN2E4YWUtZjYxZS00OTNiLTlhNTAtYjFkNWQ0ODc1ZDJiIiwic2Vzc2lvbklkIjoiODdmNWFkMWYxMmExZmVhMjU5YzRjMTM4NWVlNzJhMzQ4NmYyNTgxMzZkZGE0M2E5NmViZDBhZjNhMGQ4ZjFmMSJ9LCJpYXQiOjE3NzE0Njc4MDIsImV4cCI6MTc3MTQ5NjYwMn0.fvKY_N9SvmqfPOJy0eGJZFH8GJIzhWFJMQqridrQ2M8	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	2026-02-19 10:23:22.506	f	2026-02-19 02:23:22.507	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlsu86mp000bzmz9vmmmybd1	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiZTU2MWViMzVhY2Q5NThkMDQxZDdiMWE3ODgwNTgxODMxODNjYTc3N2NmNTJjNTdmN2M5NTAyNDc0NmM1ZDlkMSJ9LCJpYXQiOjE3NzE0Njc4NjIsImV4cCI6MTc3MTQ5NjY2Mn0.7RzAKVA2yxOdShQ-ULXFIl7cAEUi9iGkQCsZRY1zC3w	c81074c4-1660-4477-b707-70827fb31298	2026-02-19 10:24:22.417	f	2026-02-19 02:24:22.418	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlsu8o5e000dzmz99doy1nx4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiMjJhN2E4YWUtZjYxZS00OTNiLTlhNTAtYjFkNWQ0ODc1ZDJiIiwic2Vzc2lvbklkIjoiMWEzNjNkNzFhNWIyZmFiMDRjNzRkN2Y4ZDZlZmI0ODgxYTFjNGUwNDhjMTM0YjIyM2EyOTI5ZWVhNDVkZjUxYyJ9LCJpYXQiOjE3NzE0Njc4ODUsImV4cCI6MTc3MTQ5NjY4NX0.Lki2psh2_ievNCOMK_cSdwOakkJTAsWl51azBLQJx-8	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	2026-02-19 10:24:45.121	f	2026-02-19 02:24:45.122	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlsuagbo000fzmz9pz0m7vro	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiMWU5ZGVkMGExNThlNTE1MTdjZWY0MzMwNDJlMWNhOTIzYWE0Y2M1MmE1OTlhMGFjMjVkZWE0ZmJmN2JkYTdjYyJ9LCJpYXQiOjE3NzE0Njc5NjgsImV4cCI6MTc3MTQ5Njc2OH0.PrvgT0IbDJPF2zDXIslrQqx6-dYa20tWpOBn7ia8T9E	c81074c4-1660-4477-b707-70827fb31298	2026-02-19 10:26:08.292	f	2026-02-19 02:26:08.292	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlsub8eq000hzmz94rbuzrr4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiMjJhN2E4YWUtZjYxZS00OTNiLTlhNTAtYjFkNWQ0ODc1ZDJiIiwic2Vzc2lvbklkIjoiZGYyY2RkOGYwY2EzY2ExMGU0MjMyZTMxNDM4YmYxOWM1OGVhNTE0OWQ4OWIyNWI5M2Y0ZGZkYmU1NjBjNzA0YyJ9LCJpYXQiOjE3NzE0NjgwMDQsImV4cCI6MTc3MTQ5NjgwNH0.6rwmJSDlU7cXHYhlzjMx8c4ysmn1M7L4qYYThikPEhY	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	2026-02-19 10:26:44.689	f	2026-02-19 02:26:44.69	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlsubxk0000jzmz99h3vuekt	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiYjNlZWZiYzk3NmUzYTVkZjA2YjUzNzFlZDUyMDQ2ZGI4NWE5YjNjZTg0YzRhZWNkZTNlZmE3OTExZmU0OWRhMSJ9LCJpYXQiOjE3NzE0NjgwMzcsImV4cCI6MTc3MTQ5NjgzN30.WKVQ32Z9iYFd7o6zx-ejcuioeBh1bJnK_GhHhRm4Byk	c81074c4-1660-4477-b707-70827fb31298	2026-02-19 10:27:17.28	f	2026-02-19 02:27:17.281	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlsvdjr90001suf6ms96hl9r	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiMjJhN2E4YWUtZjYxZS00OTNiLTlhNTAtYjFkNWQ0ODc1ZDJiIiwic2Vzc2lvbklkIjoiZDQxNzJlNmY0MGFiYjkxNGIxNmUxODQzOGQ1NDcxMmM4ZDVhM2MzOTE5ZDU0NWZjODRlZGYyYmZlNjEwMmM0MiJ9LCJpYXQiOjE3NzE0Njk3OTIsImV4cCI6MTc3MTQ5ODU5Mn0.PqAVUx6euKvo4yTPc7lvOHP_iORRD1WSQGbWLnlB2mY	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	2026-02-19 10:56:32.325	f	2026-02-19 02:56:32.326	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlsvfefc0003suf6phdtskjg	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiMjJhN2E4YWUtZjYxZS00OTNiLTlhNTAtYjFkNWQ0ODc1ZDJiIiwic2Vzc2lvbklkIjoiYzkwYjQwNDVkMDhiNGU0ZTc5NzlkMzZkNjg2YmE4MDcyODFhNDgxMTJhNDMzMWFiYjg2NTQwZDdhMjA3NTNhOSJ9LCJpYXQiOjE3NzE0Njk4NzgsImV4cCI6MTc3MTQ5ODY3OH0.dNR72AKU5td4CXR5xfG2cWqwnAdmn5GpHbe3mXDsUoQ	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	2026-02-19 10:57:58.727	f	2026-02-19 02:57:58.728	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlsxdaa30005suf6ucmhy7yy	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiMjJhN2E4YWUtZjYxZS00OTNiLTlhNTAtYjFkNWQ0ODc1ZDJiIiwic2Vzc2lvbklkIjoiZDlhNTY1ODdhMDNmOTg5ZDA3OWE0MjI2MDg4YWJjOWU5NjgzMDM5OTNkYjJhN2FhMzRmNDFmMzlhMjY4ZjQ5NCJ9LCJpYXQiOjE3NzE0NzMxMzksImV4cCI6MTc3MTUwMTkzOX0.8SY27SbrkNQEkpxLMVk-WRF2UxLw_hvioshnh0gEki4	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	2026-02-19 11:52:19.275	f	2026-02-19 03:52:19.276	3.216.89.108	curl/8.5.0
cmlt44e320001wvimisu7dfqh	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiZThiOWU4ZTNkNTgxYWYzZGI3NTRhZjIxM2UzN2ZjMzQwMjljOTE5MzZhY2MzZjZiNTYwNzUyNWZjOTExZDU1YiJ9LCJpYXQiOjE3NzE0ODQ0ODEsImV4cCI6MTc3MTUxMzI4MX0.nPyAQ3vGc_EYNqlPTbxGK-aS4RDeIsc64taSaoJIPU4	c81074c4-1660-4477-b707-70827fb31298	2026-02-19 15:01:21.613	f	2026-02-19 07:01:21.614	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlt44mjv0003wvimaub7klxu	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiMjJhN2E4YWUtZjYxZS00OTNiLTlhNTAtYjFkNWQ0ODc1ZDJiIiwic2Vzc2lvbklkIjoiYmI0ZmFjNmY4YmIwZWUwZDk0ZDEzZTJkMmM4NjNhNjgwMjA1NzA0NGVmNTY3ZGEzYjY3ZjdhYzFkMWFiMzk3ZiJ9LCJpYXQiOjE3NzE0ODQ0OTIsImV4cCI6MTc3MTUxMzI5Mn0.7UwFGZTMTeBTEuEUy82hPEKEVkv-o_6o0f8TX2_1_5g	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	2026-02-19 15:01:32.586	f	2026-02-19 07:01:32.587	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlt4n5kv0001u1wjb8mp8stp	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiMGEzN2E5YzdiYjUwZWM4YTEzZGZlNzRlMjEyNGVjODBmNzA2ZTdkM2Y1MjViOWI4NjM3NjhjNjBiZWNlZjNmZCJ9LCJpYXQiOjE3NzE0ODUzNTcsImV4cCI6MTc3MTUxNDE1N30.nwhizmgQEE3JqRslxxfS6iVu-Li3GcKJq1arTdaSkrI	c81074c4-1660-4477-b707-70827fb31298	2026-02-19 15:15:57.054	f	2026-02-19 07:15:57.055	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlt4ngk90003u1wjm5pjczf4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiMjJhN2E4YWUtZjYxZS00OTNiLTlhNTAtYjFkNWQ0ODc1ZDJiIiwic2Vzc2lvbklkIjoiOGVkNDc1YjZhYzBiMzZmYmU4OTE5NDA2YTk1MjlkODI4NzQyYzViMTQ4NDRlNDA5NDQ2N2MzZDEyNGVkMWQzMCJ9LCJpYXQiOjE3NzE0ODUzNzEsImV4cCI6MTc3MTUxNDE3MX0.Sw7QsHBm3LYM2wtpLnvHjw2jOEL5iA-A1s5Dk72AgBw	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	2026-02-19 15:16:11.288	f	2026-02-19 07:16:11.29	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlua3ucn0001xj8dlusvku0w	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiODI4ZmE5ODgzMWU3MTQ1MTVlYzcyMWViODI3NzRlNWQ5OWU4ZDU1MjJkMmExYWVjZTVjNjE2MTEyMmQwYmE0NiJ9LCJpYXQiOjE3NzE1NTQ5OTksImV4cCI6MTc3MTU4Mzc5OX0.OLseAtEVQvNMtN4H_QBzl3PYujyQy0Zxt-YDGMqgGnM	c81074c4-1660-4477-b707-70827fb31298	2026-02-20 10:36:39.91	f	2026-02-20 02:36:39.911	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlubp1d2000112ij3ugoj57s	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiNDFhM2IzZTljZDVlYjc2NGJiN2Q1OTdhZmYzMDE5N2VjNWQyMTRmYTM3MWFlNjFkMTFjMTBkZmVhZGZkYWE2OSJ9LCJpYXQiOjE3NzE1NTc2NjgsImV4cCI6MTc3MTU4NjQ2OH0.WJ8LJEfQ8yCMoFC8e_fg0MNC-UgQrT8XnFYXtlgoNwo	c81074c4-1660-4477-b707-70827fb31298	2026-02-20 11:21:08.389	f	2026-02-20 03:21:08.39	118.98.214.130	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36
cmlubq0ea000113r9wsy38ygv	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiM2M3YTFkN2NjZDc1MjMyOGI5Yjc1NTViMjQ2ZmJmODE0Mzg4YTBlMmZmNGRlMWM1MjM1MzkwMTc4Mjg1ZjcxYSJ9LCJpYXQiOjE3NzE1NTc3MTMsImV4cCI6MTc3MTU4NjUxM30.Zxuzfl-shjD7MzaWcoykf1wL_I7LHiLMJqsBNdYOYmM	c81074c4-1660-4477-b707-70827fb31298	2026-02-20 11:21:53.793	f	2026-02-20 03:21:53.794	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlucahv80001uluchso4mm8s	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiOWRiNzczZTlhYmY5OTIwNDU5ZDI5MjZjZjBlZjBjOTRmMTE2MDRhODlhZjgwZGVhOGRkYmE0NjQ1YmVlYTkxMyJ9LCJpYXQiOjE3NzE1NTg2NjksImV4cCI6MTc3MTU4NzQ2OX0.albZGZKGY8T2lZv6gZjBA23VOX6GRDtXavKNcYBCYn4	c81074c4-1660-4477-b707-70827fb31298	2026-02-20 11:37:49.555	f	2026-02-20 03:37:49.556	118.98.214.130	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36
cmlud7id50003ulucvqn9hp5f	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiMmE5NWEzOTA5NTk1MDVkMWY1NmI1OTI0OGQ2YzRlYzMwM2U0YjA5MjAxYjQ3YTE4OTc3NDU5YjlhODhiNTI5NiJ9LCJpYXQiOjE3NzE1NjAyMDksImV4cCI6MTc3MTU4OTAwOX0.9RxcPyATDY2VvUBC7Fhwo8l0faP5832TelKBAHFZhYE	c81074c4-1660-4477-b707-70827fb31298	2026-02-20 12:03:29.848	f	2026-02-20 04:03:29.849	114.8.209.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36
cmluddufa0005ulucrxtv46bd	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiMjJhN2E4YWUtZjYxZS00OTNiLTlhNTAtYjFkNWQ0ODc1ZDJiIiwic2Vzc2lvbklkIjoiNjEwMDYyMzY4ODlhYzY5NWNiNjZiZWM1Yjc4MTAzZTAyN2ZkMjdjODYyNTU1YzQyNjlhMzg3M2VjMGY3NWQwZiJ9LCJpYXQiOjE3NzE1NjA1MDUsImV4cCI6MTc3MTU4OTMwNX0.S6wMCujDRAw_ukDBbYfMWpoJOqyA6ar8PTzZJoqmOOQ	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	2026-02-20 12:08:25.413	f	2026-02-20 04:08:25.414	114.8.209.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36
cmludnnkk0007ulucgunourqd	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiMjJhN2E4YWUtZjYxZS00OTNiLTlhNTAtYjFkNWQ0ODc1ZDJiIiwic2Vzc2lvbklkIjoiNmU0M2JhZDM5YzhlNmMxM2RiYjg1YjliYTkzMGYxM2ZmMzFiNTc3ZmRmZTc1ZTIzZDA2ZDMyYjAyNDdkNzI3ZiJ9LCJpYXQiOjE3NzE1NjA5NjMsImV4cCI6MTc3MTU4OTc2M30.LDH8XMz5NbQDYnPKETLZycUaTuDAzM81fBOW04g4HiE	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	2026-02-20 12:16:03.092	f	2026-02-20 04:16:03.093	3.216.89.108	curl/8.5.0
cmlue4lnd0009uluc8rb633cw	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiMjJhN2E4YWUtZjYxZS00OTNiLTlhNTAtYjFkNWQ0ODc1ZDJiIiwic2Vzc2lvbklkIjoiY2Y0ZmFiY2Y3MjY1NTViZmE2MmQ2ZjM2NmQwZjE2YzQzOWI1NDY2MDNhZDg2OWIyYmQ1OGUwYzFiYzBmODM0OCJ9LCJpYXQiOjE3NzE1NjE3NTMsImV4cCI6MTc3MTU5MDU1M30.NmQ5LBvJhFVthIPHrZQ7_o7EIN1uImohlm6B12V8uUs	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	2026-02-20 12:29:13.752	f	2026-02-20 04:29:13.753	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlyif9kl00011t3r617ndpxq	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiM2Y0NmU2NjIwMjA4OTYzMjgwM2RhZDk0ZDc3Y2VmYWI3MTlmMDI4Y2RlMjc5ODQ5MTM4NjUwNTZlYWZkYzU3NCJ9LCJpYXQiOjE3NzE4MTA4MzQsImV4cCI6MTc3MTgzOTYzNH0.h6tOkIGoreoQ5f_9hnY6cqlkfW3YZXz0Z7YVi1MHzBU	c81074c4-1660-4477-b707-70827fb31298	2026-02-23 09:40:34.484	f	2026-02-23 01:40:34.485	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlyijg5p00031t3rs5oijay6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiNjgyNjExMTMxNWQwODRhNmI0ZTI5MjhlYTk0YzE2NDI3YTg1NmIyYjZkYjg3YTExMTgyYTQxODYxNWMxZWM1YSJ9LCJpYXQiOjE3NzE4MTEwMjksImV4cCI6MTc3MTgzOTgyOX0.7vofpn-LFec4bBbGgHuIQoIuoEFLjJWo1h5eijoMryw	c81074c4-1660-4477-b707-70827fb31298	2026-02-23 09:43:49.645	f	2026-02-23 01:43:49.646	118.98.214.130	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36
cmlyiys3b00013kijphzgaajk	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiMjJhN2E4YWUtZjYxZS00OTNiLTlhNTAtYjFkNWQ0ODc1ZDJiIiwic2Vzc2lvbklkIjoiMjU5ZjAxMmQ3NTBkNzcxYThmN2JiZjMwYmUxNjQ5ODQxOTJhMmZkZjUzZWM3ZDE5ZjU0NTUxZjg4NDFmMWEwNSJ9LCJpYXQiOjE3NzE4MTE3NDQsImV4cCI6MTc3MTg0MDU0NH0.R16dF2H-hKbaIsKLOMJUeRYJfsdVd_nr3d3_MWiDnQI	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	2026-02-23 09:55:44.951	f	2026-02-23 01:55:44.952	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlyj2du100033kijd3n0i2we	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiMjJhN2E4YWUtZjYxZS00OTNiLTlhNTAtYjFkNWQ0ODc1ZDJiIiwic2Vzc2lvbklkIjoiYzk4ODcyZjJmOWQ3YTlhNjI5NTNkMTA0ZWYyY2M5N2EyM2NlMTVkZGJjOTM2Y2NjOWVhMWJkMGRlNTViYTFhYiJ9LCJpYXQiOjE3NzE4MTE5MTMsImV4cCI6MTc3MTg0MDcxM30.hhOxZ6r5MLKYFnigQ7Tsd4cqfFGp2zLHiBEUsNL62O8	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	2026-02-23 09:58:33.097	f	2026-02-23 01:58:33.098	3.216.89.108	curl/8.5.0
cmlzy0i910001d13g2pk6vkvo	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiZDA0YjM1ZDc2MzIyNjNiMmZkM2JjOWQzYmZlOWI3NmM1YWY3NmRjNmZhNmVhNWVmOWNiNmVlOWRmMTJjZWZmZSJ9LCJpYXQiOjE3NzE4OTc0ODUsImV4cCI6MTc3MTkyNjI4NX0.aU4cHxkgl7YvoLAVmElapobTh2NNn4kdyTs3zD2LEHc	c81074c4-1660-4477-b707-70827fb31298	2026-02-24 09:44:45.924	f	2026-02-24 01:44:45.925	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
cmlzy4jv80003d13goshfx1qb	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYzgxMDc0YzQtMTY2MC00NDc3LWI3MDctNzA4MjdmYjMxMjk4Iiwic2Vzc2lvbklkIjoiM2Y2MDBhN2Y2YmZhNjNlOTgzMTlhNDVjY2YzYTlhMGRiM2M3OTY2OTQ5NDQ3YjhjZjZmNWQ1YjczMTdiYTI4ZCJ9LCJpYXQiOjE3NzE4OTc2NzQsImV4cCI6MTc3MTkyNjQ3NH0.T0FfJaYUqkXVkb5j8UFqzUsQbqmbFjHNbLsqMb1ADgs	c81074c4-1660-4477-b707-70827fb31298	2026-02-24 09:47:54.643	f	2026-02-24 01:47:54.644	118.98.214.130	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36
cmlzy9u7o0005d13g5sa7kejb	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiMjJhN2E4YWUtZjYxZS00OTNiLTlhNTAtYjFkNWQ0ODc1ZDJiIiwic2Vzc2lvbklkIjoiM2Q0MjVhMTBkMmIyNmI2ZTM1MWE3YWY0NmQxMmRkYWMxN2VmZWYyNDNkYzRmZDFkNzQ5YmE4NzE0MTRkZDlkNSJ9LCJpYXQiOjE3NzE4OTc5MjEsImV4cCI6MTc3MTkyNjcyMX0.Mk1u3CnYQI1lwdGrlrj8ccvxdbMl7FDfbO0fP4Vf7cI	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	2026-02-24 09:52:01.331	f	2026-02-24 01:52:01.332	118.98.214.130	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
\.


--
-- Data for Name: Slack; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."Slack" (id, "createdAt", "updatedAt", name, secret, url, active) FROM stdin;
\.


--
-- Data for Name: Team; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."Team" (id, "createdAt", "updatedAt", name) FROM stdin;
\.


--
-- Data for Name: Ticket; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."Ticket" (id, "createdAt", "updatedAt", name, title, detail, email, note, "isComplete", priority, "clientId", "userId", linked, "teamId", "fromImap", "Number", status, type, hidden, "createdBy", locked, following) FROM stdin;
9f721280-a4a8-438b-aaa6-a5ad254fe069	2026-02-19 03:53:06.369	2026-02-19 03:53:06.369	\N	Test tiket dari API	[{"id":"ce4e592d-0b26-458c-b343-0b9a7fd39702","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[],"children":[]},{"id":"941810e0-e899-4ef6-9a58-02f8c39bd730","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[],"children":[]}]	\N	\N	f	low	\N	c81074c4-1660-4477-b707-70827fb31298	\N	\N	f	6	needs_support	support	f	\N	f	\N
f2cb03a2-75df-4a9b-97c9-5bcb434fca61	2026-02-19 02:27:23.311	2026-02-19 02:27:23.311		wwww	\N		\N	f	medium	\N	\N	\N	\N	f	5	needs_support	bug	f	{"id": "c81074c4-1660-4477-b707-70827fb31298", "name": "Guest", "email": "guest@seamolec.org"}	f	\N
5ac4b631-d75a-496d-a378-f4666a220fa3	2026-02-19 02:26:01.061	2026-02-19 02:26:01.061	test 	test	[{"id":"316146b7-c01b-45ca-b7f3-5edbac0e5856","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"test test","styles":{}}],"children":[]},{"id":"5dae8aeb-c4a3-48e8-b7bb-a2b6739a83ad","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[],"children":[]}]	rsudi	\N	t	high	3ab9f1b2-0635-4b5c-bcd1-951b908929cc	c81074c4-1660-4477-b707-70827fb31298	\N	\N	f	3	needs_support	support	f	{"id": "22a7a8ae-f61e-493b-9a50-b1d5d4875d2b", "name": "admin", "email": "admin@admin.com"}	f	\N
a1fed6b7-dd94-44a5-b4ed-35c84825b2ea	2026-02-19 02:24:35.916	2026-02-19 02:24:35.916			\N		\N	f	medium	\N	\N	\N	\N	f	2	needs_support	bug	f	{"id": "c81074c4-1660-4477-b707-70827fb31298", "name": "Guest", "email": "guest@seamolec.org"}	f	\N
b277709d-92da-4607-96d9-dca1cd22ede5	2026-02-19 02:26:19.792	2026-02-19 02:26:19.792		test	\N	te	\N	f	medium	\N	\N	\N	\N	f	4	needs_support	bug	f	{"id": "c81074c4-1660-4477-b707-70827fb31298", "name": "Guest", "email": "guest@seamolec.org"}	f	\N
dd870eab-e78e-47a6-9c4b-37d1da34a022	2026-02-19 02:21:25.091	2026-02-19 02:21:25.091			[{"id":"50dbb7e5-c66e-4b02-b7a0-c986b3ad5d07","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[],"children":[]},{"id":"2298746a-4192-4a4b-a04e-023bcb307e71","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[],"children":[]}]		\N	t	medium	\N	\N	\N	\N	f	1	needs_support	bug	f	{"id": "c81074c4-1660-4477-b707-70827fb31298", "name": "Guest", "role": "client", "email": "guest@seamolec.org"}	f	\N
ec9dfd08-2352-48e3-8576-caf72f859abf	2026-02-20 04:17:30.375	2026-02-20 04:17:30.375	\N	Test tiket dari API chatbot	[{"id":"997940a9-692c-4094-a550-5c80824ac3a1","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"• Name : Rusdianto • Division : Research & Development • Phone : 085917419448 • Email : ","styles":{}},{"type":"link","href":"mailto:rusdi6219@gmail.com","content":[{"type":"text","text":"rusdi6219@gmail.com","styles":{}}]},{"type":"text","text":" -------------------------------------------- ","styles":{}},{"type":"text","text":"Device & Location:","styles":{"bold":true}},{"type":"text","text":" • Device ID : 244242 • Room : OPS Network • Floor : Lantai 1 • Quantity : 1 ---------------------------------------------- ","styles":{}},{"type":"text","text":"Ticket Detail:","styles":{"bold":true}},{"type":"text","text":" • Date / Time : 2026-02-17 • Support Type : Laptop / PC • Issue : perbaikan laptop dan nambah ram • Assign Team: ","styles":{}},{"type":"text","text":"@ITSOPSEAMOLEC","styles":{"bold":true}},{"type":"text","text":" ","styles":{}},{"type":"text","text":"@Rusdianto","styles":{"bold":true}}],"children":[]},{"id":"0720a9e1-1d37-481a-a294-cddd941a4b8c","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[],"children":[]}]	\N	\N	t	high	\N	\N	\N	\N	f	7	needs_support	support	f	\N	f	\N
8aaa4d2f-7e46-460d-bce4-7d4767b9ad33	2026-02-20 04:31:06.921	2026-02-20 04:31:06.921			\N		\N	t	medium	\N	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	\N	\N	f	9	needs_support	maintenance	f	{"id": "22a7a8ae-f61e-493b-9a50-b1d5d4875d2b", "name": "admin", "email": "admin@admin.com"}	f	\N
32970646-bc7e-4783-a26b-61b653d802bf	2026-02-20 04:25:38.748	2026-02-20 04:25:38.748		test	\N		\N	t	high	c1baec81-d91b-4f65-845e-b09f64d7d0cf	c81074c4-1660-4477-b707-70827fb31298	\N	\N	f	8	in_progress	bug	f	{"id": "c81074c4-1660-4477-b707-70827fb31298", "name": "Guest", "email": "guest@seamolec.org"}	f	\N
\.


--
-- Data for Name: TicketFile; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."TicketFile" (id, "createdAt", filename, path, "ticketId", encoding, mime, size, "userId") FROM stdin;
\.


--
-- Data for Name: TimeTracking; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."TimeTracking" (id, "createdAt", "updatedAt", title, comment, "clientId", "userId", "ticketId", "time") FROM stdin;
\.


--
-- Data for Name: Todos; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."Todos" (id, "createdAt", "updatedAt", text, done, "userId") FROM stdin;
\.


--
-- Data for Name: Uptime; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."Uptime" (id, "createdAt", "updatedAt", name, url, active, webhook, latency, status) FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."User" (id, "createdAt", "updatedAt", name, password, email, "isAdmin", language, notify_ticket_created, notify_ticket_status_changed, notify_ticket_comments, notify_ticket_assigned, "teamId", "emailVerified", image, "firstLogin", external_user, out_of_office, out_of_office_end, out_of_office_message, out_of_office_start) FROM stdin;
22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	2026-02-19 02:11:48.848	2026-02-19 02:11:48.848	admin	$2b$10$BFmibvOW7FtY0soAAwujoO9y2tIyB7WEJ2HNq9O7zh9aeejMvRsKu	admin@admin.com	t	en	t	t	t	t	\N	\N	\N	f	f	f	\N	\N	\N
c81074c4-1660-4477-b707-70827fb31298	2026-02-19 02:19:33.702	2026-02-19 02:19:33.702	Guest	$2b$10$WfMPbAUj1sOlEfBivZewSOTLOqOvQKV9pDC4124ON3ZU8DEZM23dy	guest@seamolec.org	f	en	t	t	t	t	\N	\N	\N	f	f	f	\N	\N	\N
\.


--
-- Data for Name: UserFile; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."UserFile" (id, "createdAt", filename, path, "userId") FROM stdin;
\.


--
-- Data for Name: Webhooks; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."Webhooks" (id, "createdAt", "updatedAt", name, url, type, active, secret, "createdBy") FROM stdin;
\.


--
-- Data for Name: _RoleToUser; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."_RoleToUser" ("A", "B") FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
6947e2fd-8a7a-413a-af2b-b81de64fd619	66eff4065ea789d46ad6e5ab334ddd962551c3eddb27557283cda05ab694aef2	2026-02-19 02:11:47.562402+00	20230610155640_ticket_status	\N	\N	2026-02-19 02:11:47.558615+00	1
57aa4ef2-b5c4-43fb-8d4c-7ed995c2b02a	9d1874b36850ffdeed7ec44f08dde68460030298e4c1da9de2345dc4d7a7b073	2026-02-19 02:11:47.329416+00	20230219190916_	\N	\N	2026-02-19 02:11:47.233412+00	1
08f8fa70-c8fc-417d-9cf2-091e744d5543	975342e0192df0517d343319bd6ea6062301233c5143378eef936849f4dd6801	2026-02-19 02:11:47.338794+00	20230219231320_null_allow	\N	\N	2026-02-19 02:11:47.331219+00	1
346881ba-aef9-496b-8dea-ec4d3f439846	3cdac2e6f461b9be3a626e61d768abadb73964bf26fbaac0963ccbaacdfa2c25	2026-02-19 02:11:47.63441+00	20231130184716_sso	\N	\N	2026-02-19 02:11:47.630866+00	1
741662f2-ae07-488e-8d3e-88390be449c6	af0842a52430f65f1023fb2fc911db632410b52b57ed7c3e21a9c6d506bb839c	2026-02-19 02:11:47.350148+00	20230220001329_email_queue	\N	\N	2026-02-19 02:11:47.341159+00	1
3dc77344-fb59-419d-b939-65544094abe6	adc96bde83ed97cf13e33461976e016369586b9805bbecfcc0154fea8e1c26d8	2026-02-19 02:11:47.574061+00	20230613194311_timetracking	\N	\N	2026-02-19 02:11:47.564285+00	1
eb0dfcff-c66c-4e37-b2ce-91578aebe783	176c7f077a22d6bb1e3612e4f919b60f6df53736dd6c41ce2c5b1389f3d669c5	2026-02-19 02:11:47.356173+00	20230220002242_	\N	\N	2026-02-19 02:11:47.352111+00	1
4c0d2b40-02e9-4bfa-ae15-b128b2a50e7a	3b23c83e3b71604b1f1d123569a6a5873f35ed0ed6af4ccef22caea7df4f897d	2026-02-19 02:11:47.361325+00	20230220005811_fromimap	\N	\N	2026-02-19 02:11:47.358205+00	1
94d597c1-875a-4ccd-a6a4-a27191edb044	0b7418475e878e47bf207864dd49c192c018ff3e0c14757af935c99bc8461b78	2026-02-19 02:11:47.454941+00	20230221233223_uuid	\N	\N	2026-02-19 02:11:47.363406+00	1
bbf6b11b-cbed-4ecf-9124-367d184aa123	7f51e2d162403637bae48a88d7d1e1ca2be5ab6a3cdc0e2bf0b665a3ae123b65	2026-02-19 02:11:47.579794+00	20230613195745_updatetime	\N	\N	2026-02-19 02:11:47.576624+00	1
1a6174ac-797e-44ad-bc4e-8c0b4588762f	ce5bfa927443c847fb34ecaef88a48ecac7221ff22ddd20b13919a5c715fca2e	2026-02-19 02:11:47.472774+00	20230227225201_autoinc	\N	\N	2026-02-19 02:11:47.456814+00	1
e66e10fa-9e17-46fd-ad8c-f95c5cc75c72	1a3eb34258dcff7fe41c5439e210309e6ef308a81d1ae999af10931783bdd05b	2026-02-19 02:11:47.493961+00	20230607224601_	\N	\N	2026-02-19 02:11:47.474796+00	1
a6176b68-f9b1-4a6a-98ea-b32adde012bc	213570a607c579888eb2b0c1b070789eb2bfc9140dc75c84b46c2bba64882ebc	2026-02-19 02:11:47.663819+00	20231203164241_	\N	\N	2026-02-19 02:11:47.659653+00	1
ba55f816-8453-438b-9e28-4752181f5d65	af555a7e8a8aa9b2216eec0102203dd73aa90ccded4999e3d36f093450eafcb1	2026-02-19 02:11:47.525037+00	20230608222751_	\N	\N	2026-02-19 02:11:47.499813+00	1
d902a505-f5bd-4783-8963-46ab00871341	f9eeb6062239f631a4cd253f7512500c7d939c998873a12c16fef83a896363a0	2026-02-19 02:11:47.585229+00	20231123183949_	\N	\N	2026-02-19 02:11:47.58169+00	1
6bd887e3-74ab-4587-ae96-892c37eeae10	2ab84a38a044d3441da35bb39c692005a7ec336f13619508ff366bde5b1c4f22	2026-02-19 02:11:47.530664+00	20230608225933_	\N	\N	2026-02-19 02:11:47.526908+00	1
ba7acca2-de4a-4051-9cad-ef8835f8e3f8	7025406d225d8958f21ff4c7f52d220a1576a62229f67bb8c286f88ef6eb5a55	2026-02-19 02:11:47.53664+00	20230608230406_	\N	\N	2026-02-19 02:11:47.533285+00	1
feb1681f-9f5f-4569-b787-443fb92cd6a5	80c76f4fb14738e182c56b8085d2caac61f1b8408a6019c27bba2c3eff790063	2026-02-19 02:11:47.63861+00	20231130185305_allow	\N	\N	2026-02-19 02:11:47.636057+00	1
e6d2fe8f-8c99-4699-a163-03fd44858d8e	ec00b2faf7e7159172133d4266025c3fa9af587704d89603e714aa9e0cb88a0c	2026-02-19 02:11:47.546861+00	20230609005323_	\N	\N	2026-02-19 02:11:47.538913+00	1
8222124f-8efe-4d40-afed-25086586f007	9cb51e0b7636fa960d2bd9f801893d4151f9fbecb6d7514cfd9cd8926b70ca3d	2026-02-19 02:11:47.590905+00	20231124180831_	\N	\N	2026-02-19 02:11:47.587739+00	1
143a9c0e-d9ca-4b3b-b55e-678670ae4240	860294f36475443c7025a807089db0265a484b939f75a42b7f12e45760ef20de	2026-02-19 02:11:47.551799+00	20230609201306_	\N	\N	2026-02-19 02:11:47.549057+00	1
0169b6ff-484f-4040-b645-bb26a1a2496a	8fd85366efc23463896729f613b3ac3fea69953935cbc03665bb4242c5aa3c58	2026-02-19 02:11:47.557026+00	20230610133106_	\N	\N	2026-02-19 02:11:47.553515+00	1
64def637-7df1-425d-871c-447bcf36ab96	0b7113408f428430d62571e444e6d2ad29be529ec78cb8dd4b133ed8233e3185	2026-02-19 02:11:47.595992+00	20231125042344_	\N	\N	2026-02-19 02:11:47.592825+00	1
8a4fb006-fd12-4665-afcf-e3e3b40af40d	82f6d259eb40ddff0fba4337568da52232209d947dd0cae9d7c1cf46fcedd76a	2026-02-19 02:11:47.64416+00	20231201011858_redirect	\N	\N	2026-02-19 02:11:47.640406+00	1
45cb5cf2-89b2-4106-b87e-33ea954ad41c	c6dfd3f5a34614651e620f1af7f70f806b3fc7a4c40e7bdaddffcab8dd9b41d8	2026-02-19 02:11:47.603318+00	20231125221631_hidden	\N	\N	2026-02-19 02:11:47.598629+00	1
b69be6b4-48ee-4fa3-9e2c-7fef46640c8a	eeece74a395f8e2811ba15d6ef2038f168bd410dae8ded2b6f5d0c7f26774d05	2026-02-19 02:11:47.608533+00	20231126212553_onboarding	\N	\N	2026-02-19 02:11:47.6059+00	1
f0e80a46-d4ee-49cc-b4e4-ecd30add259e	79b14f2a864b764a518b9d6c9d965cc93e321c395f51390d2b0eb8f6ef0cafa2	2026-02-19 02:11:47.710481+00	20240325230914_external_user	\N	\N	2026-02-19 02:11:47.707603+00	1
e328352d-abe1-4533-b4d0-52026f2c52c5	7804c2a98934be1d3a51a2b06b81d955e36c09b9f6b2b03a679348d9985cea77	2026-02-19 02:11:47.629215+00	20231130184144_uptime_kb_config	\N	\N	2026-02-19 02:11:47.610601+00	1
1fe6e2c3-c117-45dd-b1e2-858f172f3c99	4ce15ef6ecc90531e90c0d9196d43224a474b8964e91ef865379a860d1be1b1a	2026-02-19 02:11:47.675601+00	20231203224035_code	\N	\N	2026-02-19 02:11:47.665588+00	1
8909c0b7-dc41-4d71-b0e7-4e721c32a7de	ff65ce2f0a81027454c46b9a156c21d971809a2422b7ea9ee29632a095892379	2026-02-19 02:11:47.648578+00	20231202030625_	\N	\N	2026-02-19 02:11:47.645827+00	1
93f17dda-694b-4e8a-84f1-b00f4883a4a5	ec892b2cfa62bb007eeca0e60cd5d76a863b1d54d4ce7b6808811aec594db152	2026-02-19 02:11:47.652807+00	20231202030940_	\N	\N	2026-02-19 02:11:47.650157+00	1
0a43c391-2a82-4edd-96f7-99049d5d0d26	4417db9dc2a8f3b0b92c92d38e6d86b5100ec598b565a4c2858f470ca000d9e2	2026-02-19 02:11:47.70138+00	20240322235917_templates	\N	\N	2026-02-19 02:11:47.693293+00	1
8e3dd3e6-9bf9-4e9d-930b-2ff1957fd4cb	79d86dfe491b5f8f277c1dd73c3ee9d5efc58b2df3fe758ff85b5eda52d0e81e	2026-02-19 02:11:47.657603+00	20231202031821_	\N	\N	2026-02-19 02:11:47.654695+00	1
54912dfb-bc4d-447c-9475-8ec4afa42127	7696816ce98c01e07dc1596b080b5b09277dfbc4258a6d8543b6829d14aa8938	2026-02-19 02:11:47.686553+00	20231206001238_interanl_notifications	\N	\N	2026-02-19 02:11:47.678305+00	1
537fd8b7-3ce0-4df4-b100-9d38c66a0be1	22935297aa937d67f8eb7783d1f40b644ff0ad64f1d67bed093df2aa89e5835a	2026-02-19 02:11:47.691465+00	20231206002327_remove_title	\N	\N	2026-02-19 02:11:47.688535+00	1
620b8690-632b-4ce7-a6ea-f7981b5758b6	43efa652e51eb2cc1b2aa879e6d03cf4ec2782daecf8df0bb92c10328a9ac8f8	2026-02-19 02:11:47.705891+00	20240323000015_emailtemplate_recock	\N	\N	2026-02-19 02:11:47.703066+00	1
a8511114-190b-4489-a09f-ed4eae4c48ef	2fb35b4e5edabfd4d7299ab01196e2e1a06e395b3d6820b7263d43e5577fdef2	2026-02-19 02:11:47.722009+00	20240330224718_notifications	\N	\N	2026-02-19 02:11:47.717935+00	1
40389bd8-1c00-4690-9636-c450e0d36a64	bef488aa1aa35d50e8a0d4c0935f531548de33ae4fe6917303816dd7a7a4b42d	2026-02-19 02:11:47.715905+00	20240330132748_storage	\N	\N	2026-02-19 02:11:47.712138+00	1
76e01301-1d09-4bf4-ba78-096a343ebdf2	c45aa007d852c993c9403b6573f16c7fab48f46a5640649f29658ca0e7748e0f	2026-02-19 02:11:47.727447+00	20240531225221_createdby	\N	\N	2026-02-19 02:11:47.724474+00	1
0a95d2c4-4d69-45a5-8171-6884b10dad14	c4b7204737d09d06f608b803367162563a315331315e183e449698ebbad60805	2026-02-19 02:11:47.736773+00	20241014201131_openid	\N	\N	2026-02-19 02:11:47.729296+00	1
a461f84e-fdf8-4d9f-970e-2537d2e2d7f7	62bb4ef2589e0b67c7a944622f3f4b0ea012afb99f77eb59185ba89d66ad5e98	2026-02-19 02:11:47.757006+00	20241014203742_authentication	\N	\N	2026-02-19 02:11:47.738631+00	1
fbe12e58-6899-45a2-8ccd-169eba0b476e	ee8718b38a3e5d9a166eb0765877f4d6323411e420667c0466e102166890f076	2026-02-19 02:11:47.762632+00	20241014210350_cleanup	\N	\N	2026-02-19 02:11:47.758765+00	1
b0c889c4-8724-47f3-86ec-f66c3a55ad06	12a3f21f37426b09816e0dc7bcde9f36cec9dc1fd4ffd1004bc047ed0b913a80	2026-02-19 02:11:47.767821+00	20241018192053_drop_col	\N	\N	2026-02-19 02:11:47.764326+00	1
0897c8ce-f326-4d8e-984e-7fb1fbf88442	16db8d1768bf54406404b2b25bd45151ef849cbae026ece3e9e00a25e34aebea	2026-02-19 02:11:47.86373+00	20241114164206_sessions	\N	\N	2026-02-19 02:11:47.860612+00	1
22239624-52fd-4954-aa46-7db4df3de098	b4c04d9546c7eae180f292c683c653be29a0334351d8143d439311d100d151ce	2026-02-19 02:11:47.773474+00	20241020165331_oauth_email_authentication	\N	\N	2026-02-19 02:11:47.770199+00	1
2068eb63-85bb-4255-8f91-339a35b7932b	76ef6d248e98a1ebafacfa0e93d7dd9c5bf876dc25a09d5edfe53f5041415298	2026-02-19 02:11:47.778096+00	20241021215357_accesstokensmtp	\N	\N	2026-02-19 02:11:47.775159+00	1
0063fd2a-c6ae-4ce2-af6e-a43f8a761c25	9282a1422697a418386ca5641340d5469e9d2b991665bd8de1f2efed71e1eb88	2026-02-19 02:11:47.787943+00	20241021220058_bigint	\N	\N	2026-02-19 02:11:47.779853+00	1
1dcbf759-d5b2-4d1c-8695-f1c20d41a12b	2edea96ad30db2209c396f5821bb59275b55d889c9b5ddf24bb90624d5b864b3	2026-02-19 02:11:47.869084+00	20241115235800_following	\N	\N	2026-02-19 02:11:47.865764+00	1
3e0074de-3a94-4bb6-a122-d6581b04dae4	8148f0af8d70182bc16927e785514f373655125439dc969c2fc3d574ca812a2a	2026-02-19 02:11:47.793116+00	20241021230158_redirecturi	\N	\N	2026-02-19 02:11:47.789594+00	1
7bacc2ac-d3df-4ab8-a5fe-8fbb11bafb77	d2969c353ee55a5e8914a8d50a79b7a5924b38884a311d3a027c4c589751e26f	2026-02-19 02:11:47.797576+00	20241102020326_replyto_support	\N	\N	2026-02-19 02:11:47.79481+00	1
fe9d58e1-b71f-4198-a1c6-fe04e502e473	d093bb003e6d5e5b10638e144e366f823811d17fe9b414412cbbe50cd19edca7	2026-02-19 02:11:47.8044+00	20241104215009_imap_oauth	\N	\N	2026-02-19 02:11:47.799704+00	1
503b5ce4-fb68-4871-8ea4-da996a6f360c	b3ece5b2c5d2536d08d5609786d8365b70c1082e5d394136d1d38cf23ff4f70b	2026-02-19 02:11:47.875247+00	20241116014522_hold	\N	\N	2026-02-19 02:11:47.871349+00	1
a8497a90-1926-4e1a-913c-74bc60edba18	91d2154889536c542388b475c190c76e95a405b8e8a2fc89f60c333527f70e68	2026-02-19 02:11:47.809832+00	20241106185045_imap_password_optional	\N	\N	2026-02-19 02:11:47.807005+00	1
ebad83ef-fc01-4cad-bdaa-c6bc1472fd4f	006ce34cf42a2a7d1b0965518c3e50180b88d447165aed1eea0cbbc21f28506e	2026-02-19 02:11:47.814196+00	20241106233134_lock	\N	\N	2026-02-19 02:11:47.811453+00	1
3c1ae974-7370-42f4-b219-db627b2d2230	3e0f0591c927c14fd9becf093862cb10310b6e396c257a600cc5265e51ba5dda	2026-02-19 02:11:47.819731+00	20241106234810_cascade	\N	\N	2026-02-19 02:11:47.81611+00	1
e58846a1-4284-4822-9257-ec3ed555eb88	fd93709e4fc7b25dfb5b7ac88019c90ddcb61cf151c7afa00301298f9dbfe02b	2026-02-19 02:11:47.825817+00	20241111235707_edited_comment	\N	\N	2026-02-19 02:11:47.821862+00	1
e3cff2c9-da61-4c47-be6a-bad6d524a509	a98d58065a75de13c2822509a3139583a7031722f65604cbc82eddacdc72585b	2026-02-19 02:11:47.846134+00	20241113193825_rbac	\N	\N	2026-02-19 02:11:47.827885+00	1
a6606faf-e187-453e-a760-4a8cdf30ec5a	2d9092e9d16396cfd161acec1f302923401b39499fbcef902050e92752442f5a	2026-02-19 02:11:47.852259+00	20241113195413_role_active	\N	\N	2026-02-19 02:11:47.848416+00	1
10deabe5-2e19-488c-915b-5dd17e097a40	2d9d30a4681b238220b0a3beaccd1ea3c41bfe422ab510dd3fcdf84109e22c55	2026-02-19 02:11:47.858631+00	20241113200612_update_types	\N	\N	2026-02-19 02:11:47.854747+00	1
\.


--
-- Data for Name: emailTemplate; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."emailTemplate" (id, "createdAt", "updatedAt", type, html) FROM stdin;
910c352f-0402-42cb-a9d9-5cdebe157ed6	2026-02-19 02:11:48.882	2026-02-19 02:11:48.882	ticket_assigned	<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n          <html lang="en">\n            <head>\n              <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />\n            </head>\n            <div id="" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Ticket Created<div></div>\n            </div>\n  \n            <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, &#x27;Segoe UI&#x27;, &#x27;Roboto&#x27;, &#x27;Oxygen&#x27;, &#x27;Ubuntu&#x27;, &#x27;Cantarell&#x27;, &#x27;Fira Sans&#x27;, &#x27;Droid Sans&#x27;, &#x27;Helvetica Neue&#x27;, sans-serif">\n              <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">\n                <tr style="width:100%">\n                  <td>\n                    <table style="margin-top:8px" align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">\n                    </table>\n                    <h1 style="color:#1d1c1d;font-size:16px;font-weight:700;margin:10px 0;padding:0;line-height:42px">Ticket Assigned</h1>\n                    <p style="font-size:20px;line-height:28px;margin:4px 0">\n                    <p>Hello, <br>A new ticket has been assigned to you.</p>\n                    <p style="font-size:14px;margin:16px 0;color:#000">\n                    Kind regards, \n  \n                    <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">\n                      <tbody>\n                        <tr>\n                          <td>\n                            <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://docs.peppermint.sh" rel="noopener noreferrer">Documentation</a>   |   <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://discord.gg/8XFkbgKmgv" rel="noopener noreferrer">Discord</a> </a>\n                            <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left">This was an automated message sent by peppermint.sh -> An open source helpdesk solution</p>\n                            <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left;margin-bottom:50px">©2022 Peppermint Ticket Management, a Peppermint Labs product.<br />All rights reserved.</p>\n                          </td>\n                        </tr>\n                      </tbody>\n                    </table>\n                  </td>\n                </tr>\n              </table>\n            </body>\n          </html>
fad7aa43-b35f-47f0-8ef0-f8a9d6225473	2026-02-19 02:11:48.882	2026-02-19 02:11:48.882	ticket_comment	 <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n          <html lang="en">\n\n            <head>\n              <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />\n            </head>\n            <div id="" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Ticket Created<div></div>\n            </div>\n\n            <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, &#x27;Segoe UI&#x27;, &#x27;Roboto&#x27;, &#x27;Oxygen&#x27;, &#x27;Ubuntu&#x27;, &#x27;Cantarell&#x27;, &#x27;Fira Sans&#x27;, &#x27;Droid Sans&#x27;, &#x27;Helvetica Neue&#x27;, sans-serif">\n              <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">\n                <tr style="width:100%">\n                  <td>\n                    <table style="margin-top:8px" align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">\n                    </table>\n                    <h1 style="color:#1d1c1d;font-size:16px;font-weight:700;margin:10px 0;padding:0;line-height:42px">Ticket Update for: {{title}}</h1>\n                    <p style="font-size:20px;line-height:28px;margin:4px 0">\n                    <p>{{comment}}</p>\n                    <p style="font-size:14px;margin:16px 0;color:#000">\n                    Kind regards, \n\n                    <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">\n                      <tbody>\n                        <tr>\n                          <td>\n                          <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://docs.peppermint.sh" rel="noopener noreferrer">Documentation</a>   |   <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://discord.gg/8XFkbgKmgv" rel="noopener noreferrer">Discord</a> </a>\n                          <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left">This was an automated message sent by peppermint.sh -> An open source helpdesk solution</p>\n                            <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left;margin-bottom:50px">©2022 Peppermint Ticket Management, a Peppermint Labs product.<br />All rights reserved.</p>\n                          </td>\n                        </tr>\n                      </tbody>\n                    </table>\n                  </td>\n                </tr>\n              </table>\n            </body>\n          </html>
c552cc7e-a79f-47b8-84da-c8ccff2ec8d9	2026-02-19 02:11:48.882	2026-02-19 02:11:48.882	ticket_created	 <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n          <html lang="en">\n\n            <head>\n              <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />\n            </head>\n            <div id="" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Ticket Created<div></div>\n            </div>\n\n            <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, &#x27;Segoe UI&#x27;, &#x27;Roboto&#x27;, &#x27;Oxygen&#x27;, &#x27;Ubuntu&#x27;, &#x27;Cantarell&#x27;, &#x27;Fira Sans&#x27;, &#x27;Droid Sans&#x27;, &#x27;Helvetica Neue&#x27;, sans-serif">\n              <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">\n                <tr style="width:100%">\n                  <td>\n                    <table style="margin-top:8px" align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">\n                    </table>\n                    <h1 style="color:#1d1c1d;font-size:16px;font-weight:700;margin:10px 0;padding:0;line-height:42px">Ticket Created: {{id}}</h1>\n                    <p style="font-size:20px;line-height:28px;margin:4px 0">\n                    <p>Hello, <br>Your ticket has now been created and logged.</p>\n                    <p style="font-size:14px;margin:16px 0;color:#000">\n                    Kind regards, \n\n                    <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">\n                      <tbody>\n                        <tr>\n                          <td>\n                          <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://docs.peppermint.sh" rel="noopener noreferrer">Documentation</a>   |   <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://discord.gg/8XFkbgKmgv" rel="noopener noreferrer">Discord</a> </a>\n                          <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left">This was an automated message sent by peppermint.sh -> An open source helpdesk solution</p>\n                            <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left;margin-bottom:50px">©2022 Peppermint Ticket Management, a Peppermint Labs product.<br />All rights reserved.</p>\n                          </td>\n                        </tr>\n                      </tbody>\n                    </table>\n                  </td>\n                </tr>\n              </table>\n            </body>\n\n          </html>
8154775e-508c-4961-a7db-48f3c613ecb8	2026-02-19 02:11:48.882	2026-02-19 02:11:48.882	ticket_status_changed	 <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n          <html lang="en">\n          \n            <head>\n              <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />\n            </head>\n            <div id="" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Ticket Created<div></div>\n            </div>\n          \n            <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, &#x27;Segoe UI&#x27;, &#x27;Roboto&#x27;, &#x27;Oxygen&#x27;, &#x27;Ubuntu&#x27;, &#x27;Cantarell&#x27;, &#x27;Fira Sans&#x27;, &#x27;Droid Sans&#x27;, &#x27;Helvetica Neue&#x27;, sans-serif">\n              <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">\n                <tr style="width:100%">\n                  <td>\n                    <table style="margin-top:8px" align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">\n                      <tbody>\n                        <tr>\n                          <td><img alt="Slack" src="https://raw.githubusercontent.com/Peppermint-Lab/peppermint/next/static/black-side-logo.svg" width="200" height="60" style="display:block;outline:none;border:none;text-decoration:none" /></td>\n                        </tr>\n                      </tbody>\n                    </table>\n                    <h1 style="color:#1d1c1d;font-size:16px;font-weight:700;margin:10px 0;padding:0;line-height:42px">Ticket: {{title}}</h1>\n                    <p style="font-size:20px;line-height:28px;margin:4px 0">\n                    <p>Your Ticket, now has a status of {{status}}</p>\n                    Kind regards, \n                    <br>\n                    Peppermint ticket management\n                    </p>\n                    \n                    <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">\n                      <tbody>\n                        <tr>\n                          <td>\n                          <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://docs.peppermint.sh" rel="noopener noreferrer">Documentation</a>   |   <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://discord.gg/8XFkbgKmgv" rel="noopener noreferrer">Discord</a> </a>\n                          <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left">This was an automated message sent by peppermint.sh -> An open source helpdesk solution</p>\n                            <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left;margin-bottom:50px">©2022 Peppermint Ticket Management, a Peppermint Labs product.<br />All rights reserved.</p>\n                          </td>\n                        </tr>\n                      </tbody>\n                    </table>\n                  </td>\n                </tr>\n              </table>\n            </body>\n          \n          </html>
\.


--
-- Data for Name: knowledgeBase; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."knowledgeBase" (id, "createdAt", "updatedAt", title, content, tags, author, public, "ticketId") FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public.notifications (id, "createdAt", "updatedAt", read, text, "userId", "ticketId") FROM stdin;
9d77328f-09a5-4b45-af40-287e172f61e2	2026-02-20 04:29:34.748	2026-02-20 04:29:34.748	f	Ticket #8 was assigned to Guest by admin	c81074c4-1660-4477-b707-70827fb31298	32970646-bc7e-4783-a26b-61b653d802bf
e3d5006d-f696-4089-b27b-63240fc2f5e8	2026-02-23 01:53:42.067	2026-02-23 01:53:42.067	f	#9 status changed to Closed by Guest	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	8aaa4d2f-7e46-460d-bce4-7d4767b9ad33
1c0c400e-fd9e-4240-9ef9-033e91f1c350	2026-02-23 01:53:44.501	2026-02-23 01:53:44.501	f	#9 status changed to Closed by Guest	22a7a8ae-f61e-493b-9a50-b1d5d4875d2b	8aaa4d2f-7e46-460d-bce4-7d4767b9ad33
\.


--
-- Data for Name: openIdConfig; Type: TABLE DATA; Schema: public; Owner: peppermint
--

COPY public."openIdConfig" (id, "clientId", issuer, "redirectUri") FROM stdin;
\.


--
-- Name: OAuthProvider_id_seq; Type: SEQUENCE SET; Schema: public; Owner: peppermint
--

SELECT pg_catalog.setval('public."OAuthProvider_id_seq"', 1, false);


--
-- Name: SAMLProvider_id_seq; Type: SEQUENCE SET; Schema: public; Owner: peppermint
--

SELECT pg_catalog.setval('public."SAMLProvider_id_seq"', 1, false);


--
-- Name: Ticket_Number_seq; Type: SEQUENCE SET; Schema: public; Owner: peppermint
--

SELECT pg_catalog.setval('public."Ticket_Number_seq"', 9, true);


--
-- Name: openIdConfig_id_seq; Type: SEQUENCE SET; Schema: public; Owner: peppermint
--

SELECT pg_catalog.setval('public."openIdConfig_id_seq"', 1, false);


--
-- Name: Client Client_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_pkey" PRIMARY KEY (id);


--
-- Name: Comment Comment_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_pkey" PRIMARY KEY (id);


--
-- Name: Config Config_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Config"
    ADD CONSTRAINT "Config_pkey" PRIMARY KEY (id);


--
-- Name: Discord Discord_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Discord"
    ADD CONSTRAINT "Discord_pkey" PRIMARY KEY (id);


--
-- Name: EmailQueue EmailQueue_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."EmailQueue"
    ADD CONSTRAINT "EmailQueue_pkey" PRIMARY KEY (id);


--
-- Name: Email Email_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Email"
    ADD CONSTRAINT "Email_pkey" PRIMARY KEY (id);


--
-- Name: Imap_Email Imap_Email_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Imap_Email"
    ADD CONSTRAINT "Imap_Email_pkey" PRIMARY KEY (id);


--
-- Name: Notes Notes_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Notes"
    ADD CONSTRAINT "Notes_pkey" PRIMARY KEY (id);


--
-- Name: OAuthProvider OAuthProvider_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."OAuthProvider"
    ADD CONSTRAINT "OAuthProvider_pkey" PRIMARY KEY (id);


--
-- Name: PasswordResetToken PasswordResetToken_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY (id);


--
-- Name: Role Role_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Role"
    ADD CONSTRAINT "Role_pkey" PRIMARY KEY (id);


--
-- Name: SAMLProvider SAMLProvider_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."SAMLProvider"
    ADD CONSTRAINT "SAMLProvider_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: Slack Slack_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Slack"
    ADD CONSTRAINT "Slack_pkey" PRIMARY KEY (id);


--
-- Name: Team Team_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_pkey" PRIMARY KEY (id);


--
-- Name: TicketFile TicketFile_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."TicketFile"
    ADD CONSTRAINT "TicketFile_pkey" PRIMARY KEY (id);


--
-- Name: Ticket Ticket_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_pkey" PRIMARY KEY (id);


--
-- Name: TimeTracking TimeTracking_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."TimeTracking"
    ADD CONSTRAINT "TimeTracking_pkey" PRIMARY KEY (id);


--
-- Name: Todos Todos_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Todos"
    ADD CONSTRAINT "Todos_pkey" PRIMARY KEY (id);


--
-- Name: Uptime Uptime_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Uptime"
    ADD CONSTRAINT "Uptime_pkey" PRIMARY KEY (id);


--
-- Name: UserFile UserFile_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."UserFile"
    ADD CONSTRAINT "UserFile_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Webhooks Webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Webhooks"
    ADD CONSTRAINT "Webhooks_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: emailTemplate emailTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."emailTemplate"
    ADD CONSTRAINT "emailTemplate_pkey" PRIMARY KEY (id);


--
-- Name: knowledgeBase knowledgeBase_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."knowledgeBase"
    ADD CONSTRAINT "knowledgeBase_pkey" PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: openIdConfig openIdConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."openIdConfig"
    ADD CONSTRAINT "openIdConfig_pkey" PRIMARY KEY (id);


--
-- Name: Client_email_key; Type: INDEX; Schema: public; Owner: peppermint
--

CREATE UNIQUE INDEX "Client_email_key" ON public."Client" USING btree (email);


--
-- Name: OAuthProvider_name_key; Type: INDEX; Schema: public; Owner: peppermint
--

CREATE UNIQUE INDEX "OAuthProvider_name_key" ON public."OAuthProvider" USING btree (name);


--
-- Name: PasswordResetToken_code_key; Type: INDEX; Schema: public; Owner: peppermint
--

CREATE UNIQUE INDEX "PasswordResetToken_code_key" ON public."PasswordResetToken" USING btree (code);


--
-- Name: Role_name_key; Type: INDEX; Schema: public; Owner: peppermint
--

CREATE UNIQUE INDEX "Role_name_key" ON public."Role" USING btree (name);


--
-- Name: SAMLProvider_name_key; Type: INDEX; Schema: public; Owner: peppermint
--

CREATE UNIQUE INDEX "SAMLProvider_name_key" ON public."SAMLProvider" USING btree (name);


--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: peppermint
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: peppermint
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: _RoleToUser_AB_unique; Type: INDEX; Schema: public; Owner: peppermint
--

CREATE UNIQUE INDEX "_RoleToUser_AB_unique" ON public."_RoleToUser" USING btree ("A", "B");


--
-- Name: _RoleToUser_B_index; Type: INDEX; Schema: public; Owner: peppermint
--

CREATE INDEX "_RoleToUser_B_index" ON public."_RoleToUser" USING btree ("B");


--
-- Name: Comment Comment_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comment Comment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Imap_Email Imap_Email_emailQueueId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Imap_Email"
    ADD CONSTRAINT "Imap_Email_emailQueueId_fkey" FOREIGN KEY ("emailQueueId") REFERENCES public."EmailQueue"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notes Notes_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Notes"
    ADD CONSTRAINT "Notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TicketFile TicketFile_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."TicketFile"
    ADD CONSTRAINT "TicketFile_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TicketFile TicketFile_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."TicketFile"
    ADD CONSTRAINT "TicketFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Ticket Ticket_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Ticket Ticket_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Ticket Ticket_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TimeTracking TimeTracking_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."TimeTracking"
    ADD CONSTRAINT "TimeTracking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TimeTracking TimeTracking_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."TimeTracking"
    ADD CONSTRAINT "TimeTracking_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TimeTracking TimeTracking_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."TimeTracking"
    ADD CONSTRAINT "TimeTracking_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Todos Todos_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."Todos"
    ADD CONSTRAINT "Todos_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UserFile UserFile_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."UserFile"
    ADD CONSTRAINT "UserFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: User User_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: _RoleToUser _RoleToUser_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."_RoleToUser"
    ADD CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _RoleToUser _RoleToUser_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."_RoleToUser"
    ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: knowledgeBase knowledgeBase_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public."knowledgeBase"
    ADD CONSTRAINT "knowledgeBase_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notifications notifications_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notifications notifications_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: peppermint
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict VlwzBai4EHeACVLO3Xi5fXTbYpQQFZsP7g3ioyvbI1Q7Yea5IPLqmbNBzdvKTCs

