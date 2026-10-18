FROM golang:1.26-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/hulu-backend .

FROM alpine:3.21
RUN addgroup -S app && adduser -S app -G app

COPY --from=build /out/hulu-backend /usr/local/bin/hulu-backend

USER app
EXPOSE 8080

ENTRYPOINT ["hulu-backend"]
