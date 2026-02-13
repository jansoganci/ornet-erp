import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Input,
  Button,
  Select,
  Textarea,
} from '../../../components/ui';
import {
  expenseSchema,
  expenseDefaultValues,
  incomeSchema,
  incomeDefaultValues,
  PAYMENT_METHODS,
  INCOME_TYPES,
  CURRENCIES,
} from '../schema';
import { useCategories, useCreateTransaction, useUpdateTransaction, useLatestRate } from '../hooks';
import { useProposalItems } from '../../proposals/hooks';
import { CustomerSiteSelector } from '../../workOrders/CustomerSiteSelector';
import { ProposalCombobox } from './ProposalCombobox';
import { WorkOrderCombobox } from './WorkOrderCombobox';
import { computeProposalCogsUsd } from '../utils';

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function transactionToExpenseForm(transaction) {
  if (!transaction) return null;
  const d = transaction.transaction_date;
  return {
    expense_category_id: transaction.expense_category_id || '',
    amount_try: transaction.amount_try ?? 0,
    transaction_date: typeof d === 'string' ? d.slice(0, 10) : d,
    payment_method: transaction.payment_method || 'bank_transfer',
    has_invoice: transaction.has_invoice ?? true,
    vat_rate: transaction.vat_rate ?? 20,
    description: transaction.description || '',
  };
}

function transactionToIncomeForm(transaction) {
  if (!transaction) return null;
  const d = transaction.transaction_date;
  return {
    amount_original: transaction.amount_original ?? 0,
    original_currency: transaction.original_currency || 'TRY',
    amount_try: transaction.amount_try ?? 0,
    exchange_rate: transaction.exchange_rate ?? undefined,
    transaction_date: typeof d === 'string' ? d.slice(0, 10) : d,
    income_type: transaction.income_type || 'other',
    customer_id: transaction.customer_id || '',
    site_id: transaction.site_id || '',
    payment_method: transaction.payment_method || 'bank_transfer',
    should_invoice: transaction.should_invoice ?? true,
    vat_rate: transaction.vat_rate ?? 20,
    cogs_try: transaction.cogs_try ?? undefined,
    description: transaction.description || '',
    proposal_id: transaction.proposal_id || '',
    work_order_id: transaction.work_order_id || '',
  };
}

