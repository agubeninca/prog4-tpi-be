import { PartialType } from '@nestjs/mapped-types';
import { CreateMozoDto } from './create-mozo.dto.js';

export class UpdateMozoDto extends PartialType(CreateMozoDto) {}
