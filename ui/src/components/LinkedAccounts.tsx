import DeleteIcon from "@mui/icons-material/Delete";
import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { TelegramLoginButton } from "@/components/TelegramLoginButton";
import { PROVIDER_NAMES } from "@/const";
import {
  useLinkTelegram,
  useMyIdentities,
  useTelegramAvailable,
  useUnlinkIdentity,
} from "@/data/use-auth";
import { apiErrorMessage } from "@/utils/apiErrorHandling";

export function LinkedAccounts() {
  const { t } = useTranslation();
  const { data: identities, isLoading } = useMyIdentities();
  const linkTelegram = useLinkTelegram();
  const unlinkIdentity = useUnlinkIdentity();
  const telegramAvailable = useTelegramAvailable();

  const error = linkTelegram.error ?? unlinkIdentity.error;
  const hasTelegram = identities?.some((i) => i.provider === "telegram");

  return (
    <Paper sx={{ p: 3, width: "100%", maxWidth: 520, textAlign: "left" }}>
      <Typography variant="h6" gutterBottom>
        {t("Linked accounts")}
      </Typography>
      {isLoading ? (
        <CircularProgress size={24} />
      ) : (
        <List dense>
          {identities?.map((identity) => (
            <ListItem
              key={identity.id}
              secondaryAction={
                identity.provider !== "keycloak" && (
                  <Tooltip title={t("Unlink")}>
                    <IconButton
                      edge="end"
                      aria-label={t("Unlink")}
                      disabled={unlinkIdentity.isPending}
                      onClick={() => {
                        if (window.confirm(t("Unlink this account?"))) {
                          unlinkIdentity.mutate(identity.id);
                        }
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                )
              }
            >
              <ListItemText
                primary={t(PROVIDER_NAMES[identity.provider])}
                secondary={identity.display_name}
              />
            </ListItem>
          ))}
        </List>
      )}
      {!isLoading && !hasTelegram && telegramAvailable && (
        <>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t("Link your Telegram account to sign in with it")}
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              position: "relative",
              minHeight: 40,
            }}
          >
            <TelegramLoginButton onAuth={(data) => linkTelegram.mutate(data)} />
          </Box>
        </>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t(apiErrorMessage(error, "Unknown error"))}
        </Alert>
      )}
    </Paper>
  );
}
