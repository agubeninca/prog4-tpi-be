-- La Barra puede cargar comandas a mano (clientes que no escanean el QR).
-- Cada pedido indica su origen y las comandas manuales quedan registradas con horario y detalle.
ALTER TABLE `pedido` ADD COLUMN `origen` ENUM('QR', 'MANUAL') NOT NULL DEFAULT 'QR';

-- CreateTable
CREATE TABLE `registro_comanda_manual` (
    `id_registro` INTEGER NOT NULL AUTO_INCREMENT,
    `id_pedido` INTEGER NOT NULL,
    `id_usuario` INTEGER NOT NULL,
    `fecha_hora` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `detalle` VARCHAR(1000) NOT NULL,
    `observacion` VARCHAR(255) NULL,

    UNIQUE INDEX `uq_registro_manual_pedido`(`id_pedido`),
    INDEX `fk_registro_manual_usuario`(`id_usuario`),
    INDEX `idx_registro_manual_fecha`(`fecha_hora`),
    PRIMARY KEY (`id_registro`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `registro_comanda_manual` ADD CONSTRAINT `fk_registro_manual_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedido`(`id_pedido`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `registro_comanda_manual` ADD CONSTRAINT `fk_registro_manual_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE NO ACTION ON UPDATE NO ACTION;
