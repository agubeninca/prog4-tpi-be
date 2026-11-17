-- Turnos de caja: se abren con el efectivo inicial y se cierran contando la plata (arqueo).
-- `abierto` vale 1 mientras el turno está abierto y NULL al cerrarlo: el índice único impide tener dos abiertos.
CREATE TABLE `turno` (
    `id_turno` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` ENUM('MANANA', 'TARDE', 'NOCHE') NOT NULL,
    `abierto` BOOLEAN NULL,
    `fecha_apertura` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `id_usuario_apertura` INTEGER NOT NULL,
    `efectivo_inicial` DECIMAL(10, 2) NOT NULL,
    `fecha_cierre` DATETIME(0) NULL,
    `id_usuario_cierre` INTEGER NULL,
    `efectivo_esperado` DECIMAL(10, 2) NULL,
    `efectivo_contado` DECIMAL(10, 2) NULL,
    `diferencia` DECIMAL(10, 2) NULL,
    `observacion_cierre` VARCHAR(255) NULL,
    `resumen` JSON NULL,

    UNIQUE INDEX `uq_turno_abierto`(`abierto`),
    INDEX `fk_turno_usuario_apertura`(`id_usuario_apertura`),
    INDEX `fk_turno_usuario_cierre`(`id_usuario_cierre`),
    PRIMARY KEY (`id_turno`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `turno` ADD CONSTRAINT `fk_turno_usuario_apertura` FOREIGN KEY (`id_usuario_apertura`) REFERENCES `usuario`(`id_usuario`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `turno` ADD CONSTRAINT `fk_turno_usuario_cierre` FOREIGN KEY (`id_usuario_cierre`) REFERENCES `usuario`(`id_usuario`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Turno en el que se cobró cada pedido (los cobrados antes de este cambio quedan sin turno).
ALTER TABLE `pedido` ADD COLUMN `id_turno_pago` INTEGER NULL;
CREATE INDEX `fk_pedido_turno_pago` ON `pedido`(`id_turno_pago`);
ALTER TABLE `pedido` ADD CONSTRAINT `fk_pedido_turno_pago` FOREIGN KEY (`id_turno_pago`) REFERENCES `turno`(`id_turno`) ON DELETE NO ACTION ON UPDATE NO ACTION;
