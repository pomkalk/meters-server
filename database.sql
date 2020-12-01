-- Users table;
CREATE TABLE users (
    id  SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(180) NOT NULL,
    last_online TIMESTAMPTZ NULL,
    permissions VARCHAR(25)[] NOT NULL,
    supplier_id INTEGER NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON users (name, username, role, supplier_id);


-- Suppliers table;
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    address VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON suppliers (name);

-- Streets table;
CREATE TABLE streets (
    id SERIAL PRIMARY KEY,
    type VARCHAR(10) NOT NULL,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON streets (type, name);

-- Buildings table;
CREATE TABLE buildings (
    id SERIAL PRIMARY KEY,
    street_id INTEGER NOT NULL,
    number INTEGER NOT NULL,
    housing VARCHAR(5) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON buildings (street_id, number, housing);

-- Apartment table;
CREATE TABLE apartments (
    id SERIAL PRIMARY KEY,
    ls INTEGER NOT NULL,
    building_id INTEGER NOT NULL,
    number INTEGER NOT NULL,
    part VARCHAR(10) NOT NULL DEFAULT '',
    space NUMERIC NOT NULL DEFAULT 0,
    supplier_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON apartments (ls, building_id, number, part, space, supplier_id);

-- Periods table;
CREATE TABLE periods (
    id SERIAL PRIMARY KEY,

);