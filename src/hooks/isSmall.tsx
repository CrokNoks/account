import { useMediaQuery, Theme } from "@mui/material";

// Memoize to avoid recreation on every call
export const useIsSmall = () => {
  return useMediaQuery<Theme>((theme) => theme.breakpoints.down("sm"));
}