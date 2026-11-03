import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  MergeFormSummary,
  UserIdentityResponse,
  VolunteersApiV1AdminUserSchemasUserResponse as UserResponse,
} from "@/client/types.gen";
import { PROVIDER_NAMES } from "@/const";
import { useAllUsers, useMergePreview, useMergeUsers } from "@/data/use-admin";
import { apiErrorMessage } from "@/utils/apiErrorHandling";
import { duplicateKey } from "@/utils/duplicates";
import { getGenderLabel } from "@/utils/gender";

type Props = {
  user: UserResponse;
  open: boolean;
  onClose: () => void;
};

const FIELDS = [
  ["last_name_ru", "Last Name (RU)"],
  ["first_name_ru", "First Name (RU)"],
  ["patronymic_ru", "Patronymic (RU)"],
  ["last_name_en", "Last Name (EN)"],
  ["first_name_en", "First Name (EN)"],
  ["isu_id", "ISU ID"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["telegram_username", "Telegram Username"],
  ["gender", "Gender"],
  ["is_admin", "Admin"],
] as const;

const userLabel = (user: UserResponse) =>
  [
    `#${user.user_id}`,
    user.last_name_ru,
    user.first_name_ru,
    user.patronymic_ru,
    user.email && `· ${user.email}`,
    user.telegram_username && `· @${user.telegram_username}`,
  ]
    .filter(Boolean)
    .join(" ");

export function MergeUsersDialog({ user, open, onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: allUsers, isLoading: usersLoading } = useAllUsers();
  const [other, setOther] = useState<UserResponse | null>(null);
  const [keptForms, setKeptForms] = useState<Record<number, number>>({});
  const [keptIdentities, setKeptIdentities] = useState<Record<string, number>>(
    {},
  );
  const preview = useMergePreview(user.user_id, other?.user_id ?? null);
  const mergeMutation = useMergeUsers();

  // Suspected duplicates (same normalized name) go first
  const options = useMemo(() => {
    const key = duplicateKey(user);
    return (allUsers?.users ?? [])
      .filter((u) => u.user_id !== user.user_id)
      .map((u) => ({
        user: u,
        duplicate: key !== null && duplicateKey(u) === key,
      }))
      .sort((a, b) => Number(b.duplicate) - Number(a.duplicate));
  }, [allUsers, user]);

  const selectOther = (value: UserResponse | null) => {
    setOther(value);
    setKeptForms({});
    setKeptIdentities({});
    mergeMutation.reset();
  };

  const close = () => {
    selectOther(null);
    onClose();
  };

  const data = preview.data;
  const resolved =
    !!data &&
    data.form_conflicts.every((c) => keptForms[c.year_id] !== undefined) &&
    data.identity_conflicts.every(
      (c) => keptIdentities[c.provider] !== undefined,
    );

  const merge = () => {
    if (!other) return;
    mergeMutation.mutate(
      {
        userId: user.user_id,
        otherUserId: other.user_id,
        data: { kept_form_ids: keptForms, kept_identity_ids: keptIdentities },
      },
      {
        onSuccess: (merged) => {
          close();
          // The current user may have been merged into the other one
          if (merged.user_id !== user.user_id) {
            navigate({
              to: "/users/$userId",
              params: { userId: String(merged.user_id) },
            });
          }
        },
      },
    );
  };

  const fieldValue = (u: UserResponse, field: (typeof FIELDS)[number][0]) => {
    const value = u[field];
    if (field === "gender") return getGenderLabel(value as string | null, t);
    if (typeof value === "boolean") return value ? t("Yes") : t("No");
    return value === null || value === "" ? "—" : String(value);
  };

  const formLabel = (form: MergeFormSummary) => (
    <Box sx={{ py: 0.5 }}>
      <Typography variant="body2" fontWeight="medium">
        {t("Account")} #{form.user_id}
        {form.itmo_group ? ` · ${form.itmo_group}` : ""} ·{" "}
        {new Date(form.created_at).toLocaleDateString()}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {form.days.length
          ? form.days
              .map(
                (d) =>
                  `${d.day_name}: ${d.position_name}${d.assessments_count ? ` (${t("assessments")}: ${d.assessments_count})` : ""}`,
              )
              .join("; ")
          : t("No assignments")}
      </Typography>
      {form.desired_positions.length > 0 && (
        <Typography variant="body2" color="text.secondary">
          {t("Desired positions")}: {form.desired_positions.join(", ")}
        </Typography>
      )}
      {form.comments && (
        <Typography variant="body2" color="text.secondary">
          {t("Comments")}: {form.comments}
        </Typography>
      )}
    </Box>
  );

  const identityLabel = (identity: UserIdentityResponse, userId: number) =>
    `${t("Account")} #${userId}: ${identity.display_name ?? identity.subject} (${t("ID")}: ${identity.subject})`;

  return (
    <Dialog open={open} onClose={close} maxWidth="md" fullWidth>
      <DialogTitle>{t("Merge accounts")}</DialogTitle>
      <DialogContent>
        <Autocomplete
          options={options}
          loading={usersLoading}
          value={options.find((o) => o.user.user_id === other?.user_id) ?? null}
          onChange={(_, value) => selectOther(value?.user ?? null)}
          getOptionLabel={(o) => userLabel(o.user)}
          groupBy={(o) =>
            o.duplicate ? t("Suspected duplicates") : t("All users")
          }
          isOptionEqualToValue={(a, b) => a.user.user_id === b.user.user_id}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t("Account to merge with")}
              placeholder={t("Search users...")}
              sx={{ mt: 1 }}
            />
          )}
        />

        {preview.isLoading && (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        )}
        {preview.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {apiErrorMessage(preview.error, t("Failed to load merge preview"))}
          </Alert>
        )}

        {data && (
          <>
            <Alert severity="warning" sx={{ mt: 2 }}>
              {t(
                "Account #{{target}} (the older one) is kept with the profile of account #{{source}}. Everything of account #{{source}} is moved to it, then account #{{source}} is deleted. This cannot be undone.",
                { target: data.target.user_id, source: data.source.user_id },
              )}
            </Alert>

            <Typography variant="h6" sx={{ mt: 3 }}>
              {t("Profile")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                "Fields are taken from the newer account, empty ones are filled from the older account.",
              )}
            </Typography>
            <Table size="small" sx={{ mt: 1 }}>
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>#{data.target.user_id}</TableCell>
                  <TableCell>#{data.source.user_id}</TableCell>
                  <TableCell>{t("Result")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {FIELDS.map(([field, label]) => {
                  // The value of the older account is replaced by the newer one
                  const replaced =
                    fieldValue(data.target, field) !==
                    fieldValue(data.merged, field);
                  return (
                    <TableRow key={field}>
                      <TableCell>{t(label)}</TableCell>
                      <TableCell
                        sx={
                          replaced
                            ? {
                                color: "warning.main",
                                textDecoration: "line-through",
                              }
                            : undefined
                        }
                      >
                        {fieldValue(data.target, field)}
                      </TableCell>
                      <TableCell>{fieldValue(data.source, field)}</TableCell>
                      <TableCell sx={{ fontWeight: "medium" }}>
                        {fieldValue(data.merged, field)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {data.form_conflicts.length + data.identity_conflicts.length > 0 ? (
              <>
                <Typography variant="h6" sx={{ mt: 3 }}>
                  {t("Conflicts")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(
                    "Choose what to keep. The other one is deleted together with its assignments and assessments.",
                  )}
                </Typography>
              </>
            ) : (
              <Alert severity="success" sx={{ mt: 3 }}>
                {t("No conflicts: everything is moved to the kept account.")}
              </Alert>
            )}

            {data.form_conflicts.map((conflict) => (
              <Box key={conflict.year_id} sx={{ mt: 2 }}>
                <Typography variant="subtitle1" fontWeight="medium">
                  {t("Application form for {{year}}", {
                    year: conflict.year_name,
                  })}
                </Typography>
                <RadioGroup
                  value={keptForms[conflict.year_id] ?? ""}
                  onChange={(e) =>
                    setKeptForms((prev) => ({
                      ...prev,
                      [conflict.year_id]: Number(e.target.value),
                    }))
                  }
                >
                  {conflict.forms.map((form) => (
                    <FormControlLabel
                      key={form.form_id}
                      value={form.form_id}
                      control={<Radio />}
                      label={formLabel(form)}
                      sx={{
                        alignItems: "flex-start",
                        "& .MuiRadio-root": { pt: 0.5 },
                      }}
                    />
                  ))}
                </RadioGroup>
              </Box>
            ))}

            {data.identity_conflicts.map((conflict) => (
              <Box key={conflict.provider} sx={{ mt: 2 }}>
                <Typography variant="subtitle1" fontWeight="medium">
                  {t("{{provider}} account", {
                    provider: t(PROVIDER_NAMES[conflict.provider]),
                  })}
                </Typography>
                <RadioGroup
                  value={keptIdentities[conflict.provider] ?? ""}
                  onChange={(e) =>
                    setKeptIdentities((prev) => ({
                      ...prev,
                      [conflict.provider]: Number(e.target.value),
                    }))
                  }
                >
                  {conflict.identities.map((identity, index) => (
                    <FormControlLabel
                      key={identity.id}
                      value={identity.id}
                      control={<Radio />}
                      label={identityLabel(
                        identity,
                        index === 0 ? data.target.user_id : data.source.user_id,
                      )}
                    />
                  ))}
                </RadioGroup>
              </Box>
            ))}

            {mergeMutation.error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {apiErrorMessage(
                  mergeMutation.error,
                  t("Failed to merge accounts"),
                )}
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={mergeMutation.isPending}>
          {t("Cancel")}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={merge}
          disabled={!resolved || mergeMutation.isPending}
        >
          {mergeMutation.isPending ? t("Merging...") : t("Merge")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
