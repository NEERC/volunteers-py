import { Star, StarBorder } from "@mui/icons-material";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AssessmentInAttendance } from "@/client/types.gen";

interface AssessmentInputProps {
  userDayId: number;
  assessments: AssessmentInAttendance[];
  canEdit: boolean;
  onAdd: (userDayId: number, value: number, comment: string) => Promise<void>;
  onEdit: (
    assessmentId: number,
    value: number | null,
    comment: string | null,
  ) => Promise<void>;
  onDelete: (assessmentId: number) => Promise<void>;
}

export function AssessmentInput({
  userDayId,
  assessments,
  canEdit,
  onAdd,
  onEdit,
  onDelete,
}: AssessmentInputProps) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] =
    useState<AssessmentInAttendance | null>(null);
  const [value, setValue] = useState("");
  const [comment, setComment] = useState("");
  const scoreInputRef = useRef<HTMLInputElement | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);

  const averageScore = useMemo(() => {
    if (!assessments.length) {
      return null;
    }
    const avg =
      assessments.reduce((sum, a) => sum + a.value, 0) / assessments.length;
    return Number(avg.toFixed(2));
  }, [assessments]);

  const formatAverage = (score: number) => {
    if (Number.isInteger(score)) {
      return score.toString();
    }
    return score.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  };

  const handleOpenDialog = (assessment?: AssessmentInAttendance) => {
    if (assessment) {
      setEditingAssessment(assessment);
      setValue(assessment.value.toString());
      setComment(assessment.comment);
    } else {
      setEditingAssessment(null);
      setValue("");
      setComment("");
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAssessment(null);
    setValue("");
    setComment("");
  };

  const handleSave = async () => {
    const numValue = Number.parseFloat(value);
    const trimmedComment = comment.trim();
    if (Number.isNaN(numValue) || !trimmedComment) {
      return;
    }

    if (editingAssessment) {
      await onEdit(editingAssessment.assessment_id, numValue, trimmedComment);
    } else {
      await onAdd(userDayId, numValue, trimmedComment);
    }

    handleCloseDialog();
  };

  const handleDelete = async () => {
    if (editingAssessment) {
      await onDelete(editingAssessment.assessment_id);
      handleCloseDialog();
    }
  };

  const presetValues = [0.1, 0.25, 0.5];

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          justifyContent: "center",
        }}
      >
        {averageScore !== null ? (
          <Tooltip
            title={
              assessments.length > 1
                ? `${t("Average of")} ${assessments.length} ${t("assessments")}`
                : assessments[0]?.comment || t("Assessment")
            }
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                cursor: canEdit ? "pointer" : "default",
              }}
              onClick={() => {
                if (canEdit && assessments.length === 1) {
                  handleOpenDialog(assessments[0]);
                } else if (canEdit) {
                  handleOpenDialog();
                }
              }}
            >
              <Star sx={{ fontSize: 16, color: "warning.main" }} />
              <Typography variant="body2" fontWeight="medium">
                {formatAverage(averageScore)}
              </Typography>
            </Box>
          </Tooltip>
        ) : canEdit ? (
          <Tooltip title={t("Add assessment")}>
            <IconButton
              size="small"
              onClick={() => handleOpenDialog()}
              sx={{ p: 0.5 }}
            >
              <StarBorder sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        ) : (
          <Typography variant="body2" color="text.secondary">
            -
          </Typography>
        )}
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingAssessment ? t("Edit Assessment") : t("Add Assessment")}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              label={t("Score")}
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputRef={scoreInputRef}
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.ctrlKey) {
                  // Ctrl+Enter: save if comment is filled
                  if (comment.trim()) {
                    event.preventDefault();
                    handleSave();
                  }
                } else if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.ctrlKey
                ) {
                  // Just Enter: move to comment field
                  event.preventDefault();
                  commentInputRef.current?.focus();
                }
              }}
              slotProps={{
                htmlInput: { step: 0.01 },
              }}
              fullWidth
              required
            />
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {presetValues.map((preset) => (
                <Button
                  key={preset}
                  variant="outlined"
                  size="small"
                  onClick={() => setValue(preset.toString())}
                >
                  {preset}
                </Button>
              ))}
            </Box>
            <TextField
              label={t("Comment")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              inputRef={commentInputRef}
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.ctrlKey) {
                  event.preventDefault();
                  handleSave();
                }
              }}
              multiline
              rows={3}
              fullWidth
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          {editingAssessment && (
            <Button onClick={handleDelete} color="error" sx={{ mr: "auto" }}>
              {t("Delete")}
            </Button>
          )}
          <Button onClick={handleCloseDialog}>{t("Cancel")}</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={
              !value ||
              Number.isNaN(Number.parseFloat(value)) ||
              !comment.trim()
            }
          >
            {t("Save")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
