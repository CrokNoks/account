import englishMessages from 'ra-language-english';

export const en = {
  ...englishMessages,
  resources: {
    expenses: {
      name: 'Expense |||| Expenses',
      fields: {
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
        category_id: 'Category',
        note: 'Note',
        reconciled: 'Reconciled',
        payment_method: 'Payment Method'
      }
    },
    categories: {
      name: 'Category |||| Categories',
      uncategorized: 'Uncategorized',
      fields: {
        name: 'Name',
        description: 'Description',
        color: 'Color',
        budget: 'Budget',
        type: 'Type',
        budget_label: 'Monthly Budget (optional)',
        type_choices: {
          expense: 'Expense',
          income: 'Income'
        },
        type_helper: 'Defines if the budget is a limit (Expense) or a goal (Income)',
        budget_helper: 'Set a budget to receive alerts when exceeded'
      },
      notifications: {
        import_success: '%{count} categories imported successfully',
        import_error: "Import error: %{error}",
        no_valid_data: 'No valid categories found ("name" column required)'
      }
    },
    reports: {
      name: 'Report |||| Reports'
    },
    'category-evolution': {
      name: 'Category Evolution'
    },
    transfers: {
      name: 'Transfer |||| Transfers',
      fields: {
        source_account_id: 'Source Account',
        destination_account_id: 'Target Account',
        source_category_id: 'Source Category',
        destination_category_id: 'Target Category'
      }
    },
    accounts: {
      name: 'Account |||| Accounts',
      fields: {
        name: 'Account Name',
        created_at: 'Created at',
        initial_balance: 'Initial Account Balance (€)',
        initial_balance_helper: 'Starting balance for the first report'
      },
      shares: {
        title: 'Account Shares',
        description: 'Add another user via their Supabase <code>user_id</code> and choose access level.',
        user: 'User',
        permission: 'Permission',
        permissions: {
          read: 'Read',
          write: 'Write'
        },
        add: 'Add',
        empty: 'No shares for this account.',
        notifications: {
          load_error: 'Error loading shares',
          choose_user: 'Please select a user',
          add_success: 'Access added',
          add_error: 'Error adding share',
          delete_success: 'Access removed',
          delete_error: 'Error removing share'
        }
      }
    },
    app_users: {
      name: 'User |||| Users'
    }
  },
  app: {
    expenses: {
      filter: {
        description: 'Refine the display by text, period and reconciliation status.',
        filters: 'Filter operations',
        title: 'Operation Filters',
        subtitle: 'Refine display by text, period and reconciliation status.'
      },
      notifications: {
        status_updated: 'Status updated',
        update_error: 'Update error',
        import_success: '%{count} expenses imported successfully',
        import_error: "Import error: %{error}",
        no_valid_data: 'No valid expenses found'
      }
    },
    action: {
      close: 'Close',
      delete: 'Delete',
      add_expense: 'Add',
      transfer: 'Transfer',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit'
    },
    dashboard: {
      title: 'Dashboard',
      reports: 'Reports',
      operations: 'Operations',
      expenses_by_category: 'Expenses by Category',
      income_by_category: 'Income by Category',
      period_from: 'From',
      period_to: 'to',
      period_to_today: 'until today',
      select_report_prompt: "Select a report from history or create a new one.",
      cards: {
        initial_balance: 'Initial Balance',
        bank_balance: 'Bank Balance',
        pending: 'Pending',
        operations_balance: 'Operations Balance',
        projected_balance: 'Projected Balance',
        flux: 'Cash Flow'
      },
      tooltips: {
        bank_balance: 'Reconciled balance (matching your current bank statement).',
        pending: 'Total of entered but not yet reconciled operations (not debited/credited on the account).',
        operations_balance: 'Real balance at the end of the period, based on all entered operations (reconciled and not).',
        projected_balance: 'Estimated final balance taking into account defined category budgets, if they are higher than actual amounts.'
      }
    },
    category_summary: {
      category: 'Category',
      amount: 'Amount',
      budget: 'Budget',
      total_percent: '% Expenses',
      status: '% Budget',
      total: 'Total',
      budget_exceeded: 'Budget exceeded by %{percent}%',
      budget_used: '%{percent}% of budget used',
      goal_met: 'Goal met (%{percent}%)',
      goal_not_met: 'Goal not met (%{percent}%)'
    },
    report_selector: {
      history: 'History',
      current_report: 'Current Report (unsaved)',
      select_report: 'Select a report'
    },
    filters: {
      date_gte: 'Start date',
      date_lte: 'End date',
      reconciled: {
        all: 'All',
        true: 'Reconciled',
        false: 'Not reconciled'
      }
    },
    evolution: {
      title: 'Category Evolution',
      view: 'View',
      expenses: 'Expenses',
      revenues: 'Income',
      global_stats: 'Global Statistics',
      period_analyzed: 'Analyzed Period',
      active_categories: 'Active Categories',
      total_expenses: 'Total Expenses',
      total_revenues: 'Total Income',
      summary_expenses: 'Expenses Summary',
      summary_revenues: 'Income Summary',
      chart_title: 'Evolution over Time',
      stats: {
        total: 'Total',
        min: 'Min',
        avg: 'Avg',
        max: 'Max'
      },
      no_reports: 'No archived reports available. Close at least one report to see evolution.'
    },
    drawers: {
      add_expense: 'Add Expense',
      edit_expense: 'Edit Expense',
      new_transfer: 'New Transfer',
      transfer_source: 'Source Account',
      transfer_target: 'Target Account',
      amount: 'Amount',
      date: 'Date'
    },
    messages: {
      confirm_delete_report: 'Are you sure you want to delete this report?',
      report_closed: 'Report closed successfully',
      report_deleted: 'Report deleted',
      error_loading: 'Error loading data',
      no_account: 'Please select an account',
      operation_added: 'Operation added',
      operation_updated: 'Operation updated',
      transfer_success: 'Transfer created successfully',
      transfer_error: 'Error creating transfer',
      no_account_desc: "Choose an account at the top of the screen to view your reports and operations.",
      period: {
        title: 'Period from %{start} %{end}',
        to: 'to %{date}',
        ongoing: "until today (Ongoing)"
      },
      buttons: {
        close: 'Close',
        new_report: 'New Report',
        delete: 'Delete',
        transfer: 'Transfer',
        add: 'Add'
      }
    }
  },
  components: {
    account_selector: {
      label: 'Account',
      no_account: 'No accounts found. Please create one.'
    },
    account_required: {
      title: 'Account Required',
      message: 'Please select an account to view this data.'
    },
    import: {
      button: 'Import CSV',
      loading: 'Importing...'
    }
  }
};
