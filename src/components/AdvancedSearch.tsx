import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Chip,
  Popover,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Switch,
  FormControlLabel,
  FormGroup,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAdvancedSearch, useSearchHistory } from '../hooks/useAdvancedSearch';

interface AdvancedSearchProps<T> {
  data: T[];
  onResultsChange: (results: T[], highlightedResults: any[]) => void;
  searchableFields?: string[];
  placeholder?: string;
  showHistory?: boolean;
  showSettings?: boolean;
  debounceMs?: number;
}

export const AdvancedSearch = <T extends Record<string, any>>({
  data,
  onResultsChange,
  searchableFields,
  placeholder = 'Search...',
  showHistory = true,
  showSettings: showSettingsProp = true,
  debounceMs = 300,
}: AdvancedSearchProps<T>) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const {
    query,
    isSearching,
    hasQuery,
    caseSensitive,
    exactMatch,
    setQuery,
    updateSearch,
    clearSearch,
    filteredData,
    highlightedResults,
  } = useAdvancedSearch(data, {
    query: '',
    fields: searchableFields,
    caseSensitive: false,
    exactMatch: false,
  });

  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();

  // Update parent component with results
  React.useEffect(() => {
    onResultsChange(filteredData, highlightedResults);
  }, [filteredData, highlightedResults, onResultsChange]);

  // Handle query change with history tracking
  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    
    // Add to history when query is submitted (user stops typing)
    if (newQuery.trim() && query !== newQuery) {
      const timeoutId = setTimeout(() => {
        addToHistory(newQuery);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [setQuery, query, addToHistory]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    clearSearch();
  }, [clearSearch]);

  // Settings popover
  const handleSettingsClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    setShowSettings(true);
  }, []);

  const handleSettingsClose = useCallback(() => {
    setAnchorEl(null);
    setShowSettings(false);
  }, []);

  // History item click
  const handleHistoryItemClick = useCallback((historyQuery: string) => {
    handleQueryChange(historyQuery);
    removeFromHistory(historyQuery);
  }, [handleQueryChange, removeFromHistory]);

  // Memoized history items
  const historyItems = useMemo(() => {
    return history.filter(item => 
      item.toLowerCase().includes(query.toLowerCase()) || !query
    ).slice(0, 5);
  }, [history, query]);

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      {/* Main search input */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <SearchIcon sx={{ color: 'action.active', mr: 1 }} />
            ),
            endAdornment: (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {isSearching && (
                  <Typography variant="caption" color="text.secondary">
                    Searching...
                  </Typography>
                )}
                {hasQuery && (
                  <Tooltip title="Clear search">
                    <IconButton size="small" onClick={handleClearSearch}>
                      <ClearIcon />
                    </IconButton>
                  </Tooltip>
                )}
                {showSettingsProp && (
                  <Tooltip title="Search settings">
                    <IconButton size="small" onClick={handleSettingsClick}>
                      <SettingsIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ),
          }}
          sx={{ '& .MuiOutlinedInput-root': { pr: 1 } }}
        />
      </Box>

      {/* Search results summary */}
      {hasQuery && (
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Found {filteredData.length} of {data.length} results
          </Typography>
          {(caseSensitive || exactMatch) && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {caseSensitive && (
                <Chip label="Case Sensitive" size="small" variant="outlined" />
              )}
              {exactMatch && (
                <Chip label="Exact Match" size="small" variant="outlined" />
              )}
            </Box>
          )}
        </Box>
      )}

      {/* History dropdown */}
      {showHistory && !hasQuery && historyItems.length > 0 && (
        <Paper sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1, mt: 1 }}>
          <Box sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <HistoryIcon fontSize="small" />
              Recent Searches
            </Typography>
            {history.length > 0 && (
              <IconButton size="small" onClick={clearHistory}>
                <ClearIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          <Divider />
          <List dense>
            {historyItems.map((item, index) => (
              <ListItem key={index} disablePadding>
                <ListItemButton onClick={() => handleHistoryItemClick(item)}>
                  <ListItemText primary={item} />
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromHistory(item);
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Settings popover */}
      <Popover
        open={showSettings}
        anchorEl={anchorEl}
        onClose={handleSettingsClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Paper sx={{ p: 2, minWidth: 250 }}>
          <Typography variant="subtitle2" gutterBottom>
            Search Settings
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={caseSensitive}
                  onChange={(e) => updateSearch({ caseSensitive: e.target.checked })}
                  size="small"
                />
              }
              label="Case Sensitive"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={exactMatch}
                  onChange={(e) => updateSearch({ exactMatch: e.target.checked })}
                  size="small"
                />
              }
              label="Exact Match"
            />
          </FormGroup>
          
          {searchableFields && searchableFields.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Searchable fields: {searchableFields.join(', ')}
              </Typography>
            </Box>
          )}
        </Paper>
      </Popover>
    </Box>
  );
};