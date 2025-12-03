import { useMediaQuery, Theme } from "@mui/material";

export const useIsSmall = () => {
  return useMediaQuery<Theme>((theme) => theme.breakpoints.down("sm"));
}