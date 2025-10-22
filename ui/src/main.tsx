// import React from "react";

// if (import.meta.env.DEV) {
//   const whyDidYouRender = await import("@welldone-software/why-did-you-render");
//   whyDidYouRender.default(React, {
//     // trackAllPureComponents: true,
//   });
// }

import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/inter";

import { client } from "./client/client.gen";

import * as TanStackQueryProvider from "./integrations/tanstack-query/root-provider.tsx";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

import "./styles.css";
import { observer } from "mobx-react-lite";
import reportWebVitals from "./reportWebVitals.ts";

// Initialize i18n
import "./i18n";
import { handleApiError } from "./utils/apiErrorHandling.ts";

// Create a new router instance
const router = createRouter({
  routeTree,
  context: {
    ...TanStackQueryProvider.getContext(),
    title: "Volunteers",
  },
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

client.setConfig({
  baseURL: import.meta.env.BASE_URL,
});

client.instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    return Promise.reject(handleApiError(error));
  },
);

const App = observer(() => (
  <StrictMode>
    <TanStackQueryProvider.Provider>
      <RouterProvider router={router} basepath={import.meta.env.BASE_URL} />
    </TanStackQueryProvider.Provider>
  </StrictMode>
));

// Render the app
const rootElement = document.getElementById("app");
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
