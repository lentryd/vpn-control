# syntax=docker/dockerfile:1

ARG BUN_BASE_IMAGE=oven/bun:1
ARG GO_BASE_IMAGE=golang:1.26
ARG RUNTIME_BASE_IMAGE=gcr.io/distroless/static-debian12

# The frontend output is platform-independent, so it is always built natively.
FROM --platform=$BUILDPLATFORM ${BUN_BASE_IMAGE} AS web
WORKDIR /src/web
COPY web/package.json web/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile
COPY web/index.html web/bunfig.toml web/postcss.config.cjs web/tsconfig*.json ./
COPY web/scripts ./scripts
COPY web/public ./public
COPY web/src ./src
RUN bun run build

# Go cross-compiles natively too (CGO is off), instead of running under emulation.
FROM --platform=$BUILDPLATFORM ${GO_BASE_IMAGE} AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY main.go ./
COPY ent ./ent
COPY internal ./internal
COPY web/embed.go ./web/
COPY --from=web /src/web/dist ./web/dist
ARG TARGETOS TARGETARCH
ARG VERSION=dev
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w -X main.Version=${VERSION}" -o /out/vpn-control .

FROM ${RUNTIME_BASE_IMAGE}
COPY --from=build /out/vpn-control /vpn-control
ENV DB_PATH=/data/vpn-control.db \
    ADDONS_CONFIG=/etc/vpn-control/addons.yml \
    PORT=8080
VOLUME /data
EXPOSE 8080
ENTRYPOINT ["/vpn-control"]
