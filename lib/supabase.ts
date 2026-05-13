import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://uufeaomzkvbnxqqfkrtv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1ZmVhb216a3ZibnhxcWZrcnR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjg0MzEsImV4cCI6MjA4OTYwNDQzMX0.ZKmO6UazrRSwN896Bufb6t6JEOSNwECQty8h-zp2e2E'
)