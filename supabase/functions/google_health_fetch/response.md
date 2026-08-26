```
HTTP/1.1 401 Unauthorized
Content-Type: application/json
Content-Length: 62
Connection: keep-alive
access-control-allow-origin: *
access-control-allow-headers: authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage
access-control-allow-methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
vary: Accept-Encoding
date: Wed, 26 Aug 2026 11:39:46 GMT
X-Kong-Upstream-Latency: 1131
X-Kong-Proxy-Latency: 2
Via: kong/2.8.1

{"message":"Invalid credentials","code":"INVALID_CREDENTIALS"}
```