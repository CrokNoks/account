import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_FILTER } from '@nestjs/core';
import { Controller, Get, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  ConflictError,
  DomainValidationError,
  ForbiddenError,
  NotFoundError,
} from '../domain/errors';
import { DomainExceptionFilter } from './domain-exception.filter';

function run(error: Error) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  new DomainExceptionFilter().catch(error as never, host);
  return { status, json };
}

describe('DomainExceptionFilter', () => {
  it.each([
    [new DomainValidationError('bad'), 400, 'Bad Request'],
    [new NotFoundError('missing'), 404, 'Not Found'],
    [new ForbiddenError('nope'), 403, 'Forbidden'],
    [new ConflictError('dup'), 409, 'Conflict'],
  ])('maps %p to HTTP %i', (error, code, label) => {
    const { status, json } = run(error);
    expect(status).toHaveBeenCalledWith(code);
    expect(json).toHaveBeenCalledWith({
      statusCode: code,
      message: error.message,
      error: label,
    });
  });

  it('keeps the error message and class name', () => {
    const error = new NotFoundError('Account not found');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Account not found');
    expect(error.name).toBe('NotFoundError');
  });
});

@Controller('t')
class ThrowingController {
  @Get('technical')
  technical() {
    throw new Error('SECRET database detail');
  }
  @Get('http')
  http() {
    throw new BadRequestException('already http');
  }
  @Get('domain')
  domain() {
    throw new NotFoundError('gone');
  }
}

describe('DomainExceptionFilter (integration)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ThrowingController],
      providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({
      logger: false,
    });
    await app.init();
  });
  afterAll(() => app.close());

  it('translates domain errors', () =>
    request(app.getHttpServer())
      .get('/t/domain')
      .expect(404, { statusCode: 404, message: 'gone', error: 'Not Found' }));

  it('leaves Nest HttpException untouched', () =>
    request(app.getHttpServer()).get('/t/http').expect(400, {
      statusCode: 400,
      message: 'already http',
      error: 'Bad Request',
    }));

  it('keeps technical errors as 500 without leaking the message', () =>
    request(app.getHttpServer())
      .get('/t/technical')
      .expect(500, { statusCode: 500, message: 'Internal server error' }));
});
