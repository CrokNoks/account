import { MutationCache, type Mutation } from '@tanstack/react-query';
import { toast } from 'sonner';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { skipGlobalErrorToast?: boolean };
  }
}

/** Translator of the `ApiErrors` namespace (`useTranslations('ApiErrors')`). */
export type ApiErrorTranslator = {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
};

/** API message (business errors, thrown by the back) -> key in `ApiErrors.exact`. */
const EXACT_MESSAGES: Record<string, string> = {
  'Name is required': 'name_required',
  'Description is required': 'description_required',
  'Amount is required': 'amount_required',
  'Account ID is required': 'account_required',
  'Category ID is required': 'category_required',
  'Period ID is required': 'period_required',
  'Allocated amount is required': 'allocated_amount_required',
  'Category name is required': 'category_name_required',
  'Tag name is required': 'tag_name_required',
  'Day of month must be between 1 and 31': 'day_of_month_range',
  'End date must be after start date': 'end_date_after_start',
  'Invalid category type': 'invalid_category_type',
  'Invalid color format (hex required)': 'invalid_color',
  'Target amount must be positive': 'target_amount_positive',
  'Category does not belong to this account': 'category_wrong_account',
  'Period does not belong to this account': 'period_wrong_account',
  'Tag does not belong to this account': 'tag_wrong_account',
  'Referenced resource does not exist': 'reference_missing',
  'Account not found': 'account_not_found',
  'Account or Period not found': 'account_or_period_not_found',
  'Destination account not found': 'destination_account_not_found',
  'Tag not found': 'tag_not_found',
  'Transaction not found': 'transaction_not_found',
  'Period not found': 'period_not_found',
  'Savings goal not found': 'savings_goal_not_found',
  'Smart rule not found': 'smart_rule_not_found',
  'Resource not found': 'resource_not_found',
  'Only owner can list shares': 'owner_only_list_shares',
  'Only owner can remove shares': 'owner_only_remove_shares',
  'Only owner can update the account': 'owner_only_update_account',
  'Only the account owner can manage shares': 'owner_only_manage_shares',
  'You do not have permission to modify this resource': 'no_permission',
  'Forbidden resource': 'forbidden',
  'A tag with this name already exists': 'tag_duplicate',
  'Period overlaps an existing period': 'period_overlap',
  'A budget already exists for this category in this period': 'budget_duplicate',
  'You cannot share an account with yourself (you are the owner)': 'share_with_self',
};

/** class-validator messages: `<field> <rule>`; one pattern per rule type -> key in `ApiErrors.rules`. */
const RULE_PATTERNS: Array<[RegExp, string]> = [
  [/^must be a string$/, 'string'],
  [/^must be a number\b.*$/, 'number'],
  [/^must be an integer number$/, 'integer'],
  [/^must be a boolean value$/, 'boolean'],
  [/^must be a UUID$/, 'uuid'],
  [/^must be an array$/, 'array'],
  [/^must be an object$/, 'object'],
  [/^must be an email$/, 'email'],
  [/^must be a hexadecimal color$/, 'color'],
  [/^should not be empty$/, 'notEmpty'],
  [/^must not be less than (-?\d+)$/, 'min'],
  [/^must not be greater than (-?\d+)$/, 'max'],
  [/^must be one of the following values: .*$/, 'oneOf'],
  [/^must be a valid enum value$/, 'oneOf'],
  [/^must be an integer amount in cents\b.*$/, 'cents'],
  [/^must be a valid ISO 8601 date\b.*$/, 'date'],
  [/^must be a number string$/, 'number'],
  [/^must not be blank$/, 'blank'],
  [/^must be shorter than or equal to (\d+) characters$/, 'maxLength'],
  [/^must contain no more than (\d+) elements$/, 'maxSize'],
];

/** Translated message, or `null` when the API message is not a known one. */
function translateApiMessage(message: string, t: ApiErrorTranslator): string | null {
  const text = message.trim();
  const exact = EXACT_MESSAGES[text];
  if (exact) return t(`exact.${exact}`);

  const userNotFound = /^User with email (.+) not found\. They must have logged in at least once\.$/.exec(text);
  if (userNotFound) return t('exact.user_not_found', { email: userNotFound[1] });

  const field = /^(?:each value in )?(\w+) (.+)$/.exec(text);
  if (!field) return null;
  const [, name, rule] = field;
  for (const [pattern, key] of RULE_PATTERNS) {
    const match = pattern.exec(rule);
    if (!match) continue;
    return t(`rules.${key}`, {
      field: t.has(`fields.${name}`) ? t(`fields.${name}`) : name,
      value: match[1] ?? '',
    });
  }
  return null;
}

/**
 * Message to show for a failed API call, translated: the back returns English messages in
 * `response.data.message` (a `string[]` for Nest validation errors, joined here with « · »).
 * A message that is not in the table is never shown raw: the `fallback` is used instead.
 */
export function getApiErrorMessage(error: unknown, fallback: string, t: ApiErrorTranslator): string {
  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  const raw = Array.isArray(message) ? message : [message];
  const parts = raw
    .filter((m): m is string => typeof m === 'string' && m.trim() !== '')
    .map((m) => translateApiMessage(m, t))
    .filter((m): m is string => m !== null);
  return parts.length > 0 ? parts.join(' · ') : fallback;
}

/**
 * A mutation shows the global toast unless it handles its error itself:
 * - it declares `onError` in its `useMutation` options, or
 * - it sets `meta: { skipGlobalErrorToast: true }` (needed when `onError` is passed
 *   per call, in `mutate(vars, { onError })`, which the cache cannot see).
 */
export function shouldShowGlobalErrorToast(
  mutation: Mutation<unknown, unknown, unknown, unknown>,
): boolean {
  return !mutation.options.onError && !mutation.meta?.skipGlobalErrorToast;
}

export function createMutationCache(initialFallback: string, initialTranslator: ApiErrorTranslator) {
  let fallback = initialFallback;
  let translator = initialTranslator;
  const cache = new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!shouldShowGlobalErrorToast(mutation)) return;
      toast.error(getApiErrorMessage(error, fallback, translator));
    },
  });
  return {
    cache,
    setFallback: (message: string, t: ApiErrorTranslator = translator) => {
      fallback = message;
      translator = t;
    },
  };
}
