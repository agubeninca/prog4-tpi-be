-- Medio con el que se pagó el pedido (solo registro histórico, no hay pasarela de pago).
-- Queda en NULL mientras el pedido está pendiente de pago y en los pagados antes de este cambio.
ALTER TABLE `pedido` ADD COLUMN `medio_pago` ENUM('EFECTIVO', 'DEBITO', 'CREDITO', 'MERCADO_PAGO', 'TRANSFERENCIA', 'CUENTA_CORRIENTE') NULL;
