import AssessmentIcon from "@mui/icons-material/Assessment";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContactsIcon from "@mui/icons-material/Contacts";
import DescriptionIcon from "@mui/icons-material/Description";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import GroupIcon from "@mui/icons-material/Group";
import MenuIcon from "@mui/icons-material/Menu";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  AppBar,
  Box,
  Button,
  Collapse,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  type SelectChangeEvent,
  styled,
  type Theme,
  Toolbar,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useLocation,
  useMatch,
  useNavigate,
} from "@tanstack/react-router";
import { observer } from "mobx-react-lite";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { getFormYearApiV1YearYearIdGet } from "@/client";
import { queryKeys, useYears } from "@/data";
import { authStore } from "@/store/auth";
import LanguageSwitcher from "./LanguageSwitcher";

// Route configuration types
interface BaseRoute {
  id: string;
  labelKey: string;
  icon: React.ComponentType;
  path: string;
  adminOnly?: boolean;
  managerOnly?: boolean;
}

interface CollapsibleRoute extends BaseRoute {
  type: "collapsible";
  children: Array<{
    id: string;
    labelKey?: string;
    label?: string;
    path: string;
    adminOnly?: boolean;
  }>;
}

interface SimpleRoute extends BaseRoute {
  type: "simple";
}

type RouteConfig = SimpleRoute | CollapsibleRoute;

const drawerWidth = 240;

// Routes configuration
const getRoutesConfig = (
  selectedYear: string | null,
  yearData: { days?: Array<{ day_id: number; name: string }> },
): RouteConfig[] => [
  ...(selectedYear !== null
    ? ([
        {
          id: "registration",
          type: "simple",
          labelKey: "Registration Form",
          icon: AssignmentIcon,
          path: `/${selectedYear}/registration`,
        },
        {
          id: "contacts",
          type: "simple",
          labelKey: "Contacts",
          icon: ContactsIcon,
          path: `/${selectedYear}/contacts`,
          adminOnly: true,
        },
        {
          id: "registration-forms",
          type: "simple",
          labelKey: "Registration Forms",
          icon: DescriptionIcon,
          path: `/${selectedYear}/registration-forms`,
          adminOnly: true,
        },
        {
          id: "days",
          type: "collapsible",
          labelKey: "Days",
          icon: CalendarMonthIcon,
          path: `/${selectedYear}/days`,
          children:
            yearData?.days?.map((day: { day_id: number; name: string }) => ({
              id: `day-${day.day_id}`,
              label: day.name,
              path: `/${selectedYear}/days/${day.day_id}`,
            })) ?? [],
        },
        {
          id: "attendance",
          type: "simple",
          labelKey: "Attendance",
          icon: CheckCircleIcon,
          path: `/${selectedYear}/attendance`,
          managerOnly: true,
        },
        {
          id: "results",
          type: "simple",
          labelKey: "Results",
          icon: AssessmentIcon,
          path: `/${selectedYear}/results`,
          adminOnly: true,
        },
        {
          id: "settings",
          type: "simple",
          labelKey: "Settings",
          icon: SettingsIcon,
          path: `/${selectedYear}/settings`,
          adminOnly: true,
        },
      ] as RouteConfig[])
    : []),
  {
    id: "users",
    type: "simple",
    labelKey: "Users",
    icon: GroupIcon,
    path: "/users",
    adminOnly: true,
  },
];

const StyledLink = styled(Link)<{ theme?: Theme }>(({ theme }) => ({
  textDecoration: "none",
  color: "inherit",
  display: "block",
  width: "100%",
  "&.active .MuiListItemButton-root": {
    backgroundColor: theme.palette.action.selected,
  },
  "& .MuiListItemButton-root:hover": {
    backgroundColor: theme.palette.action.hover,
  },
}));

const StyledListItemButton = styled(ListItemButton)(({ theme }) => ({
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
}));

