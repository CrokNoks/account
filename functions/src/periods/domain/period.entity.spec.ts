import { Period } from './period.entity';

describe('Period Entity', () => {
  it('should create a valid period', () => {
    const start = new Date('2026-03-01');
    const end = new Date('2026-03-31');
    const period = Period.create({
      accountId: 'acc-123',
      startDate: start,
      endDate: end,
    });

    expect(period.id).toBeDefined();
    expect(period.startDate).toEqual(start);
    expect(period.endDate).toEqual(end);
    expect(period.isActive).toBe(true);
  });

  it('should throw if end date is before start date', () => {
    expect(() => {
      Period.create({
        accountId: 'acc-123',
        startDate: new Date('2026-03-31'),
        endDate: new Date('2026-03-01'),
      });
    }).toThrow('End date must be after start date');
  });

  it('should throw if accountId is missing', () => {
    expect(() => {
      Period.create({
        accountId: '',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
      });
    }).toThrow('Account ID is required');
  });
});
