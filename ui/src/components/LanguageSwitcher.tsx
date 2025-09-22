import { Button, Menu, MenuItem } from "@mui/material";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLanguageChange = (language: string) => {
    i18n.changeLanguage(language);
    handleClose();
  };

  const languageMenuId = useId();
  const languageButtonId = useId();

  return (
    <>
      <Button
        color="inherit"
        onClick={handleClick}
        aria-controls={open ? languageMenuId : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        aria-labelledby={languageButtonId}
      >
        {t("_lang")}
      </Button>
      <Menu
        id={languageMenuId}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": languageButtonId,
        }}
      >
        <MenuItem onClick={() => handleLanguageChange("en")}>English</MenuItem>
        <MenuItem onClick={() => handleLanguageChange("ru")}>Русский</MenuItem>
      </Menu>
    </>
  );
}
