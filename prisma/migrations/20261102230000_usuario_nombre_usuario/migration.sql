-- El personal se identifica con un nombre de usuario (ej. "cocina1", "jperez" o un legajo) en lugar de un email.
-- Se conservan los usuarios existentes: "admin@kitch.local" pasa a "admin" (la cuenta de Firebase no cambia).
-- SQL compatible con MySQL y MariaDB (XAMPP): CHANGE en lugar de RENAME COLUMN.

UPDATE `usuario` SET `email` = LOWER(SUBSTRING_INDEX(`email`, '@', 1));

DROP INDEX `uq_usuario_email` ON `usuario`;

ALTER TABLE `usuario` CHANGE `email` `nombre_usuario` VARCHAR(30) NOT NULL;

CREATE UNIQUE INDEX `uq_usuario_nombre_usuario` ON `usuario`(`nombre_usuario`);
