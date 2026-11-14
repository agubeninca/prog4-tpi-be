import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsPositive,
} from 'class-validator';

/** Nuevo orden: los ids en el orden en que tienen que quedar (el primero es la posición 1). */
export class OrdenarDto {
  @ArrayUnique({ message: 'Hay ids repetidos' })
  @ArrayMaxSize(500)
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  @IsArray()
  ids: number[];
}
