-- Se separa el rol "Cocina / Barra" en dos:
--   BARRA: toma las comandas, las marca como servidas o las cancela.
--   COCINA: solo visualiza el panel de comandas para saber qué preparar.
-- Los usuarios COCINA existentes quedan como visualizadores; el admin puede pasarlos a BARRA.
ALTER TABLE `usuario` MODIFY `rol` ENUM('ADMIN', 'BARRA', 'COCINA') NOT NULL;
