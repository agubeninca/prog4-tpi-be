-- Mozos del salón (sin login): se eligen al cargar una comanda a mano.
CREATE TABLE `mozo` (
    `id_mozo` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `archivado` BOOLEAN NOT NULL DEFAULT false,
    `fecha_creacion` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `fecha_actualizacion` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_mozo_nombre`(`nombre`),
    PRIMARY KEY (`id_mozo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Mozo que atiende la mesa del pedido (null en los pedidos hechos por QR y en los anteriores a este cambio).
ALTER TABLE `pedido` ADD COLUMN `id_mozo` INTEGER NULL;
CREATE INDEX `fk_pedido_mozo` ON `pedido`(`id_mozo`);
ALTER TABLE `pedido` ADD CONSTRAINT `fk_pedido_mozo` FOREIGN KEY (`id_mozo`) REFERENCES `mozo`(`id_mozo`) ON DELETE NO ACTION ON UPDATE NO ACTION;
