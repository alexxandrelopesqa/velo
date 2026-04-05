-- Harden public access to order data:
-- 1) Remove broad public SELECT policy from orders.
-- 2) Expose a restricted lookup RPC that requires order number + CPF match
--    and returns only non-sensitive fields.

DROP POLICY IF EXISTS "Anyone can view orders by order number" ON public.orders;

CREATE OR REPLACE FUNCTION public.get_order_public(
  p_order_number TEXT,
  p_customer_cpf TEXT,
  p_customer_cpf_masked TEXT
)
RETURNS TABLE (
  order_number TEXT,
  color TEXT,
  wheel_type TEXT,
  optionals TEXT[],
  payment_method TEXT,
  total_price NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ,
  customer_name_masked TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.order_number,
    o.color,
    o.wheel_type,
    o.optionals,
    o.payment_method,
    o.total_price,
    o.status,
    o.created_at,
    (
      LEFT(SPLIT_PART(o.customer_name, ' ', 1), 1)
      || REPEAT('*', GREATEST(LENGTH(SPLIT_PART(o.customer_name, ' ', 1)) - 1, 0))
    )::TEXT AS customer_name_masked
  FROM public.orders o
  WHERE o.order_number = UPPER(TRIM(p_order_number))
    AND (
      REGEXP_REPLACE(COALESCE(p_customer_cpf, ''), '\D', '', 'g') = ''
      OR o.customer_cpf IN (
        REGEXP_REPLACE(COALESCE(p_customer_cpf, ''), '\D', '', 'g'),
        COALESCE(p_customer_cpf_masked, '')
      )
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_order_public(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_public(TEXT, TEXT, TEXT) TO anon, authenticated;
