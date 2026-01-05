import { useState } from 'react';
import { useDataProvider, useNotify, useRefresh, Button } from 'react-admin';
import PaletteIcon from '@mui/icons-material/Palette';
import { useAccount } from '../../context/AccountContext';

const BLACK_COLOR = '#000000';
const MIN_COLOR_DISTANCE = 100; // Threshold for color difference

export const AutoColorCategoriesButton = () => {
  const { selectedAccountId } = useAccount();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [loading, setLoading] = useState(false);

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  const colorDistance = (color1: string, color2: string) => {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    if (!rgb1 || !rgb2) return 0;

    // Simple Euclidean distance in RGB space
    return Math.sqrt(
      Math.pow(rgb2.r - rgb1.r, 2) +
      Math.pow(rgb2.g - rgb1.g, 2) +
      Math.pow(rgb2.b - rgb1.b, 2)
    );
  };

  const generateRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  const generateDistinctColor = (existingColors: string[]) => {
    let newColor = generateRandomColor();
    let attempts = 0;
    let isDistinct = false;

    // Try to find a distinct color (max 50 attempts to avoid infinite loop)
    while (!isDistinct && attempts < 50) {
      newColor = generateRandomColor();
      // Ensure specific saturation/lightness if needed, but random is requested with constraint
      // Let's stick to full random for now but check distance

      const tooClose = existingColors.some(existing => colorDistance(existing, newColor) < MIN_COLOR_DISTANCE);
      if (!tooClose) {
        isDistinct = true;
      }
      attempts++;
    }
    return newColor;
  };

  const handleClick = async () => {
    if (!selectedAccountId) return;
    setLoading(true);

    try {
      // 1. Fetch all categories
      const { data: categories } = await dataProvider.getList('categories', {
        filter: { account_id: selectedAccountId },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: 'id', order: 'ASC' }
      });

      // 2. Identify target categories (black or undefined)
      const targets = categories.filter((c: any) => !c.color || c.color === BLACK_COLOR || c.color === '#000');
      const existingColors = categories
        .filter((c: any) => c.color && c.color !== BLACK_COLOR && c.color !== '#000')
        .map((c: any) => c.color);

      if (targets.length === 0) {
        notify('Aucune catégorie à mettre à jour (pas de couleur noire trouvée)', { type: 'info' });
        setLoading(false);
        return;
      }

      // 3. Generate colors and update
      // We process sequentially to ensure each new color is checked against the growing list of existing ones
      const updates = [];

      // Local copy of colors to check against as we generate
      const currentPool = [...existingColors];

      for (const category of targets) {
        const newColor = generateDistinctColor(currentPool);
        currentPool.push(newColor);

        updates.push(
          dataProvider.update('categories', {
            id: category.id,
            data: { ...category, color: newColor },
            previousData: category
          })
        );
      }

      await Promise.all(updates);

      notify(`Couleurs générées pour ${updates.length} catégories`, { type: 'success' });
      refresh();

    } catch (error) {
      console.error(error);
      notify('Erreur lors de la génération des couleurs', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      label="Auto Color"
      onClick={handleClick}
      disabled={loading}
      startIcon={<PaletteIcon />}
    />
  );
};
