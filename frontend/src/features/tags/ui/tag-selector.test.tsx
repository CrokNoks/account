import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import fr from '../../../../messages/fr.json';
import { TagSelector } from './tag-selector';

const createTag = vi.fn();

// cmdk (the tag list) needs these browser APIs, which jsdom lacks.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = () => {};

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../api/use-tags', () => ({ useTags: () => ({ data: [] }) }));
vi.mock('../api/use-create-tag', () => ({ useCreateTag: () => ({ mutate: createTag }) }));

function openAndCreate() {
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <TagSelector accountId="acc-1" selectedTagIds={[]} onChange={() => {}} />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.change(screen.getByPlaceholderText(fr.Tags.selector.search_placeholder), { target: { value: 'vacances' } });
  fireEvent.click(screen.getByText(/vacances/, { selector: 'button' }));
}

describe('TagSelector on-the-fly creation error', () => {
  beforeEach(() => {
    createTag.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('shows the API message once', () => {
    createTag.mockImplementation((_vars, opts) =>
      opts.onError({ response: { data: { message: 'A tag with this name already exists' } } }),
    );
    openAndCreate();

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('Une étiquette portant ce nom existe déjà');
  });

  it('falls back to the translated message when the API gave none', () => {
    createTag.mockImplementation((_vars, opts) => opts.onError(new Error('Network Error')));
    openAndCreate();

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(fr.Tags.selector.create_error);
  });
});
