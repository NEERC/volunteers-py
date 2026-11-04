import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PersonIcon from "@mui/icons-material/Person";
import PinIcon from "@mui/icons-material/PushPin";
import PinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Button,
  Card,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PositionOut, RegistrationFormItem } from "@/client/types.gen";
import { DetailedUserCard } from "@/components/DetailedUserCard";
import {
  filterAndSortAvailableVolunteers,
  type VolunteerSort,
} from "@/utils/available-volunteers";

function DraggableDetailedUserCard({
  user,
  isSelected,
  onClick,
  isMobile = false,
}: {
  user: RegistrationFormItem;
  isSelected: boolean;
  onClick: () => void;
  isMobile?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `user-${user.user_id}`,
    disabled: isMobile, // Disable drag on mobile
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...(isMobile ? {} : attributes)}
      {...(isMobile ? {} : listeners)}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      sx={{
        mb: 2,
        cursor: isMobile ? "pointer" : "grab",
        "&:active": { cursor: isMobile ? "pointer" : "grabbing" },
        opacity: isDragging ? 0.5 : 1,
        border: isSelected ? "2px solid" : "1px solid",
        borderColor: isSelected ? "primary.main" : "divider",
        backgroundColor: isSelected ? "action.selected" : "background.paper",
        "&:hover": {
          backgroundColor: isSelected ? "action.selected" : "action.hover",
        },
      }}
    >
      <DetailedUserCard user={user} expandedDefault={true} />
    </Card>
  );
}

