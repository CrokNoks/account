import { Transaction } from './transaction.entity';
import {
  assertValidLink,
  checkMetadataKeepsLink,
  checkTransferAmount,
  findOtherSide,
  planTransferUpdate,
} from './transfer-link';
import {
  ConflictError,
  DomainValidationError,
} from '../../shared/domain/errors';

const side = (
  id: string,
  accountId: string,
  type: 'transfer_out' | 'transfer_in',
  relatedAccountId: string,
  amount: number,
  overrides: Partial<Parameters<typeof Transaction.create>[0]> = {},
) =>
  Transaction.create({
    id,
    accountId,
    categoryId: null,
    date: new Date('2026-11-20'),
    description: 'Virement',
    amount: BigInt(amount),
    reconciled: false,
    pending: false,
    metadata: { transferId: 'tr-1', type, relatedAccountId },
    ...overrides,
  });

const out = () => side('out', 'A', 'transfer_out', 'B', -5000);
const into = () => side('in', 'B', 'transfer_in', 'A', 5000);

describe('findOtherSide', () => {
  it('returns the opposite line of the linked account', () => {
    expect(findOtherSide(out(), [into()])?.id).toBe('in');
    expect(findOtherSide(into(), [out()])?.id).toBe('out');
  });

  it('returns null when no line is left (orphan)', () => {
    expect(findOtherSide(out(), [])).toBeNull();
  });

  it('ignores lines of another transfer', () => {
    const foreign = side('x', 'B', 'transfer_in', 'A', 100, {
      metadata: {
        transferId: 'tr-2',
        type: 'transfer_in',
        relatedAccountId: 'A',
      },
    });
    expect(findOtherSide(out(), [foreign])).toBeNull();
  });

  it('refuses (409) two candidate lines', () => {
    expect(() => findOtherSide(out(), [into(), into()])).toThrow(ConflictError);
  });

  it('refuses (409) a candidate of the same type', () => {
    const same = side('s', 'B', 'transfer_out', 'A', -5000);
    expect(() => findOtherSide(out(), [same])).toThrow(ConflictError);
  });

  it('refuses (409) a candidate pointing to another account', () => {
    const other = side('o', 'B', 'transfer_in', 'C', 5000);
    expect(() => findOtherSide(out(), [other])).toThrow(ConflictError);
  });

  it('refuses (409) a line without a known transfer type', () => {
    const odd = side('odd', 'A', 'transfer_out', 'B', -5000, {
      metadata: { transferId: 'tr-1', relatedAccountId: 'B' },
    });
    expect(() => findOtherSide(odd, [into()])).toThrow(ConflictError);
  });
});

describe('checkTransferAmount', () => {
  it('accepts a negative amount on the outgoing side and a positive one on the incoming side', () => {
    expect(() => checkTransferAmount(out(), BigInt(-8000))).not.toThrow();
    expect(() => checkTransferAmount(into(), BigInt(8000))).not.toThrow();
  });

  it.each([BigInt(8000), BigInt(0)])('refuses %s on the outgoing side', (n) => {
    expect(() => checkTransferAmount(out(), n)).toThrow(
      'Transfer amount must be negative on the outgoing side',
    );
    expect(() => checkTransferAmount(out(), n)).toThrow(DomainValidationError);
  });

  it.each([BigInt(-1), BigInt(0)])('refuses %s on the incoming side', (n) => {
    expect(() => checkTransferAmount(into(), n)).toThrow(
      'Transfer amount must be positive on the incoming side',
    );
  });
});

describe('checkMetadataKeepsLink', () => {
  const link = {
    transferId: 'tr-1',
    type: 'transfer_out',
    relatedAccountId: 'B',
  };

  it('refuses removing the transferId', () => {
    expect(() =>
      checkMetadataKeepsLink(link, {
        type: 'transfer_out',
        relatedAccountId: 'B',
      }),
    ).toThrow('The transfer link cannot be changed');
  });

  it('refuses changing the type', () => {
    expect(() =>
      checkMetadataKeepsLink(link, { ...link, type: 'transfer_in' }),
    ).toThrow(DomainValidationError);
  });

  it('refuses changing the related account', () => {
    expect(() =>
      checkMetadataKeepsLink(link, { ...link, relatedAccountId: 'C' }),
    ).toThrow(DomainValidationError);
  });

  it('accepts another key as long as the link is kept', () => {
    expect(() =>
      checkMetadataKeepsLink(link, { ...link, label: 'x' }),
    ).not.toThrow();
  });

  it('does not control a transaction that is not a transfer', () => {
    expect(() => checkMetadataKeepsLink({}, { foo: 1 })).not.toThrow();
    expect(() => checkMetadataKeepsLink(undefined, undefined)).not.toThrow();
  });
});

describe('planTransferUpdate', () => {
  it('gives the other side the opposite amount and the date of the modified side, and keeps its own fields', () => {
    const modified = out().update({
      amount: BigInt(-8000),
      date: new Date('2026-11-22'),
    });
    const other = into().update({
      reconciled: true,
      notes: 'ma note',
      tagIds: ['t1'],
    });

    const planned = planTransferUpdate(other, modified);

    expect(planned.amount).toBe(BigInt(8000));
    expect(planned.date).toEqual(new Date('2026-11-22'));
    expect(planned.reconciled).toBe(true);
    expect(planned.notes).toBe('ma note');
    expect(planned.tagIds).toEqual(['t1']);
    expect(planned.accountId).toBe('B');
    expect(planned.amount + modified.amount).toBe(BigInt(0));
  });
});

describe('assertValidLink', () => {
  const withMeta = (metadata: Record<string, unknown>) =>
    side('x', 'A', 'transfer_out', 'B', -5000, { metadata });

  it('accepts a complete link', () => {
    expect(() => assertValidLink(out())).not.toThrow();
  });

  it.each([
    ['without relatedAccountId', { transferId: 'tr-1', type: 'transfer_out' }],
    [
      'with an empty relatedAccountId',
      { transferId: 'tr-1', type: 'transfer_out', relatedAccountId: '' },
    ],
    [
      'with an invalid type',
      { transferId: 'tr-1', type: 'other', relatedAccountId: 'B' },
    ],
    ['without type', { transferId: 'tr-1', relatedAccountId: 'B' }],
  ])('refuses (409) a line %s', (_n, metadata) => {
    expect(() => assertValidLink(withMeta(metadata))).toThrow(ConflictError);
    expect(() => assertValidLink(withMeta(metadata))).toThrow(
      'This transfer is linked to several transactions, nothing was changed',
    );
  });
});
