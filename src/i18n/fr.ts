import frenchMessages from 'ra-language-french';

export const fr = {
  ...frenchMessages,
  resources: {
    expenses: {
      name: 'Dépense |||| Dépenses',
      fields: {
        date: 'Date',
        description: 'Description',
        amount: 'Montant',
        category_id: 'Catégorie',
        note: 'Note',
        reconciled: 'Pointé',
        payment_method: 'Moyen de paiement',
        payment_methods: {
          credit_card: 'Carte bancaire',
          direct_debit: 'Prélèvement',
          transfer: 'Virement',
          check: 'Chèque',
          cash: 'Espèces',
          other: 'Autre'
        }
      }
    },
    categories: {
      name: 'Catégorie |||| Catégories',
      uncategorized: 'Sans catégorie',
      fields: {
        name: 'Nom',
        description: 'Description',
        color: 'Couleur',
        budget: 'Budget',
        type: 'Type',
        budget_label: 'Budget mensuel (optionnel)',
        type_choices: {
          expense: 'Dépense',
          income: 'Revenu'
        },
        type_helper: 'Définit si le budget est une limite (Dépense) ou un objectif (Revenu)',
        budget_helper: 'Définir un budget pour recevoir des alertes en cas de dépassement'
      },
      notifications: {
        import_success: '%{count} catégories importées avec succès',
        import_error: "Erreur lors de l'import: %{error}",
        no_valid_data: 'Aucune catégorie valide trouvée (colonne "name" ou "Nom" requise)'
      }
    },
    reports: {
      name: 'Rapport |||| Rapports'
    },
    'category-evolution': {
      name: 'Évolution Catégories'
    },
    transfers: {
      name: 'Virement |||| Virements',
      fields: {
        source_account_id: 'Compte source',
        destination_account_id: 'Compte de destination',
        source_category_id: 'Catégorie source',
        destination_category_id: 'Catégorie de destination'
      }
    },
    accounts: {
      name: 'Compte |||| Comptes',
      fields: {
        name: 'Nom du compte',
        created_at: 'Créé le',
        initial_balance: 'Solde initial du compte (€)',
        initial_balance_helper: 'Solde de départ pour le premier rapport'
      },
      shares: {
        title: 'Partages du compte',
        description: 'Ajoute un autre utilisateur via son <code>user_id</code> Supabase et choisis le niveau d’accès.',
        user: 'Utilisateur',
        permission: 'Permission',
        permissions: {
          read: 'Lecture',
          write: 'Écriture'
        },
        add: 'Ajouter',
        empty: 'Aucun partage pour ce compte.',
        notifications: {
          load_error: 'Erreur lors du chargement des partages',
          choose_user: 'Veuillez choisir un utilisateur',
          add_success: 'Accès ajouté',
          add_error: 'Erreur lors de l’ajout du partage',
          delete_success: 'Accès retiré',
          delete_error: 'Erreur lors de la suppression du partage'
        }
      }
    },
    app_users: {
      name: 'Utilisateur |||| Utilisateurs'
    },
  },
  app: {
    expenses: {
      filter: {
        description: 'Affinez l\'affichage par texte, période et statut de pointage.',
        filters: 'Filtrer les opérations',
        title: 'Filtres des opérations',
        subtitle: 'Affinez l\'affichage par texte, période et statut de pointage.'
      },
      notifications: {
        status_updated: 'Statut mis à jour',
        update_error: 'Erreur lors de la mise à jour',
        import_success: '%{count} dépenses importées avec succès',
        import_error: "Erreur lors de l'import: %{error}",
        no_valid_data: 'Aucune dépense valide trouvée'
      },
      import: {
        correction_title: 'Vérification des moyens de paiement',
        correction_desc: 'Certaines opérations ont un moyen de paiement incertain (certitude < 75%). Veuillez les vérifier ou les corriger avant l\'importation.',
      }
    },
    action: {
      close: 'Clôturer',
      delete: 'Supprimer',
      add_expense: 'Ajouter',
      transfer: 'Virement',
      save: 'Enregistrer',
      cancel: 'Annuler',
      edit: 'Modifier'
    },
    dashboard: {
      title: 'Tableau de bord',
      reports: 'Rapports',
      operations: 'Opérations',
      expenses_by_category: 'Dépenses par catégorie',
      income_by_category: 'Revenus par catégorie',
      period_from: 'Du',
      period_to: 'au',
      period_to_today: "jusqu'à aujourd'hui",
      select_report_prompt: "Sélectionnez un rapport dans l'historique ou créez-en un nouveau.",
      cards: {
        initial_balance: 'Solde initial',
        bank_balance: 'Solde banque',
        pending: 'À venir',
        operations_balance: 'Solde opérations',
        projected_balance: 'Prévisionnel',
        flux: 'Flux'
      },
      tooltips: {
        bank_balance: 'Solde pointé (correspondant à votre relevé bancaire actuel).',
        pending: 'Total des opérations saisies mais non encore pointées (non débitées/créditées sur le compte).',
        operations_balance: 'Solde réel en fin de période, basé sur toutes les opérations saisies (pointées et non pointées).',
        projected_balance: 'Estimation du solde final en prenant en compte les budgets définis pour les catégories, si ceux-ci sont supérieurs aux montants réels.'
      },
      period: {
        title: 'Période du %{start} %{end}',
        to: 'au %{date}',
        ongoing: "à aujourd'hui (En cours)"
      },
      buttons: {
        close: 'Clôturer',
        new_report: 'Nouveau Rapport',
        delete: 'Supprimer',
        transfer: 'Virement',
        add: 'Ajouter'
      }
    },
    category_summary: {
      category: 'Catégorie',
      amount: 'Montant',
      budget: 'Budget',
      total_percent: '% Dépenses',
      status: '% Budget',
      total: 'Total',
      budget_exceeded: 'Budget dépassé de %{percent}%',
      budget_used: '%{percent}% du budget utilisé',
      goal_met: 'Objectif atteint (%{percent}%)',
      goal_not_met: 'Objectif non atteint (%{percent}%)'
    },
    report_selector: {
      history: 'Historique',
      current_report: 'Rapport en cours (non sauvegardé)',
      select_report: 'Sélectionner un rapport'
    },
    filters: {
      date_gte: 'Date début',
      date_lte: 'Date fin',
      reconciled: {
        all: 'Tous',
        true: 'Pointé',
        false: 'Non pointé'
      }
    },
    evolution: {
      title: 'Évolution par Catégorie',
      view: 'Vue',
      expenses: 'Dépenses',
      revenues: 'Revenus',
      global_stats: 'Statistiques Globales',
      period_analyzed: 'Période analysée',
      active_categories: 'Catégories Actives',
      total_expenses: 'Dépenses Totales',
      total_revenues: 'Revenus Totaux',
      summary_expenses: 'Résumé des Dépenses',
      summary_revenues: 'Résumé des Revenus',
      chart_title: 'Évolution dans le Temps',
      stats: {
        total: 'Total',
        min: 'Min',
        avg: 'Moy',
        max: 'Max'
      },
      no_reports: 'Aucun rapport archivé disponible. Clôturez au moins un rapport pour voir l\'évolution.'
    },
    drawers: {
      add_expense: 'Ajouter une dépense',
      edit_expense: 'Modifier la dépense',
      new_transfer: 'Nouveau virement',
      transfer_source: 'Compte source',
      transfer_target: 'Compte cible',
      amount: 'Montant',
      date: 'Date'
    },
    messages: {
      confirm_delete_report: 'Êtes-vous sûr de vouloir supprimer ce rapport ?',
      report_closed: 'Rapport clôturé avec succès',
      report_deleted: 'Rapport supprimé',
      error_loading: 'Erreur lors du chargement',
      no_account: 'Veuillez sélectionner un compte',
      operation_added: 'Opération ajoutée',
      operation_updated: 'Opération modifiée',
      transfer_success: 'Virement créé avec succès',
      transfer_error: 'Erreur lors de la création du virement',
      no_account_desc: "Choisissez un compte en haut de l'écran pour afficher vos rapports et vos opérations.",

    },
    components: {
      account_selector: {
        label: 'Compte',
        no_account: 'Aucun compte trouvé. Veuillez en créer un.'
      },
      account_required: {
        title: 'Compte requis',
        message: 'Veuillez sélectionner un compte pour voir ces données.'
      },
      import: {
        button: 'Importer CSV',
        loading: 'Importation...'
      },
      ocr: {
        scan_button: 'Scanner un ticket de caisse',
        processing: 'Lecture du ticket en cours...',
        error: 'Erreur lors de la lecture du ticket. Veuillez réessayer.',
        success: 'Données extraites du ticket !'
      }
    }
  }
};
