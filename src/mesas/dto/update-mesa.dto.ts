import { PartialType } from '@nestjs/mapped-types';
import { CreateMesaDto } from './create-mesa.dto.js';

export class UpdateMesaDto extends PartialType(CreateMesaDto) {}
