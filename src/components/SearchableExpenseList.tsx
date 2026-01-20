import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Visibility, Edit, Delete } from '@mui/icons-material';
import { AdvancedSearch } from './AdvancedSearch';
import { SkeletonLoader } from './SkeletonLoader';
import { highlightText } from '../hooks/useAdvancedSearch';
import { formatDate, formatCurrency } from '../utils/formatters';

interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category_name?: string;
  category_color?: string;
  reconciled: boolean;
}

interface SearchableExpenseListProps {
  expenses: Expense[];
  loading?: boolean;
  onEdit?: (expense: Expense) => void;
  onDelete?: (expense: Expense) => void;
  onView?: (expense: Expense) => void;
  readOnly?: boolean;
}

export const SearchableExpenseList = React.memo<SearchableExpenseListProps>(({
  expenses,
  loading,
  onEdit,
  onDelete,
  onView,
  readOnly = false,
}) => {
  const [searchResults, setSearchResults] = useState<Expense[]>(expenses);
  const [highlightedResults, setHighlightedResults] = useState<any[]>([]);

  // Define searchable fields for expenses
  const searchableFields = [
    'description',
    'category_name',
    'date',
    'amount',
  ];

  // Handle search results change
  const handleSearchResultsChange = (results: Expense[], highlighted: any[]) => {
    setSearchResults(results);
    setHighlightedResults(highlighted);
  };

  // Get matched fields for highlighting
  const getMatchedFields = (itemId: string): string[] => {
    const result = highlightedResults.find(r => r.item.id === itemId);
    return result?.matchedFields || [];
  };

  // Render expense with highlighting
  const renderExpense = (expense: Expense) => {
    const matchedFields = getMatchedFields(expense.id);
    
    const highlightedDescription = matchedFields.includes('description') 
      ? highlightText(expense.description, searchResults[0]?.description || '', false)
      : expense.description;
    
    const highlightedCategory = matchedFields.includes('category_name') && expense.category_name
      ? highlightText(expense.category_name, searchResults[0]?.category_name || '', false)
      : expense.category_name;

    return (
      <Card 
        key={expense.id} 
        sx={{ 
          mb: 2, 
          '&:hover': { 
            boxShadow: 3, 
            transform: 'translateY(-2px)',
            transition: 'all 0.2s ease-in-out'
          } 
        }}
      >
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Main content */}
            <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              {/* Category indicator */}
              <Avatar
                sx={{
                  bgcolor: expense.category_color || '#grey.500',
                  width: 32,
                  height: 32,
                  mr: 2,
                  fontSize: '0.875rem'
                }}
              >
                {expense.category_name?.charAt(0)?.toUpperCase() || '?'}
              </Avatar>
              
              {/* Text content */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography 
                  variant="h6" 
                  component="div"
                  sx={{ 
                    fontWeight: 'medium',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  dangerouslySetInnerHTML={{ 
                    __html: highlightedDescription || expense.description 
                  }}
                />
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  {highlightedCategory && (
                    <Chip
                      label={highlightedCategory}
                      size="small"
                      variant="outlined"
                      sx={{ 
                        '& mark': { 
                          backgroundColor: 'transparent !important',
                          fontWeight: 'bold'
                        }
                      }}
                      dangerouslySetInnerHTML={{ __html: highlightedCategory }}
                    />
                  )}
                  
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(expense.date)}
                  </Typography>
                  
                  {expense.reconciled && (
                    <Chip 
                      label="Reconciled" 
                      size="small" 
                      color="success" 
                      variant="outlined" 
                    />
                  )}
                </Box>
              </Box>
            </Box>

            {/* Amount and actions */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 2 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 'bold',
                  color: expense.amount > 0 ? 'success.main' : 'error.main'
                }}
              >
                {formatCurrency(expense.amount)}
              </Typography>
              
              {/* Action buttons */}
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {onView && (
                  <Tooltip title="View details">
                    <IconButton 
                      size="small" 
                      onClick={() => onView(expense)}
                    >
                      <Visibility />
                    </IconButton>
                  </Tooltip>
                )}
                
                {onEdit && !readOnly && (
                  <Tooltip title="Edit">
                    <IconButton 
                      size="small" 
                      onClick={() => onEdit(expense)}
                    >
                      <Edit />
                    </IconButton>
                  </Tooltip>
                )}
                
                {onDelete && !readOnly && (
                  <Tooltip title="Delete">
                    <IconButton 
                      size="small" 
                      onClick={() => onDelete(expense)}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <SkeletonLoader type="expenses" count={5} isLoading={true}>
        <div></div>
      </SkeletonLoader>
    );
  }

  return (
    <Box>
      {/* Search component */}
      <Box sx={{ mb: 3 }}>
        <AdvancedSearch
          data={expenses}
          onResultsChange={handleSearchResultsChange}
          searchableFields={searchableFields}
          placeholder="Search expenses by description, category, date, or amount..."
          showHistory={true}
          showSettings={true}
        />
      </Box>

      {/* Results summary */}
      {searchResults.length !== expenses.length && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Showing {searchResults.length} of {expenses.length} expenses
          </Typography>
        </Box>
      )}

      {/* Expense list */}
      {searchResults.length > 0 ? (
        <Box>
          {searchResults.map(renderExpense)}
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {expenses.length === 0 ? 'No expenses found' : 'No matching expenses found'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {expenses.length === 0 
              ? 'Start by adding your first expense'
              : 'Try adjusting your search terms or filters'
            }
          </Typography>
        </Box>
      )}
    </Box>
  );
});

SearchableExpenseList.displayName = 'SearchableExpenseList';