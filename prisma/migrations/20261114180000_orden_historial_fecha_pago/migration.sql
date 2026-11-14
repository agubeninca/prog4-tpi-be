-- Orden del menú: posición de cada categoría y de cada producto dentro de su categoría.
-- Se conserva el orden que se veía hasta ahora (alfabético). ROW_NUMBER() requiere MySQL 8+ o MariaDB 10.2+.
ALTER TABLE `categoria` ADD COLUMN `orden` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `producto` ADD COLUMN `orden` INTEGER NOT NULL DEFAULT 0;

UPDATE `categoria` c
JOIN (SELECT `id_categoria`, ROW_NUMBER() OVER (ORDER BY `nombre`) AS rn FROM `categoria`) t
  ON t.`id_categoria` = c.`id_categoria`
SET c.`orden` = t.rn;

UPDATE `producto` p
JOIN (SELECT `id_producto`, ROW_NUMBER() OVER (PARTITION BY `id_categoria` ORDER BY `nombre`) AS rn FROM `producto`) t
  ON t.`id_producto` = p.`id_producto`
SET p.`orden` = t.rn;

-- Fecha de cobro (para el cierre de caja). Los ya pagados toman su última modificación como aproximación.
ALTER TABLE `pedido` ADD COLUMN `fecha_pago` DATETIME(0) NULL;
UPDATE `pedido` SET `fecha_pago` = `fecha_actualizacion` WHERE `pagado` = 'PAGADO';

-- Historial de cambios de estado de cada pedido.
CREATE TABLE `historial_estado_pedido` (
    `id_historial` INTEGER NOT NULL AUTO_INCREMENT,
    `id_pedido` INTEGER NOT NULL,
    `estado_anterior` ENUM('PENDIENTE', 'EN_PREPARACION', 'SERVIDO', 'CANCELADO') NULL,
    `estado_nuevo` ENUM('PENDIENTE', 'EN_PREPARACION', 'SERVIDO', 'CANCELADO') NOT NULL,
    `id_usuario` INTEGER NULL,
    `fecha_hora` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `motivo` VARCHAR(255) NULL,

    INDEX `fk_historial_estado_pedido`(`id_pedido`),
    INDEX `fk_historial_estado_usuario`(`id_usuario`),
    PRIMARY KEY (`id_historial`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `historial_estado_pedido` ADD CONSTRAINT `fk_historial_estado_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedido`(`id_pedido`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `historial_estado_pedido` ADD CONSTRAINT `fk_historial_estado_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Pedidos anteriores: se les da un alta en el historial (no se sabe quién, ni los pasos intermedios).
INSERT INTO `historial_estado_pedido` (`id_pedido`, `estado_anterior`, `estado_nuevo`, `id_usuario`, `fecha_hora`)
SELECT `id_pedido`, NULL, 'PENDIENTE', NULL, `fecha_hora_ingreso` FROM `pedido`;
