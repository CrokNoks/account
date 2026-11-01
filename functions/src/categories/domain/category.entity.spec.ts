import { Category, CategoryType } from './category.entity';

describe('Category Entity', () => {
  it('should create a valid category', () => {
    const category = Category.create({
      name: 'Salary',
      color: '#2ecc71',
      type: CategoryType.INCOME,
    });

    expect(category.id).toBeDefined();
    expect(category.name).toBe('Salary');
    expect(category.color).toBe('#2ecc71');
    expect(category.type).toBe(CategoryType.INCOME);
    expect(category.createdAt).toBeInstanceOf(Date);
  });

  it('should throw error if name is empty', () => {
    expect(() => {
      Category.create({
        name: '',
        color: '#2ecc71',
        type: CategoryType.EXPENSE,
      });
    }).toThrow('Category name is required');
  });

  it('should throw error if color is invalid hex', () => {
    expect(() => {
      Category.create({
        name: 'Food',
        color: 'invalid',
        type: CategoryType.EXPENSE,
      });
    }).toThrow('Invalid color format (hex required)');
  });
});
