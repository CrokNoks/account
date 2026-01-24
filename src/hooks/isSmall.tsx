import { useMediaQuery, Theme } from "@mui/material";

// Custom hook interface following TypeScript guidelines
interface UseIsSmallReturn {
  isSmall: boolean;
  isMedium: boolean;
  isLarge: boolean;
}

// Memoized custom hook to avoid recreation on every call
export const useIsSmall = (): boolean => {
  return useMediaQuery<Theme>((theme) => theme.breakpoints.down("sm"));
};

// Enhanced hook for responsive design
export const useResponsive = (): UseIsSmallReturn => {
  const isSmall = useMediaQuery<Theme>((theme) => theme.breakpoints.down("sm"));
  const isMedium = useMediaQuery<Theme>((theme) => theme.breakpoints.down("md"));
  const isLarge = useMediaQuery<Theme>((theme) => theme.breakpoints.down("lg"));

  return {
    isSmall,
    isMedium,
    isLarge,
  };
};