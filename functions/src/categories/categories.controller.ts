import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query, 
  Req,
  UseGuards 
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { FirebaseAuthGuard } from '../core/guards/firebase-auth.guard';

@UseGuards(FirebaseAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async findAll(@Req() req: any, @Query('account_id') accountId?: string) {
    return this.categoriesService.findAll(req.user.uid, accountId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.categoriesService.findOne(id, req.user.uid);
  }

  @Post()
  async create(@Req() req: any, @Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(req.user.uid, createCategoryDto);
  }

  @Patch(':id')
  async update(
    @Req() req: any, 
    @Param('id') id: string, 
    @Body() updateCategoryDto: UpdateCategoryDto
  ) {
    return this.categoriesService.update(id, req.user.uid, updateCategoryDto);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.categoriesService.remove(id, req.user.uid);
  }
}
