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
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { FirebaseAuthGuard } from '../core/guards/firebase-auth.guard';

@UseGuards(FirebaseAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  async findAll(@Req() req: any, @Query('account_id') accountId?: string) {
    return this.accountsService.findAll(req.user.uid, accountId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.accountsService.findOne(id, req.user.uid);
  }

  @Post()
  async create(@Req() req: any, @Body() createAccountDto: CreateAccountDto) {
    return this.accountsService.create(req.user.uid, createAccountDto);
  }

  @Patch(':id')
  async update(
    @Req() req: any, 
    @Param('id') id: string, 
    @Body() updateAccountDto: UpdateAccountDto
  ) {
    return this.accountsService.update(id, req.user.uid, updateAccountDto);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.accountsService.remove(id, req.user.uid);
  }
}
