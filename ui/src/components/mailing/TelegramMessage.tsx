import { Box, Button, Stack } from "@mui/material";
import { Fragment, type ReactNode } from "react";
import type { MailingButton } from "@/client/types.gen";

const SAFE_URL = /^(https?|tg):/i;

const SIMPLE_TAGS: Record<string, string> = {
  b: "b",
  strong: "b",
  i: "i",
  em: "i",
  u: "u",
  ins: "u",
  s: "s",
  strike: "s",
  del: "s",
  code: "code",
  pre: "pre",
  blockquote: "blockquote",
};

const spoiler = {
  backgroundColor: "text.disabled",
  color: "transparent",
  borderRadius: 0.5,
  "&:hover": { color: "inherit", backgroundColor: "transparent" },
};

/** React elements of Telegram HTML: unknown tags and attributes are dropped. */
function renderNode(node: Node, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }
  const element = node as Element;
  const children = Array.from(element.childNodes).map(renderNode);
  const tag = element.tagName.toLowerCase();

  if (tag in SIMPLE_TAGS) {
    const Tag = SIMPLE_TAGS[tag] as "b";
    return <Tag key={key}>{children}</Tag>;
  }
  if (tag === "a") {
    const href = element.getAttribute("href") ?? "";
    return SAFE_URL.test(href) ? (
      <a key={key} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <Fragment key={key}>{children}</Fragment>
    );
  }
  if (
    tag === "tg-spoiler" ||
    (tag === "span" && element.getAttribute("class") === "tg-spoiler")
  ) {
    return (
      <Box component="span" key={key} sx={spoiler}>
        {children}
      </Box>
    );
  }
  return <Fragment key={key}>{children}</Fragment>;
}

/** Preview of a Telegram message rendered from Telegram HTML, with its link buttons. */
export function TelegramMessage({
  text,
  buttons,
}: {
  text: string;
  buttons: MailingButton[];
}) {
  const body = new DOMParser().parseFromString(
    `<body>${text}</body>`,
    "text/html",
  ).body;

  return (
    <Box sx={{ maxWidth: 420 }}>
      <Box
        data-testid="telegram-message"
        sx={{
          typography: "body1",
          bgcolor: "#eeffde",
          border: 1,
          borderColor: "#c8e6b0",
          borderRadius: 2,
          px: 1.5,
          py: 1,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: 15,
          "& pre, & code": { fontFamily: "monospace", fontSize: 13 },
          "& pre": { m: 0, p: 1, bgcolor: "rgba(0,0,0,0.05)", borderRadius: 1 },
          "& blockquote": {
            m: 0,
            pl: 1,
            borderLeft: 3,
            borderColor: "success.main",
          },
        }}
      >
        {Array.from(body.childNodes).map(renderNode)}
      </Box>
      {buttons.length > 0 && (
        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
          {buttons.map((button, i) => (
            <Button
              // biome-ignore lint/suspicious/noArrayIndexKey: buttons have no ids
              key={i}
              component="a"
              variant="outlined"
              size="small"
              href={SAFE_URL.test(button.url ?? "") ? button.url : undefined}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textTransform: "none" }}
            >
              {button.text}
            </Button>
          ))}
        </Stack>
      )}
    </Box>
  );
}
