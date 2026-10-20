import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Public, Roles } from '../auth/decorators.js';
import { ReviewsService } from './reviews.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { FiltroReviewsDto } from './dto/filtro-reviews.dto.js';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Public()
  @Post('pedidos/:id/reviews')
  create(
    @Param('id', ParseIntPipe) id: number,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return this.reviewsService.create(id, createReviewDto);
  }

  @Roles('ADMIN')
  @Get('reviews')
  findAll(@Query() filtro: FiltroReviewsDto) {
    return this.reviewsService.findAll(filtro);
  }
}
