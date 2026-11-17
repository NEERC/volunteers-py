import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  deletePrintAssetApiV1AdminPrintTemplateYearYearIdTemplateIdAssetsAssetIdDelete as deletePrintAsset,
  getPrintAssetApiV1AdminPrintTemplateYearYearIdTemplateIdAssetsAssetIdGet as getPrintAsset,
  uploadPrintAssetApiV1AdminPrintTemplateYearYearIdTemplateIdAssetsPost as uploadPrintAsset,
} from "@/client";
import type { PrintAsset } from "@/client/types.gen";
import { apiErrorMessage } from "@/utils/apiErrorHandling";
import { TypstEditor } from "./TypstEditor";

type Props = {
  path: { year_id: number; template_id: number };
  assets: PrintAsset[];
  onChange: (assets: PrintAsset[]) => void;
};

export function TemplateAssets({ path, assets, onChange }: Props) {
  const { t } = useTranslation();
  const [standardSource, setStandardSource] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { data } = await uploadPrintAsset({
        path,
        body: { file },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (saved) => {
      onChange([
        ...assets.filter((asset) => asset.file_name !== saved.file_name),
        saved,
      ]);
      setStandardSource(null);
    },
  });
  const remove = useMutation({
    mutationFn: (asset: PrintAsset) =>
      deletePrintAsset({
        path: { ...path, asset_id: asset.asset_id },
        throwOnError: true,
      }),
    onSuccess: (_, removed) =>
      onChange(assets.filter((asset) => asset.asset_id !== removed.asset_id)),
  });
  const edit = useMutation({
    mutationFn: async (asset: PrintAsset) => {
      const { data } = await getPrintAsset({
        path: { ...path, asset_id: asset.asset_id },
        responseType: "text",
        throwOnError: true,
      });
      if (typeof data !== "string")
        throw new Error(t("Template request failed"));
      return data;
    },
    onSuccess: setStandardSource,
  });
  const pending = upload.isPending || remove.isPending || edit.isPending;
  const error = upload.error || remove.error || edit.error;

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h6">{t("Template files")}</Typography>
        <Button component="label" disabled={pending} variant="outlined">
          {t("Upload file")}
          <input
            type="file"
            hidden
            disabled={pending}
            accept=".png,.jpg,.jpeg,.svg,.ttf,.otf,.woff2"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
              event.target.value = "";
            }}
          />
        </Button>
      </Stack>
      {assets.map((asset) => (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          key={asset.asset_id}
        >
          <Typography variant="body2">{asset.file_name}</Typography>
          {asset.file_name === "std.typ" ? (
            <Button
              size="small"
              disabled={pending}
              onClick={() => edit.mutate(asset)}
            >
              {t("Edit")}
            </Button>
          ) : (
            <Button
              size="small"
              color="error"
              disabled={pending}
              onClick={() => remove.mutate(asset)}
            >
              {t("Delete file")}
            </Button>
          )}
        </Stack>
      ))}
      {error && standardSource === null && (
        <Alert severity="error">
          {apiErrorMessage(error, t("Template request failed"))}
        </Alert>
      )}
      <Dialog
        open={standardSource !== null}
        onClose={() => !pending && setStandardSource(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>std.typ</DialogTitle>
        <DialogContent>
          <TypstEditor
            height={360}
            label="std.typ"
            value={standardSource ?? ""}
            onChange={setStandardSource}
          />
          {upload.error && (
            <Alert severity="error">
              {apiErrorMessage(upload.error, t("Template request failed"))}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={pending} onClick={() => setStandardSource(null)}>
            {t("Cancel")}
          </Button>
          <Button
            disabled={pending || standardSource === null}
            onClick={() =>
              upload.mutate(
                new File([standardSource ?? ""], "std.typ", {
                  type: "text/plain",
                }),
              )
            }
          >
            {t("Save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
