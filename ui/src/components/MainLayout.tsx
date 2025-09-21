import AssessmentIcon from "@mui/icons-material/Assessment";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ContactsIcon from "@mui/icons-material/Contacts";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
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
import { getFormYearApiV1YearYearIdGet } from "@/client";
import { queryKeys, useYears } from "@/data";
import { authStore } from "@/store/auth";

const drawerWidth = 240;

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

export default observer(function MainLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [daysOpen, setDaysOpen] = useState(true);

  const years = useYears();
  const location = useLocation();

  const selectedYear =
    useMatch({
      from: "/_logged-in/$yearId",
      select: (match) => match.params.yearId,
      shouldThrow: false,
    }) ?? "";

  const yearData = useQuery({
    queryKey: queryKeys.year.form(selectedYear),
    queryFn: async () => {
      if (!selectedYear) return null;
      const response = await getFormYearApiV1YearYearIdGet({
        path: { year_id: Number(selectedYear) },
      });
      return response.data;
    },
    enabled: !!selectedYear,
  });

  const navigate = useNavigate();

  const handleYearChange = (event: SelectChangeEvent<string>) => {
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

  const drawer = (
    <div>
      <Toolbar>
        <FormControl variant="standard" sx={{ minWidth: 120 }} fullWidth>
          <InputLabel id={yearSelectorId}>Year</InputLabel>
          <Select
            labelId={yearSelectorId}
            id={yearSelectorId}
            value={selectedYear}
            onChange={handleYearChange}
            label="Year"
          >
            <MenuItem value={""}>Main</MenuItem>
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
              Years
            </MenuItem>
            {years.isSuccess &&
              years.data.years.map((year) => (
                <MenuItem key={year.year_id} value={year.year_id}>
                  {year.year_name}
                </MenuItem>
              ))}
            {authStore.user?.is_admin && (
              <MenuItem
                value="create"
                sx={{
                  borderTop: 1,
                  borderColor: "divider",
                  mt: 1,
                  color: "primary.main",
                }}
              >
                + Create Year
              </MenuItem>
            )}
          </Select>
        </FormControl>
      </Toolbar>
      <Divider />
      {selectedYear && (
        <List>
          <ListItem disablePadding>
            <StyledLink
              to={`/${selectedYear}/registration`}
              className={
                isLinkActive(`/${selectedYear}/registration`) ? "active" : ""
              }
            >
              <ListItemButton>
                <ListItemIcon>
                  <AssignmentIcon />
                </ListItemIcon>
                <ListItemText primary="Registration Form" />
              </ListItemButton>
            </StyledLink>
          </ListItem>
          <ListItem disablePadding>
            <StyledLink
              to={`/${selectedYear}/contacts`}
              className={
                isLinkActive(`/${selectedYear}/contacts`) ? "active" : ""
              }
            >
              <ListItemButton>
                <ListItemIcon>
                  <ContactsIcon />
                </ListItemIcon>
                <ListItemText primary="Contacts" />
              </ListItemButton>
            </StyledLink>
          </ListItem>
          <ListItem disablePadding>
            <StyledListItemButton onClick={() => setDaysOpen(!daysOpen)}>
              <ListItemIcon>
                <CalendarMonthIcon />
              </ListItemIcon>
              <ListItemText primary="Days" />
              {daysOpen ? <ExpandLess /> : <ExpandMore />}
            </StyledListItemButton>
          </ListItem>
          <Collapse in={daysOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {yearData.isSuccess &&
                yearData.data?.days.map((day) => (
                  <StyledLink
                    key={day.day_id}
                    to={`/${selectedYear}/days/${day.day_id}`}
                    className={
                      isLinkActive(`/${selectedYear}/days/${day.day_id}`)
                        ? "active"
                        : ""
                    }
                  >
                    <ListItemButton sx={{ pl: 4 }}>
                      <ListItemText primary={day.name} />
                    </ListItemButton>
                  </StyledLink>
                ))}
              {authStore.user?.is_admin && (
                <StyledLink
                  to={`/${selectedYear}/days/create`}
                  className={
                    isLinkActive(`/${selectedYear}/days/create`) ? "active" : ""
                  }
                >
                  <ListItemButton sx={{ pl: 4, color: "primary.main" }}>
                    <ListItemText primary="+ Create Day" />
                  </ListItemButton>
                </StyledLink>
              )}
            </List>
          </Collapse>
          <ListItem disablePadding>
            <StyledLink
              to={`/${selectedYear}/results`}
              className={
                isLinkActive(`/${selectedYear}/results`) ? "active" : ""
              }
            >
              <ListItemButton>
                <ListItemIcon>
                  <AssessmentIcon />
                </ListItemIcon>
                <ListItemText primary="Results" />
              </ListItemButton>
            </StyledLink>
          </ListItem>
          <ListItem disablePadding>
            <StyledLink
              to={`/${selectedYear}/medals`}
              className={
                isLinkActive(`/${selectedYear}/medals`) ? "active" : ""
              }
            >
              <ListItemButton>
                <ListItemIcon>
                  <EmojiEventsIcon />
                </ListItemIcon>
                <ListItemText primary="User Medals" />
              </ListItemButton>
            </StyledLink>
          </ListItem>
          <ListItem disablePadding>
            <StyledLink
              to={`/${selectedYear}/settings`}
              className={
                isLinkActive(`/${selectedYear}/settings`) ? "active" : ""
              }
            >
              <ListItemButton>
                <ListItemIcon>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText primary="Settings" />
              </ListItemButton>
            </StyledLink>
          </ListItem>
          <ListItem disablePadding>
            <StyledLink
              to={`/${selectedYear}/users`}
              className={isLinkActive(`/${selectedYear}/users`) ? "active" : ""}
            >
              <ListItemButton>
                <ListItemIcon>
                  <GroupIcon />
                </ListItemIcon>
                <ListItemText primary="Users" />
              </ListItemButton>
            </StyledLink>
          </ListItem>
        </List>
      )}
    </div>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
          <Button
            color="inherit"
            onClick={() => {
              authStore.logout();
              navigate({ to: "/login" });
            }}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onTransitionEnd={handleDrawerTransitionEnd}
          onClose={handleDrawerClose}
          sx={{
            display: { xs: "block", sm: "none" },
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
            display: { xs: "none", sm: "block" },
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
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
});
