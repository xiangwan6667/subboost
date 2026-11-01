# Miu subscription support

SubBoost converts subscriptions; it does not implement a proxy transport. Import and generate the Miu Mihomo YAML fields defined by the Miu project, including PSK, TLS, REALITY, UDP, certificate/client fingerprints and connection-pool settings. Generated subscriptions require a Mihomo-compatible client with the Miu outbound installed.

Keep the upstream YAML format as the primary interface. The Miu project does not define a share-link format, so accepting a documented `miu://` import is a SubBoost compatibility extension, not a claim of an official standard. Existing Base64 subscription preprocessing can import encoded links or YAML. Do not add a link export format when the application only generates Mihomo YAML.

Use the existing parsing, node typing, fingerprint normalization and generation paths. Reject malformed Miu inputs and exclude invalid saved nodes from generated configurations; never decode or expose PSKs in errors. Preserve explicit UDP settings and use the Miu client's defaults when omitted. Existing protocols and unrelated UI remain unchanged.

The approach was selected over treating Miu as an unknown passthrough, which cannot validate required fields and REALITY, and over implementing proxy transport inside this subscription converter.
