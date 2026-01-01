import { Controller, Get, Post, Body, Put, Param, Delete, Query, Headers } from '@nestjs/common';
import { BudgetTemplatesService, CreateBudgetTemplateDto, UpdateBudgetTemplateDto } from './budget-templates.service';

@Controller('budget-templates')
export class BudgetTemplatesController {
  constructor(private readonly budgetTemplatesService: BudgetTemplatesService) { }

  @Post()
  create(
    @Body() createBudgetTemplateDto: CreateBudgetTemplateDto,
    @Headers('authorization') token: string,
  ) {
    return this.budgetTemplatesService.create(createBudgetTemplateDto, token);
  }

  @Get()
  findAll(
    @Query('account_id') accountId: string,
    @Headers('authorization') token: string,
  ) {
    if (!accountId) {
      throw new Error('Account ID is required');
    }
    return this.budgetTemplatesService.findAll(accountId, token);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Headers('authorization') token: string,
  ) {
    return this.budgetTemplatesService.findOne(id, token);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateBudgetTemplateDto: UpdateBudgetTemplateDto,
    @Headers('authorization') token: string,
  ) {
    return this.budgetTemplatesService.update(id, updateBudgetTemplateDto, token);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Headers('authorization') token: string,
  ) {
    return this.budgetTemplatesService.remove(id, token);
  }
}
