import { Controller, Get, Post, Delete, Body, Param, Query, Headers } from '@nestjs/common';
import { PeriodsService, CreatePeriodDto } from './periods.service';

@Controller('periods')
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) { }

  @Get()
  findAll(
    @Query('account_id') accountId: string,
    @Query('is_active') isActive: string,
    @Headers('authorization') token: string,
  ) {
    if (!accountId) {
      throw new Error('Account ID is required');
    }
    return this.periodsService.findAll(accountId, isActive, token);
  }

  @Get('active')
  findActive(
    @Query('account_id') accountId: string,
    @Headers('authorization') token: string,
  ) {
    if (!accountId) {
      throw new Error('Account ID is required');
    }
    return this.periodsService.findActive(accountId, token);
  }

  @Get(':id/report')
  getReport(
    @Param('id') id: string,
    @Headers('authorization') token: string,
  ) {
    return this.periodsService.getReport(id, token);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Headers('authorization') token: string,
  ) {
    return this.periodsService.findOne(id, token);
  }

  @Post('preview')
  previewNextPeriod(
    @Body('account_id') accountId: string,
    @Headers('authorization') token: string,
  ) {
    if (!accountId) {
      throw new Error('Account ID is required in body');
    }
    return this.periodsService.previewNextPeriod(accountId, token);
  }

  @Post()
  create(
    @Body() createPeriodDto: CreatePeriodDto,
    @Headers('authorization') token: string,
  ) {
    return this.periodsService.createPeriodWithBudgets(createPeriodDto, token);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Headers('authorization') token: string,
  ) {
    return this.periodsService.remove(id, token);
  }

  @Post(':id/close')
  close(
    @Param('id') id: string,
    @Headers('authorization') token: string,
  ) {
    return this.periodsService.closePeriod(id, token);
  }
}
