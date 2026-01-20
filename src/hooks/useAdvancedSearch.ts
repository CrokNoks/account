import { useState, useMemo, useCallback, useEffect } from 'react';
import { debounce } from 'lodash';

interface SearchOptions {
  query: string;
  fields?: string[];
  caseSensitive?: boolean;
  exactMatch?: boolean;
}

interface SearchResult<T> {
  item: T;
  score: number;
  matchedFields: string[];
}

export const useAdvancedSearch = <T extends Record<string, any>>(
  data: T[],
  options: SearchOptions
) => {
  const [searchOptions, setSearchOptions] = useState<SearchOptions>(options);
  const [isSearching, setIsSearching] = useState(false);

  // Default searchable fields
  const searchableFields = searchOptions.fields || Object.keys(data[0] || {});

  // Search function with scoring
  const search = useCallback((items: T[], opts: SearchOptions): SearchResult<T>[] => {
    if (!opts.query.trim()) {
      return items.map(item => ({ item, score: 0, matchedFields: [] }));
    }

    const searchTerm = opts.caseSensitive ? opts.query : opts.query.toLowerCase();
    const results: SearchResult<T>[] = [];

    for (const item of items) {
      let score = 0;
      const matchedFields: string[] = [];

      for (const field of searchableFields) {
        const fieldValue = item[field];
        
        if (fieldValue === null || fieldValue === undefined) continue;

        const value = opts.caseSensitive ? 
          String(fieldValue) : 
          String(fieldValue).toLowerCase();

        if (opts.exactMatch) {
          if (value === searchTerm) {
            score += 100; // Perfect match gets highest score
            matchedFields.push(field);
          }
        } else {
          if (value.includes(searchTerm)) {
            // Calculate score based on match position and length
            const position = value.indexOf(searchTerm);
            const lengthRatio = searchTerm.length / value.length;
            const positionScore = 1 - (position / value.length);
            
            score += positionScore * 50 + lengthRatio * 20;
            matchedFields.push(field);
          }
        }
      }

      if (score > 0) {
        results.push({ item, score, matchedFields });
      }
    }

    // Sort by score (descending)
    return results.sort((a, b) => b.score - a.score);
  }, [searchableFields]);

  // Debounced search function
  const debouncedSearch = useMemo(
    () => debounce((query: string) => {
      setIsSearching(true);
      setSearchOptions(prev => ({ ...prev, query }));
      
      // Small delay to show loading state
      setTimeout(() => setIsSearching(false), 150);
    }, 300),
    []
  );

  // Memoized search results
  const searchResults = useMemo(() => {
    return search(data, searchOptions);
  }, [data, searchOptions, search]);

  // Update search options
  const updateSearch = useCallback((newOptions: Partial<SearchOptions>) => {
    setSearchOptions(prev => ({ ...prev, ...newOptions }));
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchOptions(prev => ({ ...prev, query: '' }));
  }, []);

  // Debounced query update
  const setQuery = useCallback((query: string) => {
    debouncedSearch(query);
  }, [debouncedSearch]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  return {
    // Search state
    query: searchOptions.query,
    searchResults,
    isSearching,
    hasQuery: searchOptions.query.trim().length > 0,
    
    // Search options
    caseSensitive: searchOptions.caseSensitive || false,
    exactMatch: searchOptions.exactMatch || false,
    
    // Actions
    setQuery,
    updateSearch,
    clearSearch,
    
    // Utilities
    filteredData: searchResults.map(result => result.item),
    highlightedResults: searchResults,
  };
};

// Hook for search history
export const useSearchHistory = (maxItems = 10) => {
  const storageKey = 'search_history';
  
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addToHistory = useCallback((query: string) => {
    if (!query.trim()) return;

    setHistory(prev => {
      const filtered = prev.filter(item => item !== query);
      const newHistory = [query, ...filtered].slice(0, maxItems);
      
      try {
        localStorage.setItem(storageKey, JSON.stringify(newHistory));
      } catch {
        // Ignore localStorage errors
      }
      
      return newHistory;
    });
  }, [maxItems]);

  const removeFromHistory = useCallback((query: string) => {
    setHistory(prev => {
      const newHistory = prev.filter(item => item !== query);
      try {
        localStorage.setItem(storageKey, JSON.stringify(newHistory));
      } catch {
        // Ignore localStorage errors
      }
      return newHistory;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
  };
};

// Highlight text matching search query - returns HTML string
export const highlightText = (text: string, query: string, caseSensitive = false): string => {
  if (!query.trim()) return text;

  const searchText = caseSensitive ? query : query.toLowerCase();
  const sourceText = caseSensitive ? text : text.toLowerCase();
  const index = sourceText.indexOf(searchText);

  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return `${before}<mark style="background-color: #ffeb3b; padding: 1px 2px; border-radius: 2px;">${match}</mark>${after}`;
};