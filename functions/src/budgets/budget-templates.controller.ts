import { Controller, Get, Post, Body, Put, Param, Delete, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { BudgetTemplatesService, CreateBudgetTemplateDto, UpdateBudgetTemplateDto } from './budget-templates.service';
import { FirebaseAuthGuard } from '../core/guards/firebase-auth.guard';

@Controller('budget-templates')
@UseGuards(FirebaseAuthGuard)
export class BudgetTemplatesController {
  constructor(private readonly budgetTemplatesService: BudgetTemplatesService) { }

  @Post()
  create(
    @Body() createBudgetTemplateDto: CreateBudgetTemplateDto,
    @Request() req: any,
  ) {
    const token = req.headers.authorization;
    return this.budgetTemplatesService.create(createBudgetTemplateDto, token);
  }

  @Get()
  findAll(
    @Query('account_id') accountId: string,
    @Request() req: any,
  ) {
    if (!accountId) {
      throw new BadRequestException('Account ID is required');
    }
    const token = req.headers.authorization;
    return this.budgetTemplatesService.findAll(accountId, token);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const token = req.headers.authorization;
    return this.budgetTemplatesService.findOne(id, token);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateBudgetTemplateDto: UpdateBudgetTemplateDto,
    @Request() req: any,
  ) {
    const token = req.headers.authorization;
    return this.budgetTemplatesService.update(id, updateBudgetTemplateDto, token);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const token = req.headers.authorization;
    return this.budgetTemplatesService.remove(id, token);
  }
}
