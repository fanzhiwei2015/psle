FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /out/psle-api ./cmd/server

FROM alpine:3.22

RUN apk --no-cache add ca-certificates wget

WORKDIR /app
COPY --from=builder /out/psle-api /app/psle-api

EXPOSE 8080

CMD ["/app/psle-api"]
