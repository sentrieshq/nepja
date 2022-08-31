-- Table Definition ----------------------------------------------

CREATE TABLE sentries (
    sentry_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stake_account_id bigint REFERENCES stake_accounts(stake_account_id),
    sentry_address text NOT NULL UNIQUE,
    sentry_owner_address text NOT NULL,
    sentry_create_time timestamp with time zone NOT NULL DEFAULT now(),
    sentry_update_time timestamp with time zone NOT NULL,
    sentry_details jsonb,
    sentry_name text
);

-- Indices -------------------------------------------------------

CREATE UNIQUE INDEX sentries_pkey ON sentries(sentry_id int8_ops);
CREATE UNIQUE INDEX sentries_sentry_address_key ON sentries(sentry_address text_ops);
CREATE INDEX sentries_sentry_owner_address_idx ON sentries(sentry_owner_address text_ops);

-- Table Definition ----------------------------------------------

CREATE TABLE stake_accounts (
    stake_account_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stake_account_address text NOT NULL UNIQUE,
    stake_account_stake_authority text NOT NULL,
    stake_account_withdraw_authority text NOT NULL,
    stake_account_stake numeric,
    stake_account_active boolean DEFAULT false,
    stake_account_create_time timestamp with time zone NOT NULL DEFAULT now(),
    stake_account_update_time timestamp with time zone NOT NULL,
    stake_account_details jsonb
);

-- Indices -------------------------------------------------------

CREATE UNIQUE INDEX stake_accounts_pkey ON stake_accounts(stake_account_id int8_ops);
CREATE UNIQUE INDEX stake_accounts_stake_account_address_key ON stake_accounts(stake_account_address text_ops);
CREATE INDEX stake_accounts_stake_account_stake_authority_idx ON stake_accounts(stake_account_stake_authority text_ops);
CREATE INDEX stake_accounts_stake_account_withdraw_authority_idx ON stake_accounts(stake_account_withdraw_authority text_ops);

-- Table Definition ----------------------------------------------

CREATE TABLE sentries_vest (
    sentry_vest_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sentry_address text NOT NULL UNIQUE,
    sentry_owner_address text NOT NULL,
    sentry_vest_thawed boolean NOT NULL DEFAULT false,
    sentry_vest_thawed_time timestamp with time zone,
    sentry_vest_details jsonb,
    sentry_vest_message_sent boolean DEFAULT false
);

-- Indices -------------------------------------------------------

CREATE UNIQUE INDEX sentries_vest_pkey ON sentries_vest(sentry_vest_id int8_ops);
CREATE UNIQUE INDEX sentries_vest_sentry_address_key ON sentries_vest(sentry_address text_ops);
CREATE INDEX sentries_vest_sentry_owner_address_idx ON sentries_vest(sentry_owner_address text_ops);
