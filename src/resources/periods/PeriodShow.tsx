import { Show, SimpleShowLayout, DateField, BooleanField, ReferenceManyField, Datagrid, TextField, NumberField, ReferenceField } from 'react-admin';

export const PeriodShow = () => (
  <Show>
    <SimpleShowLayout>
      <DateField source="start_date" label="Date de début" />
      <DateField source="end_date" label="Date de fin" />
      <BooleanField source="is_active" label="Actif" />

      <ReferenceManyField
        reference="budgets"
        target="period_id"
        label="Budgets de la période"
      >
        <Datagrid>
          <ReferenceField source="category_id" reference="categories">
            <TextField source="name" />
          </ReferenceField>
          <NumberField source="amount_allocated" options={{ style: 'currency', currency: 'EUR' }} label="Alloué" />
          {/* We could calculate spent/remaining here if the backend provided it, or if we joined expenses.
                         For now, start with allocated. 
                     */}
        </Datagrid>
      </ReferenceManyField>
    </SimpleShowLayout>
  </Show>
);