export function AvailableVolunteersDrawer({
  unassignedUsers,
  positions,
  activeId,
  isPinned,
  onPinChange,
  clickSelectedUserId,
  onUserClick,
  onRemoveAssignment,
  isMobile = false,
}: {
  unassignedUsers: RegistrationFormItem[];
  positions: PositionOut[];
  activeId: string | null;
  isPinned: boolean;
  onPinChange: (pinned: boolean) => void;
  clickSelectedUserId: number | null;
  onUserClick: (userId: number) => void;
  onRemoveAssignment: (userId: number) => void;
  isMobile?: boolean;
}) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [search, setSearch] = useState("");
  const [positionId, setPositionId] = useState<number | null>(null);
  const [sort, setSort] = useState<VolunteerSort>("original");
  const searchId = useId();
  const positionIdLabel = useId();
  const positionSelectId = useId();
  const sortIdLabel = useId();
  const sortSelectId = useId();
  const sortedPositions = useMemo(
    () =>
      positions
        .filter((position) => position.can_desire)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [positions],
  );
  const visibleUsers = useMemo(
    () =>
      filterAndSortAvailableVolunteers(unassignedUsers, {
        search,
        positionId,
        sort,
      }),
    [unassignedUsers, search, positionId, sort],
  );
  const hasFilters = search.trim().length > 0 || positionId !== null;
  const { isOver, setNodeRef } = useDroppable({
    id: "hover-drawer-area",
  });

  // Don't open drawer when dragging, but show if pinned
  // On mobile, only show if pinned (no hover)
  const shouldShowDrawer = isMobile
    ? isPinned && !activeId
    : (isHovered || isPinned) && !activeId;

  return (
    <Box
      ref={setNodeRef}
      sx={{
        position: "fixed",
        // Desktop: right side drawer
        ...(isMobile
          ? {}
          : {
              right: 0,
              top: 0,
              height: "100vh",
              width: shouldShowDrawer ? "500px" : "50px",
            }),
        // Mobile: bottom drawer
        ...(isMobile
          ? {
              bottom: 0,
              left: 0,
              right: 0,
              height: shouldShowDrawer ? "60vh" : "60px",
              width: "100vw",
            }
          : {}),
        backgroundColor: isOver
          ? "action.hover"
          : clickSelectedUserId
            ? "action.selected"
            : "background.paper",
        border: isOver
          ? "2px dashed"
          : clickSelectedUserId
            ? "2px solid"
            : "1px solid",
        boxSizing: "border-box",
        borderColor: isOver
          ? "primary.main"
          : clickSelectedUserId
            ? "primary.main"
            : "divider",
        transition: isPinned
          ? "none"
          : isMobile
            ? "height 0.3s ease-in-out"
            : "width 0.3s ease-in-out",
        zIndex: 3000,
        overflow: "hidden",
        cursor: clickSelectedUserId ? "pointer" : "default",
        "&:hover": {
          // Only apply hover effects on desktop
          ...(isMobile
            ? {}
            : {
                width: isPinned ? "500px" : shouldShowDrawer ? "500px" : "50px",
              }),
        },
      }}
      onMouseEnter={() => !isMobile && !isPinned && setIsHovered(true)}
      onMouseLeave={() => !isMobile && !isPinned && setIsHovered(false)}
    >
      {/* Hover trigger area */}
      <Box
        onClick={(e) => {
          e.stopPropagation();
          // On mobile, clicking the trigger area toggles the drawer
          if (isMobile) {
            onPinChange(!isPinned);
          }
        }}
        sx={{
          position: "absolute",
          // Desktop: right side trigger
          ...(isMobile
            ? {}
            : {
                right: 0,
                top: 0,
                width: "50px",
                height: "100%",
                flexDirection: "column",
              }),
          // Mobile: bottom trigger
          ...(isMobile
            ? {
                bottom: 0,
                left: 0,
                right: 0,
                height: "60px",
                width: "100%",
                flexDirection: "row",
              }
            : {}),
          backgroundColor: "primary.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          cursor: "pointer",
          zIndex: 3001,
          pointerEvents: "auto",
        }}
      >
        <PersonIcon
          sx={{
            color: "white",
            transform: isMobile ? "none" : "rotate(90deg)",
          }}
        />
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onPinChange(!isPinned);
          }}
          sx={{
            color: "white",
            padding: 0.5,
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 0.1)",
            },
          }}
        >
          {isPinned ? (
            <PinIcon sx={{ fontSize: 16 }} />
          ) : (
            <PinOutlinedIcon sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      </Box>

      {/* Drawer content */}
      <Box
        onClick={(e) => {
          e.stopPropagation();
          // Handle clicks on empty areas of the drawer content
          if (clickSelectedUserId) {
            onRemoveAssignment(clickSelectedUserId);
          }
        }}
        sx={{
          // Desktop: right side content
          ...(isMobile
            ? {}
            : {
                width: "calc(500px - 50px - 2px)",
                height: "100%",
                pt: 8,
              }),
          // Mobile: bottom content
          ...(isMobile
            ? {
                width: "100%",
                height: "calc(60vh - 60px - 2px)",
                pb: 8,
              }
            : {}),
          boxSizing: "border-box",
          p: 2,
          overflowY: "auto",
          overflowX: "hidden",
          // opacity: shouldShowDrawer ? 1 : 0,
          // transition: "opacity 0.2s ease-in-out",
          pointerEvents: "auto",
          position: "relative",
          // ...(clickSelectedUserId && {
          //   "&::before": {
          //     content: '""',
          //     position: "absolute",
          //     top: 0,
          //     left: 0,
          //     right: 0,
          //     bottom: 0,
          //     border: "2px dashed",
          //     borderColor: "primary.main",
          //     borderRadius: 1,
          //     pointerEvents: "none",
          //     animation: "pulse 2s infinite",
          //   },
          // }),
        }}
      >
        <Typography
          variant="h6"
          sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
        >
          <PersonIcon />
          {t("Available Volunteers")}
        </Typography>

        <Box
          onClick={(event) => event.stopPropagation()}
          sx={{ display: "grid", gap: 1, mb: 2 }}
        >
          <TextField
            id={searchId}
            label={t("Search")}
            size="small"
            fullWidth
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControl size="small" fullWidth>
            <InputLabel id={positionIdLabel}>{t("Filter")}</InputLabel>
            <Select
              id={positionSelectId}
              labelId={positionIdLabel}
              label={t("Filter")}
              value={positionId === null ? "" : String(positionId)}
              MenuProps={{ sx: { zIndex: 3002 } }}
              onChange={(event) =>
                setPositionId(
                  event.target.value === "" ? null : Number(event.target.value),
                )
              }
            >
              <MenuItem value="">{t("All positions")}</MenuItem>
              {sortedPositions.map((position) => (
                <MenuItem
                  key={position.position_id}
                  value={String(position.position_id)}
                >
                  {position.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel id={sortIdLabel}>{t("Sort")}</InputLabel>
            <Select
              id={sortSelectId}
              labelId={sortIdLabel}
              label={t("Sort")}
              value={sort}
              MenuProps={{ sx: { zIndex: 3002 } }}
              onChange={(event) => setSort(event.target.value as VolunteerSort)}
            >
              <MenuItem value="original">{t("Original order")}</MenuItem>
              <MenuItem value="experience">
                {t("Most experienced first")}
              </MenuItem>
              <MenuItem value="newest">{t("Newest forms first")}</MenuItem>
              <MenuItem value="name">{t("By name")}</MenuItem>
            </Select>
          </FormControl>
          {(hasFilters || sort !== "original") && (
            <Button
              size="small"
              onClick={() => {
                setSearch("");
                setPositionId(null);
                setSort("original");
              }}
            >
              {t("Reset filters")}
            </Button>
          )}
        </Box>

        {clickSelectedUserId && (
          <Box sx={{ mb: 2 }}>
            <Button
              onClick={() => onRemoveAssignment(clickSelectedUserId)}
              variant="contained"
              color="error"
            >
              {t("Click here to remove assignment")}
            </Button>
          </Box>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {hasFilters
            ? t("{{shown}} of {{total}} volunteers shown", {
                shown: visibleUsers.length,
                total: unassignedUsers.length,
              })
            : `${unassignedUsers.length} ${t("volunteers available")}`}
        </Typography>

        <Divider sx={{ mb: 2 }} />

        {visibleUsers.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center", py: 4 }}
          >
            {t(
              unassignedUsers.length === 0
                ? "All volunteers have been assigned to positions"
                : "No volunteers match the filters",
            )}
          </Typography>
        ) : (
          visibleUsers.map((user) => (
            <DraggableDetailedUserCard
              key={user.user_id}
              user={user}
              isSelected={clickSelectedUserId === user.user_id}
              onClick={() => onUserClick(user.user_id)}
              isMobile={isMobile}
            />
          ))
        )}
      </Box>
    </Box>
  );
}