export function QuickEntryModal({ open, onClose, direction, transaction }) {
  const { t } = useTranslation(['finance', 'common']);
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const { data: categories = [] } = useCategories({ is_active: true });
  const { data: latestRate } = useLatestRate('USD');

  const showTabs = direction == null;
  const [activeTab, setActiveTab] = useState('expense');
  const effectiveDirection = direction ?? activeTab;
  const isExpense = effectiveDirection === 'expense';
  const isEditMode = !!transaction;

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isExpense ? expenseSchema : incomeSchema),
    defaultValues: isExpense
      ? { ...expenseDefaultValues, transaction_date: getTodayISO() }
      : { ...incomeDefaultValues, transaction_date: getTodayISO() },
  });

  const hasInvoice = useWatch({ control, name: 'has_invoice', defaultValue: true });
  const shouldInvoice = useWatch({ control, name: 'should_invoice', defaultValue: true });
  const originalCurrency = useWatch({ control, name: 'original_currency', defaultValue: 'TRY' });
  const amountOriginal = useWatch({ control, name: 'amount_original', defaultValue: 0 });
  const exchangeRate = useWatch({ control, name: 'exchange_rate', defaultValue: undefined });
  const proposalId = useWatch({ control, name: 'proposal_id', defaultValue: '' });

  const selectedCustomerId = watch('customer_id') || '';
  const selectedSiteId = watch('site_id') || '';
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);

  const { data: proposalItems = [] } = useProposalItems(proposalId || null);

  useEffect(() => {
    if (open) {
      setSelectedProposal(null);
      setSelectedWorkOrder(null);
      if (showTabs) setActiveTab('expense');
      if (isEditMode && transaction) {
        const formData = isExpense
          ? transactionToExpenseForm(transaction)
          : transactionToIncomeForm(transaction);
        if (formData) reset(formData);
      } else {
        const defaults = isExpense
          ? { ...expenseDefaultValues, transaction_date: getTodayISO() }
          : {
              ...incomeDefaultValues,
              transaction_date: getTodayISO(),
              exchange_rate: latestRate?.effective_rate,
            };
        reset(defaults);
      }
    }
  }, [open, reset, isExpense, isEditMode, transaction, latestRate?.effective_rate, showTabs]);

  useEffect(() => {
    if (!open && showTabs) setActiveTab('expense');
  }, [open, showTabs]);

  useEffect(() => {
    if (open && showTabs && !isEditMode) {
      const defaults =
        activeTab === 'expense'
          ? { ...expenseDefaultValues, transaction_date: getTodayISO() }
          : {
              ...incomeDefaultValues,
              transaction_date: getTodayISO(),
              exchange_rate: latestRate?.effective_rate,
            };
      reset(defaults);
    }
  }, [activeTab, open, showTabs, isEditMode, reset, latestRate?.effective_rate]);

  useEffect(() => {
    if (originalCurrency === 'USD' && latestRate?.effective_rate && !exchangeRate) {
      setValue('exchange_rate', latestRate.effective_rate);
    }
  }, [originalCurrency, latestRate?.effective_rate, exchangeRate, setValue]);

  useEffect(() => {
    if (originalCurrency === 'USD' && amountOriginal != null && exchangeRate) {
      const amt = Number(amountOriginal) || 0;
      const rate = Number(exchangeRate) || 0;
      setValue('amount_try', Math.round(amt * rate * 100) / 100);
    } else if (originalCurrency === 'TRY') {
      setValue('amount_try', amountOriginal);
    }
  }, [originalCurrency, amountOriginal, exchangeRate, setValue]);

  useEffect(() => {
    if (proposalId && proposalItems.length > 0) {
      const cogsUsd = computeProposalCogsUsd(proposalItems);
      const rate =
        originalCurrency === 'USD'
          ? Number(exchangeRate) || 1
          : Number(latestRate?.effective_rate) || 1;
      const cogsTry = Math.round(cogsUsd * rate * 100) / 100;
      setValue('cogs_try', cogsTry);
    }
  }, [proposalId, proposalItems, originalCurrency, exchangeRate, latestRate?.effective_rate, setValue]);

  const buildExpensePayload = (data) => {
    const amount = Number(data.amount_try);
    const inputVat =
      data.has_invoice === true
        ? Math.round(amount * (Number(data.vat_rate) || 20) / 100 * 100) / 100
        : null;

    return {
      direction: 'expense',
      original_currency: 'TRY',
      amount_original: amount,
      amount_try: amount,
      transaction_date: data.transaction_date,
      expense_category_id: data.expense_category_id || null,
      payment_method: data.payment_method || 'bank_transfer',
      has_invoice: data.has_invoice ?? true,
      input_vat: inputVat,
      vat_rate: Number(data.vat_rate) || 20,
      description: data.description?.trim() || null,
    };
  };

  const buildIncomePayload = (data) => {
    const amtOrig = Number(data.amount_original) || 0;
    const amtTry = Number(data.amount_try) || 0;
    const rate = data.original_currency === 'USD' ? Number(data.exchange_rate) : null;
    const outputVat =
      data.should_invoice === true
        ? Math.round(amtTry * (Number(data.vat_rate) || 20) / 100 * 100) / 100
        : null;

    return {
      direction: 'income',
      original_currency: data.original_currency || 'TRY',
      amount_original: amtOrig,
      amount_try: amtTry,
      exchange_rate: rate,
      transaction_date: data.transaction_date,
      income_type: data.income_type || 'other',
      customer_id: data.customer_id || null,
      site_id: data.site_id || null,
      payment_method: data.payment_method || 'bank_transfer',
      should_invoice: data.should_invoice ?? true,
      output_vat: outputVat,
      vat_rate: Number(data.vat_rate) || 20,
      cogs_try: data.cogs_try != null ? Number(data.cogs_try) : null,
      description: data.description?.trim() || null,
      proposal_id: data.proposal_id || null,
      work_order_id: data.work_order_id || null,
    };
  };

  const saveExpense = async (data, addAnother = false) => {
    const payload = buildExpensePayload(data);
    if (isEditMode && transaction) {
      await updateMutation.mutateAsync({ id: transaction.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    if (isEditMode) {
      reset();
      onClose();
    } else if (addAnother) {
      const kept = {
        transaction_date: getValues('transaction_date'),
        expense_category_id: getValues('expense_category_id'),
      };
      reset({ ...expenseDefaultValues, ...kept });
    } else {
      reset();
      onClose();
    }
  };

  const saveIncome = async (data, addAnother = false) => {
    const payload = buildIncomePayload(data);
    if (isEditMode && transaction) {
      await updateMutation.mutateAsync({ id: transaction.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    if (isEditMode) {
      reset();
      onClose();
    } else if (addAnother) {
      const kept = {
        transaction_date: getValues('transaction_date'),
        customer_id: getValues('customer_id'),
        site_id: getValues('site_id'),
        proposal_id: getValues('proposal_id'),
      };
      reset({ ...incomeDefaultValues, ...kept });
    } else {
      reset();
      onClose();
    }
  };

  const onSubmitAndAddAnother = (data) =>
    isExpense ? saveExpense(data, true) : saveIncome(data, true);
  const onSubmitAndClose = (data) =>
    isExpense ? saveExpense(data, false) : saveIncome(data, false);

  const handleClose = () => {
    reset();
    onClose();
  };

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name_tr || c.name_en,
  }));

  const paymentMethodOptions = PAYMENT_METHODS.map((m) => ({
    value: m,
    label: t(`finance:expense.paymentMethods.${m}`),
  }));

  const incomeTypeOptions = INCOME_TYPES.map((type) => ({
    value: type,
    label: t(`finance:income.incomeTypes.${type}`),
  }));

  const currencyOptions = CURRENCIES.map((c) => ({
    value: c,
    label: c,
  }));

  const handleProposalSelect = (proposal) => {
    setSelectedProposal(proposal);
    if (proposal) {
      setValue('proposal_id', proposal.id);
      setValue('customer_id', proposal.customer_id || '');
      setValue('site_id', proposal.site_id || '');
    } else {
      setValue('proposal_id', '');
    }
  };

  const handleWorkOrderSelect = (wo) => {
    setSelectedWorkOrder(wo);
    setValue('work_order_id', wo?.id || '');
  };

  const expenseFooter = (
    <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
      <Button variant="ghost" onClick={handleClose} className="flex-1 sm:flex-none">
        {t('common:actions.cancel')}
      </Button>
      {isEditMode ? (
        <Button
          variant="primary"
          onClick={handleSubmit((data) => saveExpense(data, false))}
          loading={isSubmitting}
          className="flex-1 sm:flex-none"
        >
          {t('common:actions.save')}
        </Button>
      ) : (
        <>
          <Button
            variant="outline"
            onClick={handleSubmit(onSubmitAndClose)}
            loading={isSubmitting}
            className="flex-1 sm:flex-none"
          >
            {t('finance:expense.saveAndClose')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit(onSubmitAndAddAnother)}
            loading={isSubmitting}
            className="flex-1 sm:flex-none"
          >
            {t('finance:expense.addAnother')}
          </Button>
        </>
      )}
    </div>
  );

  const tabBar = showTabs && (
    <div className="flex rounded-lg border border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-neutral-900/50 p-0.5 mb-4">
      <button
        type="button"
        onClick={() => setActiveTab('expense')}
        className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === 'expense'
            ? 'bg-primary-600 text-white shadow-sm dark:bg-primary-500'
            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60'
        }`}
      >
        {t('finance:list.title')}
      </button>
      <button
        type="button"
        onClick={() => setActiveTab('income')}
        className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === 'income'
            ? 'bg-primary-600 text-white shadow-sm dark:bg-primary-500'
            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60'
        }`}
      >
        {t('finance:list.titleIncome')}
      </button>
    </div>
  );

  if (isExpense) {
    return (
      <Modal
        open={open}
        onClose={handleClose}
        title={showTabs ? t('finance:quickEntry.title') : (isEditMode ? t('finance:expense.editTitle') : t('finance:expense.title'))}
        size="md"
        footer={expenseFooter}
      >
        {tabBar}
        <form className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Input
              label={t('finance:expense.fields.date')}
              type="date"
              error={errors.transaction_date?.message}
              {...register('transaction_date')}
              autoFocus
            />
            <Input
              label={t('finance:expense.fields.amount')}
              type="number"
              min={0}
              step="0.01"
              placeholder={t('finance:expense.placeholders.amount')}
              error={errors.amount_try?.message}
              {...register('amount_try')}
            />
          </div>

          <Select
            label={t('finance:expense.fields.category')}
            options={categoryOptions}
            placeholder={t('finance:expense.placeholders.category')}
            error={errors.expense_category_id?.message}
            {...register('expense_category_id')}
          />

          <Select
            label={t('finance:expense.fields.paymentMethod')}
            options={paymentMethodOptions}
            placeholder={t('finance:expense.placeholders.paymentMethod')}
            error={errors.payment_method?.message}
            {...register('payment_method')}
          />

          <div className="flex items-center space-x-3 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
            <input
              id="has_invoice"
              type="checkbox"
              className="h-5 w-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-600 transition-all cursor-pointer"
              {...register('has_invoice')}
            />
            <label
              htmlFor="has_invoice"
              className="text-sm font-bold text-neutral-700 dark:text-neutral-200 cursor-pointer select-none"
            >
              {t('finance:expense.fields.hasInvoice')}
            </label>
          </div>

          {hasInvoice && (
            <Input
              label={t('finance:expense.fields.vatRate')}
              type="number"
              min={0}
              max={100}
              step="0.01"
              error={errors.vat_rate?.message}
              {...register('vat_rate')}
            />
          )}

          <Textarea
            label={t('finance:expense.fields.description')}
            placeholder={t('finance:expense.placeholders.description')}
            error={errors.description?.message}
            rows={3}
            {...register('description')}
          />
        </form>
      </Modal>
    );
  }

  const incomeFooter = (
    <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
      <Button variant="ghost" onClick={handleClose} className="flex-1 sm:flex-none">
        {t('common:actions.cancel')}
      </Button>
      {isEditMode ? (
        <Button
          variant="primary"
          onClick={handleSubmit((data) => saveIncome(data, false))}
          loading={isSubmitting}
          className="flex-1 sm:flex-none"
        >
          {t('common:actions.save')}
        </Button>
      ) : (
        <>
          <Button
            variant="outline"
            onClick={handleSubmit(onSubmitAndClose)}
            loading={isSubmitting}
            className="flex-1 sm:flex-none"
          >
            {t('finance:income.saveAndClose')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit(onSubmitAndAddAnother)}
            loading={isSubmitting}
            className="flex-1 sm:flex-none"
          >
            {t('finance:income.addAnother')}
          </Button>
        </>
      )}
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={showTabs ? t('finance:quickEntry.title') : (isEditMode ? t('finance:income.editTitle') : t('finance:income.title'))}
      size="lg"
      footer={incomeFooter}
    >
      {tabBar}
      <form className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Input
            label={t('finance:income.fields.date')}
            type="date"
            error={errors.transaction_date?.message}
            {...register('transaction_date')}
            autoFocus
          />
          <Input
            label={`${t('finance:income.fields.amount')} (${originalCurrency})`}
            type="number"
            min={0}
            step="0.01"
            placeholder={t('finance:income.placeholders.amount')}
            error={errors.amount_original?.message}
            {...register('amount_original')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Select
            label={t('finance:income.fields.currency')}
            options={currencyOptions}
            {...register('original_currency')}
          />
          {originalCurrency === 'USD' && (
            <Input
              label={t('finance:income.fields.exchangeRate')}
              type="number"
              min={0}
              step="0.0001"
              placeholder={t('finance:income.placeholders.exchangeRate')}
              error={errors.exchange_rate?.message}
              {...register('exchange_rate')}
            />
          )}
          <Input
            label={t('finance:income.fields.amountTry')}
            type="number"
            min={0}
            step="0.01"
            placeholder={t('finance:income.placeholders.amountTry')}
            error={errors.amount_try?.message}
            {...register('amount_try')}
            readOnly={originalCurrency === 'USD'}
          />
        </div>

        <Select
          label={t('finance:income.fields.incomeType')}
          options={incomeTypeOptions}
          error={errors.income_type?.message}
          {...register('income_type')}
        />

        <div className="border border-neutral-200 dark:border-[#262626] rounded-xl p-4">
          <CustomerSiteSelector
            selectedCustomerId={selectedCustomerId}
            selectedSiteId={selectedSiteId}
            onCustomerChange={(id) => setValue('customer_id', id || '')}
            onSiteChange={(id) => setValue('site_id', id || '')}
            onAddNewSite={() => {}}
            onAddNewCustomer={() => {}}
            siteOptional
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {t('finance:income.fields.proposal')}
          </label>
          <ProposalCombobox
            value={proposalId}
            selectedProposal={selectedProposal}
            onSelect={handleProposalSelect}
            placeholder={t('finance:income.placeholders.proposal')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {t('finance:income.fields.workOrder')}
          </label>
          <WorkOrderCombobox
            value={watch('work_order_id') || ''}
            selectedWorkOrder={selectedWorkOrder}
            onSelect={handleWorkOrderSelect}
            placeholder={t('finance:income.placeholders.workOrder')}
            proposalId={proposalId}
          />
        </div>

        <Select
          label={t('finance:income.fields.paymentMethod')}
          options={paymentMethodOptions}
          error={errors.payment_method?.message}
          {...register('payment_method')}
        />

        <div className="flex items-center space-x-3 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
          <input
            id="should_invoice"
            type="checkbox"
            className="h-5 w-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-600 transition-all cursor-pointer"
            {...register('should_invoice')}
          />
          <label
            htmlFor="should_invoice"
            className="text-sm font-bold text-neutral-700 dark:text-neutral-200 cursor-pointer select-none"
          >
            {t('finance:income.fields.shouldInvoice')}
          </label>
        </div>

        {shouldInvoice && (
          <Input
            label={t('finance:income.fields.vatRate')}
            type="number"
            min={0}
            max={100}
            step="0.01"
            error={errors.vat_rate?.message}
            {...register('vat_rate')}
          />
        )}

        <Input
          label={t('finance:income.fields.cogs')}
          type="number"
          min={0}
          step="0.01"
          error={errors.cogs_try?.message}
          {...register('cogs_try')}
        />

        <Textarea
          label={t('finance:income.fields.description')}
          placeholder={t('finance:income.placeholders.description')}
          error={errors.description?.message}
          rows={3}
          {...register('description')}
        />
      </form>
    </Modal>
  );
}
