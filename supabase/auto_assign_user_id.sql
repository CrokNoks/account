-- Fonction pour assigner automatiquement l'ID de l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.auto_assign_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour la table categories
DROP TRIGGER IF EXISTS on_auth_user_created_categories ON public.categories;
CREATE TRIGGER on_auth_user_created_categories
  BEFORE INSERT ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_user_id();

-- Trigger pour la table expenses
DROP TRIGGER IF EXISTS on_auth_user_created_expenses ON public.expenses;
CREATE TRIGGER on_auth_user_created_expenses
  BEFORE INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_user_id();

-- Mise à jour des politiques RLS pour être sûr
DROP POLICY IF EXISTS "Users can create their own categories" ON public.categories;
CREATE POLICY "Users can create their own categories"
  ON public.categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own expenses" ON public.expenses;
CREATE POLICY "Users can create their own expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);