// Function to render routes from configuration
const renderRoutes = (
  routes: RouteConfig[],
  isLinkActive: (path: string) => boolean,
  daysOpen: boolean,
  setDaysOpen: (open: boolean) => void,
  t: (key: string) => string,
  user: { is_admin?: boolean } | null,
  isManagerForYear: boolean,
) => {
  return routes.map((route) => {
    // Skip admin-only routes for non-admin users
    if (route.adminOnly && !user?.is_admin) {
      return null;
    }
    // Skip manager-only routes for non-manager users
    if (route.managerOnly && !isManagerForYear && !user?.is_admin) {
      return null;
    }

    if (route.type === "simple") {
      return (
        <ListItem key={route.id} disablePadding>
          <StyledLink
            to={route.path}
            className={isLinkActive(route.path) ? "active" : ""}
          >
            <ListItemButton>
              <ListItemIcon>
                <route.icon />
              </ListItemIcon>
              <ListItemText primary={t(route.labelKey)} />
            </ListItemButton>
          </StyledLink>
        </ListItem>
      );
    }

    if (route.type === "collapsible") {
      return (
        <div key={route.id}>
          <ListItem disablePadding>
            <StyledListItemButton onClick={() => setDaysOpen(!daysOpen)}>
              <ListItemIcon>
                <route.icon />
              </ListItemIcon>
              <ListItemText primary={t(route.labelKey)} />
              {daysOpen ? <ExpandLess /> : <ExpandMore />}
            </StyledListItemButton>
          </ListItem>
          <Collapse in={daysOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {route.children.map((child) => {
                // Skip admin-only children for non-admin users
                if (child.adminOnly && !user?.is_admin) {
                  return null;
                }

                return (
                  <StyledLink
                    key={child.id}
                    to={child.path}
                    className={isLinkActive(child.path) ? "active" : ""}
                  >
                    <ListItemButton
                      sx={{
                        pl: 4,
                        color: child.adminOnly ? "primary.main" : "inherit",
                      }}
                    >
                      <ListItemText
                        primary={
                          child.labelKey
                            ? `+ ${t(child.labelKey)}`
                            : child.label
                        }
                      />
                    </ListItemButton>
                  </StyledLink>
                );
              })}
            </List>
          </Collapse>
        </div>
      );
    }

    return null;
  });
};

export default observer(function MainLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [daysOpen, setDaysOpen] = useState(true);

  const years = useYears();
  const location = useLocation();
  const user = authStore.user;

  const selectedYear =
    useMatch({
      from: "/_logged-in/$yearId",
      select: (match) => match.params.yearId,
      shouldThrow: false,
    }) ?? null;

  const yearData = useQuery({
    queryKey: selectedYear !== null ? queryKeys.year.form(selectedYear) : [],
    queryFn: async () => {
      if (!selectedYear) return null;
      const response = await getFormYearApiV1YearYearIdGet({
        path: { year_id: Number(selectedYear) },
      });
      return response.data;
    },
    enabled: selectedYear !== null,
  });

  const navigate = useNavigate();

  const handleYearChange = (event: SelectChangeEvent<string | null>) => {
    const yearId = event.target.value;
    if (yearId === "create") {
      navigate({ to: "/create" });
    } else {
      navigate({ to: `/${yearId}` });
    }
  };

  const handleDrawerClose = () => {
    setIsClosing(true);
    setMobileOpen(false);
  };

  const handleDrawerTransitionEnd = () => {
    setIsClosing(false);
  };

  const handleDrawerToggle = () => {
    if (!isClosing) {
      setMobileOpen(!mobileOpen);
    }
  };

  const yearSelectorId = useId();

  const isLinkActive = (path: string) => {
    return location.pathname === path;
  };

  // Check if user is manager for the selected year
  const isManagerForYear =
    selectedYear !== null &&
    years.isSuccess &&
    years.data.years.some(
      (year) => year.year_id === Number(selectedYear) && year.is_manager,
    );

  // Get routes configuration
  const routes = getRoutesConfig(selectedYear, yearData.data || {});

  const drawer = (
    <div>
      <Toolbar>
        <FormControl variant="standard" sx={{ minWidth: 120 }} fullWidth>
          <InputLabel id={yearSelectorId}>{t("Year")}</InputLabel>
          <Select
            labelId={yearSelectorId}
            id={yearSelectorId}
            value={selectedYear ?? ""}
            onChange={handleYearChange}
            label={t("Year")}
          >
            <MenuItem value={""}>{t("Main")}</MenuItem>
            <MenuItem
              disabled
              sx={{
                borderTop: 1,
                borderColor: "divider",
                my: 1,
                opacity: 1,
                pointerEvents: "none",
              }}
            >
              {t("Years")}
            </MenuItem>
            {years.isSuccess &&
              years.data.years.map((year) => (
                <MenuItem key={year.year_id} value={year.year_id}>
                  {year.year_name}
                </MenuItem>
              ))}
            {user?.is_admin && (
              <MenuItem
                value="create"
                sx={{
                  borderTop: 1,
                  borderColor: "divider",
                  mt: 1,
                  color: "primary.main",
                }}
              >
                + {t("Create Year")}
              </MenuItem>
            )}
          </Select>
        </FormControl>
      </Toolbar>
      <Divider />
      <List>
        {renderRoutes(
          routes,
          isLinkActive,
          daysOpen,
          setDaysOpen,
          t,
          user,
          isManagerForYear ?? false,
        )}
        <Divider />
      </List>
    </div>
  );

  return (
    <Box sx={{ display: "flex", width: "100%", overflow: "hidden" }}>
      <AppBar
        position="fixed"
        sx={{
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          ml: { lg: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { lg: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {t(title)}
          </Typography>
          <LanguageSwitcher />
          <Button
            color="inherit"
            onClick={() => {
              authStore.logout();
              navigate({ to: "/login" });
            }}
          >
            {t("Logout")}
          </Button>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onTransitionEnd={handleDrawerTransitionEnd}
          onClose={handleDrawerClose}
          sx={{
            display: { xs: "block", lg: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
          slotProps={{
            root: {
              keepMounted: true, // Better open performance on mobile.
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", lg: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          height: "100vh",
          overflow: "auto",
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
});
