
import { Box, Typography } from "@mui/material";

export const CategoryShip = ({ cat, chipOnly = false }: { cat: any, chipOnly?: boolean }) => {
  return (<Box display="flex" alignItems="center" gap={1} mb={0.5}>
    <Box
      sx={{
        minWidth: 16,
        minHeight: 16,
        bgcolor: cat.color,
        borderRadius: '50%'
      }}
    />
    {!chipOnly &&
      <Typography variant="body2" fontWeight="bold">
        {cat.name}
      </Typography>
    }
  </Box>)
}