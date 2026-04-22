## SPC RCD Uploader App

This app consists of 2 services:

- Vite frontend
- Hono.js backend

## Dev environment

Both apps are part of a `yarn` workspace so dependencies are managed centrally.

To add a package to a specific service, you can run:

```
yarn workspace api add my-package-name
```

or

```
yarn workspace web-app add my-package-name
```

or you can just cd into the folder and run `yarn add` normally.

To start, run `yarn dev`, which will start both the backend and frontend.

Or start them individually with

```
yarn dev:frontend
yarn dev:backend
```

Frontend url: `http://localhost:3069`

Backend url: `http://localhost:3068`

## Architecture

Backend API: [https://hono.dev/]

Routing: [https://tanstack.com/router/latest/docs/framework/react/overview]

Queries: [https://tanstack.com/query/latest/docs/framework/react/overview]

UI Framework: [https://mantine.dev/]
