-- Table Definition ----------------------------------------------

CREATE TABLE nfts (
    nft_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stake_account_id bigint REFERENCES stake_accounts(stake_account_id),
    nft_address text NOT NULL UNIQUE,
    nft_owner_address text NOT NULL,
    nft_create_time timestamp with time zone NOT NULL DEFAULT now(),
    nft_update_time timestamp with time zone NOT NULL,
    nft_details jsonb,
    nft_name text
);

-- Indices -------------------------------------------------------

CREATE UNIQUE INDEX nfts_pkey ON nfts(nft_id int8_ops);
CREATE UNIQUE INDEX nfts_nft_address_key ON nfts(nft_address text_ops);
CREATE INDEX nfts_nft_owner_address_idx ON nfts(nfts_owner_address text_ops);

-- Table Definition ----------------------------------------------

CREATE TABLE stake_accounts (
    stake_account_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stake_account_address text NOT NULL UNIQUE,
    stake_account_stake_authority text NOT NULL,
    stake_account_withdraw_authority text NOT NULL,
    stake_account_voter_authority text NOT NULL,
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

CREATE TABLE nfts_vest (
    nft_vest_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nft_address text NOT NULL UNIQUE,
    nft_owner_address text NOT NULL,
    nft_vest_thawed boolean NOT NULL DEFAULT false,
    nft_vest_thawed_time timestamp with time zone,
    nft_vest_details jsonb,
    nft_vest_message_sent boolean DEFAULT false
);

-- Indices -------------------------------------------------------

CREATE UNIQUE INDEX nfts_vest_pkey ON nfts_vest(nft_vest_id int8_ops);
CREATE UNIQUE INDEX nfts_vest_nft_address_key ON nfts_vest(nft_address text_ops);
CREATE INDEX nfts_vest_nft_owner_address_idx ON nfts_vest(nft_owner_address text_ops);
