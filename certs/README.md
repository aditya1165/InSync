# Supabase database CA

`supabase-root-2021.crt` is the public **Supabase Root 2021 CA** certificate. It is not a credential or private key. It was downloaded from Supabase's certificate download bucket at `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt` on 2026-11-07.

SHA-256 fingerprint: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

Use it with `sslmode=verify-full` and the pooler hostname from the Supabase dashboard.
