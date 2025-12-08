import type * as React from "react";

type CtrlEnterOptions = {
  canSubmit?: boolean;
  submit?: () => void | Promise<void>;
};

export function submitOnCtrlEnter(
  event: React.KeyboardEvent<HTMLElement>,
  options: CtrlEnterOptions = {},
) {
  if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) {
    return;
  }

  if (options.canSubmit === false) {
    return;
  }

  event.preventDefault();

  if (options.submit) {
    void options.submit();
    return;
  }

  const target = event.target;
  const form =
    event.currentTarget instanceof HTMLFormElement
      ? event.currentTarget
      : target instanceof HTMLElement
        ? target.closest("form")
        : null;
  form?.requestSubmit();
}
