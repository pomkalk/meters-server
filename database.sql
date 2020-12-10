-- Users table;
CREATE TABLE users (
    id  SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(180) NOT NULL,
    password_expired TIMESTAMPTZ NULL,
    last_online TIMESTAMPTZ NULL,
    permissions VARCHAR(300) NULL,
    supplier_id INTEGER NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON users (name, username, supplier_id);


-- Suppliers table;
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    address VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX ON suppliers (name, deleted_at);

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
    name VARCHAR(255) NOT NULL DEFAULT '',
    phone VARCHAR(100) NULL,
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
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    file_id INTEGER NOT NULL,
    p_start TIMESTAMPTZ NOT NULL,
    p_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON periods (month, year, file_id, p_start, p_end);


-- Upload files for import data
CREATE TABLE imports (
    id SERIAL PRIMARY KEY,
    addr VARCHAR(255) NOT NULL,
    sc VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Meters
CREATE TABLE meters (
    id SERIAL PRIMARY KEY,
    period_id INTEGER NOT NULL,
    ls INTEGER NOT NULL,
    mid INTEGER NOT NULL,
    type INTEGER NOT NULL,
    status INTEGER NOT NULL,
    last_month INTEGER NOT NULL,
    last_year INTEGER NOT NULL,
    last_value NUMERIC NOT NULL,
    new_value NUMERIC NOT NULL,
    new_date TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON meters (period_id, ls, mid, type, status);


-- Config
CREATE TABLE config (
    n INTEGER NOT NULL,
    key VARCHAR(30) PRIMARY KEY,
    valt VARCHAR(255) NULL,
    valj JSON NULL,
    valb BOOLEAN NULL,
    vali INTEGER NULL
);


-- -- Feedbacks
-- CREATE TABLE feedbacks (
--     id SERIAL PRIMARY KEY,
--     ls INTEGER NOT NULL,
--     question TEXT NOT NULL,

--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );