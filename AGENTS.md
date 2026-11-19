# Architecture rules

- Keep legacy table contracts in a separate compatibility adapter using the existing Supabase client; never edit generated database types or represent legacy contracts as verified schema, so regeneration cannot break legacy consumers and missing-table errors remain visible.- Teacher trial: teacher_access + is_teacher enforce trial expiry server-side; TrialGate is UI only.
