-- Atualizar política RLS para incluir status válidos (paid, issued)
DROP POLICY IF EXISTS "Users can view their matches" ON matches;

CREATE POLICY "Users can view their matches"
ON matches
FOR SELECT
TO public
USING (
  ((auth.uid() = user_a_id) OR (auth.uid() = user_b_id))
  AND
  EXISTS (
    SELECT 1 FROM tickets
    WHERE tickets.event_id = matches.event_id
    AND tickets.buyer_user_id = auth.uid()
    AND tickets.status IN ('paid', 'issued')
  )
);

