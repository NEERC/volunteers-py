import DoneAllIcon from "@mui/icons-material/DoneAll";
import { Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";

// Shown next to a volunteer who confirmed they will come on the day
export function ConfirmedMark() {
  const { t } = useTranslation();
  return (
    <Tooltip title={t("Confirmed they will come")}>
      <DoneAllIcon
        color="primary"
        fontSize="small"
        aria-label={t("Confirmed they will come")}
        data-testid="confirmed-mark"
        sx={{ verticalAlign: "middle" }}
      />
    </Tooltip>
  );
}
