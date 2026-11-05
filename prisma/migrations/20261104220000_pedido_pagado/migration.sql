-- Estado de pago del pedido, independiente del estado de preparación.
-- Todo pedido nuevo arranca "PENDIENTE" de pago; el admin lo marca como "PAGADO".
ALTER TABLE `pedido` ADD COLUMN `pagado` ENUM('PENDIENTE', 'PAGADO') NOT NULL DEFAULT 'PENDIENTE';

-- Los pedidos ya servidos antes de este cambio se consideran cobrados.
UPDATE `pedido` SET `pagado` = 'PAGADO' WHERE `estado` = 'SERVIDO';
