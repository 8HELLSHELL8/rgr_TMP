CREATE TABLE IF NOT EXISTS qualifications(
    id SERIAL PRIMARY KEY,
    name VARCHAR(31),
    description TEXT
);

CREATE TABLE IF NOT EXISTS license_level(
    id SERIAL PRIMARY KEY,
    name VARCHAR(63) NOT NULL,
    access_up_to_gun INT NOT NULL,
    access_up_to_specials INT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS barracks(
    id SERIAL PRIMARY KEY,
    name VARCHAR(127),
    coordinates POINT,
    description TEXT
);

CREATE TABLE IF NOT EXISTS soldiers(
    id SERIAL PRIMARY KEY,
    name VARCHAR(63) NOT NULL,
    surname VARCHAR(63) NOT NULL,
    lastname VARCHAR(63),
    qualification INT REFERENCES qualifications (id) NOT NULL,
    license_level INT REFERENCES license_level (id) NOT NULL,
    barrack_id INT REFERENCES barracks (id) NOT NULL,
    hired_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weapon_type(
    id SERIAL PRIMARY KEY,
    name VARCHAR(63),
    license_level_needed INT REFERENCES license_level (id) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS weapon_statuses(
    id SERIAL PRIMARY KEY,
    name VARCHAR(31) NOT NULL
);

CREATE TABLE IF NOT EXISTS weapon(
    id SERIAL PRIMARY KEY,
    name VARCHAR(63) NOT NULL,
    type INT REFERENCES weapon_type (id) NOT NULL,
    status INT REFERENCES weapon_statuses NOT NULL,
    last_maintenance TIMESTAMP DEFAULT NOW(),
    description TEXT
);

CREATE TABLE IF NOT EXISTS specials_type(
    id SERIAL PRIMARY KEY,
    name VARCHAR(31),
    license_level_needed INT REFERENCES license_level (id) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS specials(
    id SERIAL PRIMARY KEY,
    name VARCHAR(63) NOT NULL,
    type INT REFERENCES specials_type(id) NOT NULL,
    status INT REFERENCES weapon_statuses NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS actions(
    id SERIAL PRIMARY KEY,
    name VARCHAR(31) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS action_status(
    id SERIAL PRIMARY KEY,
    name VARCHAR(31) NOT NULL
);

CREATE TABLE IF NOT EXISTS logs(
    id SERIAL PRIMARY KEY,
    soldier INT REFERENCES soldiers (id) NOT NULL,
    gun_taken INT REFERENCES weapon (id),
    specials_taken INT REFERENCES specials (id),
    action_type INT REFERENCES actions (id) NOT NULL,
    action_time TIMESTAMP DEFAULT NOW(),
    status INT REFERENCES action_status(id) NOT NULL,
    comment TEXT
);

CREATE TABLE IF NOT EXISTS roles(
    id SERIAL PRIMARY KEY,
    name VARCHAR(31),
    description TEXT
);

CREATE TABLE IF NOT EXISTS system_users(
    id SERIAL PRIMARY KEY,
    name VARCHAR(63) NOT NULL,
    surname VARCHAR(63) NOT NULL,
    lastname VARCHAR(63),
    role INT REFERENCES roles (id),
    password VARCHAR(255),
    current_token VARCHAR(255)
);

-- Таблица action_status (уже существует)
INSERT INTO action_status (name) VALUES 
('access denied'),
('access granted'),
('successful'),
('failed');

-- Таблица qualifications
INSERT INTO qualifications (name, description) VALUES
('Sniper', 'Specialized in long-range shooting'),
('Engineer', 'Expert in repairing and maintaining equipment'),
('Medic', 'Provides medical support to soldiers'),
('Communications Specialist', 'Handles communication devices and encryption');

-- Таблица license_level
INSERT INTO license_level (name, access_up_to_gun, access_up_to_specials, description) VALUES
('Level 1', 1, 1, 'Basic access to small arms and basic communication devices'),
('Level 2', 2, 2, 'Access to intermediate weapons and advanced communication devices'),
('Level 3', 3, 3, 'Full access to all weapons and special equipment');

-- Таблица barracks
INSERT INTO barracks (name, coordinates, description) VALUES
('Main Barracks', POINT(55.7558, 37.6173), 'Central military base located in Moscow'),
('Northern Outpost', POINT(60.1920, 24.9458), 'Remote outpost in the northern region'),
('Southern Camp', POINT(43.7319, 7.4187), 'Training camp in the southern region');

-- Таблица soldiers
INSERT INTO soldiers (name, surname, lastname, qualification, license_level, barrack_id) VALUES
('John', 'Doe', 'Smith', 1, 1, 1),
('Jane', 'Roe', 'Johnson', 2, 2, 1),
('Alice', 'Brown', 'Williams', 3, 3, 2),
('Bob', 'Davis', 'Jones', 4, 1, 3);

-- Таблица weapon_type
INSERT INTO weapon_type (name, license_level_needed, description) VALUES
('Pistol', 1, 'Small firearm for close-range combat'),
('Rifle', 2, 'Standard infantry weapon for medium-range combat'),
('Sniper Rifle', 3, 'High-precision weapon for long-range engagements'),
('Machine Gun', 3, 'Heavy weapon for suppressing enemy forces');

-- Таблица weapon_statuses
INSERT INTO weapon_statuses (name) VALUES
('In Stock'),
('Issued'),
('Taken'),
('Under Repair');

-- Таблица weapon
INSERT INTO weapon (name, type, status, last_maintenance, description) VALUES
('Glock 17', 1, 1, '2023-01-15', 'Standard issue pistol'),
('AK-47', 2, 1, '2023-02-10', 'Reliable assault rifle'),
('Barrett M82', 3, 2, '2023-03-05', 'Powerful sniper rifle'),
('M249 SAW', 4, 3, '2023-04-20', 'Light machine gun for squad support');

-- Таблица specials_type
INSERT INTO specials_type (name, license_level_needed, description) VALUES
('Radio', 1, 'Basic communication device'),
('Encryption Device', 2, 'Device for secure communication'),
('Drone', 3, 'Unmanned aerial vehicle for reconnaissance');

-- Таблица specials
INSERT INTO specials (name, type, status, description) VALUES
('Handheld Radio', 1, 1, 'Portable communication device'),
('Cipher Machine', 2, 2, 'Encrypts and decrypts messages'),
('Recon Drone', 3, 1, 'Drone equipped with cameras and sensors');

-- Таблица actions
INSERT INTO actions (name, description) VALUES
('Taken', 'Weapon or equipment has been issued to a soldier'),
('Returned', 'Weapon or equipment has been returned to storage'),
('Maintenance', 'Weapon or equipment is under repair');

-- Таблица logs — обновленная версия с учетом нового поля `status`
INSERT INTO logs (soldier, gun_taken, specials_taken, action_type, action_time, status, comment) VALUES
(1, 1, NULL, 1, NOW(), 2, 'Issued Glock 17 for training'),
(2, NULL, 1, 1, NOW(), 2, 'Issued Handheld Radio for mission'),
(3, 2, NULL, 1, NOW(), 2, 'Issued AK-47 for patrol'),
(4, NULL, 2, 1, NOW(), 2, 'Issued Cipher Machine for secure communication'),
(1, 1, NULL, 2, NOW(), 2, 'Returned Glock 17 after training'),
(2, NULL, 1, 2, NOW(), 2, 'Returned Handheld Radio after mission'),
(3, 2, NULL, 3, NOW(), 4, 'AK-47 sent for maintenance');

-- Таблица roles
INSERT INTO roles (name, description) VALUES
('Main system administrator', 'Full access to the system'),
('Warehouse Operator', 'Manages weapon and equipment inventory');

-- Таблица system_users
INSERT INTO system_users (name, surname, lastname, role, password) VALUES
('admin', 'admin', 'admin', 1, '$2b$10$7QJAhrZQJlVhFfIAe7we2.g1vXQmVUN5BxH68VOC5tLYjft.6BJLm'), 
('user', 'user', 'user', 2, '$2b$10$plYle8DJLntIIgUKzsjYseiOcmLgQhy1EpFxXV9NUIrWsFQaOGFyi'), 
('user1', 'user1', 'user1', 2, '$2b$10$5Em/T/Nrbd9S7fUBGHg0c.vkzm8x5VpF7q21DzEsZyvogLpWQC14W');