-- Al cobrar se registra a quién se le cobró: consumidor final o una cuenta (nombre / razón social y CUIT opcional).
-- Queda en NULL mientras el pedido está pendiente de pago y en los pagados antes de este cambio.
ALTER TABLE `pedido`
    ADD COLUMN `facturacion` ENUM('CONSUMIDOR_FINAL', 'CUENTA') NULL,
    ADD COLUMN `cuenta_nombre` VARCHAR(150) NULL,
    ADD COLUMN `cuenta_cuit` VARCHAR(11) NULL;
